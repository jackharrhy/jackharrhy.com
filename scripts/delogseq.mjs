#!/usr/bin/env node

/**
 * delogseq.mjs — Convert Logseq-style bullet markdown to Obsidian-style prose.
 *
 * Usage:
 *   node scripts/delogseq.mjs --dry-run                    # Preview all changes
 *   node scripts/delogseq.mjs --dry-run --file path/to/f   # Preview one file
 *   node scripts/delogseq.mjs                              # Convert all in-place
 *   node scripts/delogseq.mjs --file path/to/file.md       # Convert one file
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VAULT_DIR =
  process.env.GARDEN_VAULT_PATH || path.resolve(__dirname, "../vault/Garden");

// ── CLI args ──────────────────────────────────────────────
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const fileIdx = args.indexOf("--file");
const singleFile = fileIdx !== -1 ? args[fileIdx + 1] : null;

// ── Helpers ───────────────────────────────────────────────

/** Recursively collect all .md files under a directory. */
function collectMdFiles(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectMdFiles(full));
    } else if (entry.name.endsWith(".md")) {
      results.push(full);
    }
  }
  return results;
}

/** Split a file into { frontmatter, body } preserving the --- delimiters. */
function splitFrontmatter(text) {
  if (!text.startsWith("---")) return { frontmatter: "", body: text };
  const end = text.indexOf("\n---", 3);
  if (end === -1) return { frontmatter: "", body: text };
  const fmEnd = end + 4; // include the closing ---\n
  return {
    frontmatter: text.slice(0, fmEnd),
    body: text.slice(fmEnd),
  };
}

/** Detect whether the body is primarily Logseq bullet format. */
function isLogseqFormat(body) {
  const lines = body.split("\n").filter((l) => l.trim().length > 0);
  if (lines.length === 0) return false;

  let bulletLines = 0;
  for (const line of lines) {
    // Top-level bullets or indented bullets
    if (/^(\t*)- /.test(line) || /^(\t*)-$/.test(line)) {
      bulletLines++;
    }
    // Blockquote continuations inside bullets (tab-indented > lines)
    if (/^\t\s*>/.test(line)) {
      bulletLines++;
    }
    // Code block lines inside bullets (indented with tabs + spaces)
    if (/^\t\s{2,}/.test(line) && !/^\t- /.test(line)) {
      bulletLines++;
    }
  }

  return bulletLines / lines.length > 0.5;
}

/**
 * Determine if a file should be flagged for manual review.
 * Flags files with deep nesting that aren't linkblog/devblog.
 */
function shouldFlag(filePath, body) {
  const rel = path.relative(VAULT_DIR, filePath);
  const isLinkDevBlog =
    rel.startsWith("Linkblog/") || rel.startsWith("Devblog/");

  const lines = body.split("\n");
  let deepLines = 0;

  for (const line of lines) {
    const match = line.match(/^(\t+)/);
    if (match && match[1].length >= 3) deepLines++;
  }

  // Flag non-linkblog files with significant deep nesting
  if (!isLinkDevBlog && deepLines > 5) return true;

  // Flag files with many empty bullets used as separators
  const emptyBullets = lines.filter((l) => /^(\t*)-\s*$/.test(l)).length;
  if (emptyBullets > 3) return true;

  return false;
}

// ── Core conversion ───────────────────────────────────────

/**
 * Parse the body into a tree of { depth, content, children } nodes,
 * then serialize back to prose markdown.
 */
function convertBody(body) {
  const lines = body.split("\n");
  const output = [];

  let i = 0;
  while (i < lines.length) {
    const result = processLine(lines, i);
    i = result.nextIndex;
    if (result.text !== null) {
      output.push(result.text);
    }
  }

  // Clean up: collapse 3+ consecutive blank lines to 2
  let text = output.join("\n");
  text = text.replace(/\n{3,}/g, "\n\n");
  // Ensure single trailing newline
  text = text.replace(/\n*$/, "\n");
  return text;
}

/**
 * Process a single line (and potentially its continuation lines).
 * Returns { text, nextIndex }.
 */
function processLine(lines, i) {
  const line = lines[i];

  // Blank line — pass through
  if (line.trim() === "") {
    return { text: "", nextIndex: i + 1 };
  }

  // Empty bullet (`-` alone or `\t-` etc.) → blank line
  if (/^(\t*)-\s*$/.test(line)) {
    return { text: "", nextIndex: i + 1 };
  }

  // Detect bullet line
  const bulletMatch = line.match(/^(\t*)-\s(.*)$/);
  if (!bulletMatch) {
    // Not a bullet — pass through unchanged (prose, code fences, etc.)
    return { text: line, nextIndex: i + 1 };
  }

  const depth = bulletMatch[1].length; // number of tabs
  let content = bulletMatch[2];

  // Strip block reference IDs (^hex-uuid at end of line)
  content = content.replace(
    /\s*\^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    ""
  );

  // Strip @@html directives
  content = content.replace(/@@html:\s*/g, "").replace(/\s*@@$/g, "");

  // Handle blockquote bullet: `\t- > text`
  if (content.startsWith("> ") || content === ">") {
    let quote = content;
    // Gather continuation lines (indented > lines that aren't new bullets)
    let j = i + 1;
    while (j < lines.length) {
      const next = lines[j];
      // Continuation: same or deeper indent, starts with > (possibly after spaces)
      // Pattern: tabs + spaces + >
      if (/^(\t+)\s*>/.test(next) && !(/^(\t+)- /.test(next))) {
        // Strip the leading indentation, keep the > part
        const stripped = next.replace(/^\t+\s*/, "");
        quote += "\n" + stripped;
        j++;
      } else {
        break;
      }
    }
    return { text: "\n" + quote + "\n", nextIndex: j };
  }

  // Handle code block inside a bullet: `\t- ```lang`
  if (content.startsWith("```")) {
    let block = content;
    let j = i + 1;
    // Find the closing ``` — it'll be indented
    while (j < lines.length) {
      const next = lines[j];
      // Closing fence (possibly indented with tabs/spaces)
      const stripped = next.replace(/^\t+\s*/, "");
      block += "\n" + stripped;
      j++;
      if (stripped.startsWith("```") && block.split("\n").length > 1) {
        break;
      }
    }
    return { text: "\n" + block + "\n", nextIndex: j };
  }

  // Handle task markers: `- [ ] text` or `- [x] text` — keep as-is but de-bullet
  if (/^\[[ x]\]\s/.test(content)) {
    return { text: content, nextIndex: i + 1 };
  }

  // Regular content bullet — just emit the content
  return { text: "\n" + content, nextIndex: i + 1 };
}

// ── Main ──────────────────────────────────────────────────

function processFile(filePath) {
  const raw = fs.readFileSync(filePath, "utf-8");
  const { frontmatter, body } = splitFrontmatter(raw);

  if (!isLogseqFormat(body)) {
    return { skipped: true, reason: "not-logseq" };
  }

  const flagged = shouldFlag(filePath, body);
  const converted = convertBody(body);
  const newContent = frontmatter + "\n" + converted;

  // Normalize for comparison
  const changed = newContent !== raw;

  return { skipped: false, flagged, changed, original: raw, newContent };
}

function main() {
  const files = singleFile
    ? [path.resolve(singleFile)]
    : collectMdFiles(VAULT_DIR);

  let stats = {
    total: 0,
    skipped: 0,
    converted: 0,
    unchanged: 0,
    flagged: [],
  };

  for (const filePath of files) {
    stats.total++;
    const rel = path.relative(VAULT_DIR, filePath);
    const result = processFile(filePath);

    if (result.skipped) {
      stats.skipped++;
      continue;
    }

    if (!result.changed) {
      stats.unchanged++;
      continue;
    }

    if (result.flagged) {
      stats.flagged.push(rel);
    }

    stats.converted++;

    if (dryRun) {
      console.log(`\n${"=".repeat(60)}`);
      console.log(`FILE: ${rel}${result.flagged ? " [FLAGGED]" : ""}`);
      console.log("=".repeat(60));
      // Show a simple before/after diff
      const origLines = result.original.split("\n");
      const newLines = result.newContent.split("\n");
      console.log(`  Lines: ${origLines.length} → ${newLines.length}`);
      console.log(`--- BEFORE (first 30 lines of body) ---`);
      const { body: origBody } = splitFrontmatter(result.original);
      console.log(
        origBody
          .split("\n")
          .slice(0, 30)
          .map((l) => "  " + l)
          .join("\n")
      );
      console.log(`--- AFTER (first 30 lines of body) ---`);
      const { body: newBody } = splitFrontmatter(result.newContent);
      console.log(
        newBody
          .split("\n")
          .slice(0, 30)
          .map((l) => "  " + l)
          .join("\n")
      );
    } else {
      fs.writeFileSync(filePath, result.newContent, "utf-8");
      console.log(
        `  converted: ${rel}${result.flagged ? " [FLAGGED]" : ""}`
      );
    }
  }

  console.log(`\n${"─".repeat(40)}`);
  console.log(`Total files:  ${stats.total}`);
  console.log(`Skipped:      ${stats.skipped} (already prose)`);
  console.log(`Unchanged:    ${stats.unchanged}`);
  console.log(`Converted:    ${stats.converted}`);
  if (stats.flagged.length > 0) {
    console.log(`\nFlagged for review (${stats.flagged.length}):`);
    for (const f of stats.flagged) {
      console.log(`  ⚑ ${f}`);
    }
  }
}

main();
