#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VAULT_DIR =
  process.env.GARDEN_VAULT_PATH || path.resolve(__dirname, "../vault/Garden");
const LINKBLOG_DIR = path.join(VAULT_DIR, "Linkblog");
const TOP_LEVEL_LINK_LINE = /^\[[^\]]+\]\(https?:\/\/.+\)$/;

function parseArgs(argv) {
  const args = argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const fileIndex = args.indexOf("--file");
  const filePath = fileIndex === -1 ? null : args[fileIndex + 1];

  if (fileIndex !== -1 && !filePath) {
    throw new Error("Missing value for --file");
  }

  return {
    dryRun,
    filePath: filePath ? path.resolve(filePath) : null,
  };
}

function collectMarkdownFiles(dir) {
  if (!fs.existsSync(dir)) {
    return [];
  }

  const files = [];

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...collectMarkdownFiles(fullPath));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(".md")) {
      files.push(fullPath);
    }
  }

  return files;
}

export function splitFrontmatter(text) {
  const match = text.match(/^---\r?\n[\s\S]*?\r?\n---(?=\r?\n|$)/);

  if (!match) {
    return { frontmatter: "", body: text };
  }

  const frontmatter = match[0];
  let body = text.slice(frontmatter.length);

  while (body.startsWith("\r\n") || body.startsWith("\n")) {
    body = body.startsWith("\r\n") ? body.slice(2) : body.slice(1);
  }

  return { frontmatter, body };
}

export function isTopLevelLinkLine(line) {
  return TOP_LEVEL_LINK_LINE.test(line.trimEnd());
}

function trimBlankEdges(lines) {
  let start = 0;
  let end = lines.length;

  while (start < end && lines[start].trim() === "") {
    start += 1;
  }

  while (end > start && lines[end - 1].trim() === "") {
    end -= 1;
  }

  return lines.slice(start, end);
}

function indentOwnedLine(line) {
  return line.startsWith("\t") ? line : `\t${line}`;
}

function normalizeBody(body) {
  return body.replace(/\r\n/g, "\n").replace(/ +$/gm, "");
}

export function rewriteBody(body) {
  const lines = trimBlankEdges(normalizeBody(body).split("\n"));

  if (lines.length === 0) {
    return "";
  }

  const output = [];
  let inGroup = false;
  let pendingBlank = false;
  let groupHasContent = false;

  for (const line of lines) {
    if (isTopLevelLinkLine(line)) {
      pendingBlank = false;
      groupHasContent = false;
      output.push(line.trim());
      inGroup = true;
      continue;
    }

    if (!inGroup) {
      output.push(line);
      continue;
    }

    if (line.trim() === "") {
      pendingBlank = groupHasContent;
      continue;
    }

    if (pendingBlank) {
      output.push("\t");
      pendingBlank = false;
    }

    output.push(indentOwnedLine(line));
    groupHasContent = true;
  }

  return output.join("\n");
}

function hasTopLevelLinkGroupingOpportunity(body) {
  const lines = trimBlankEdges(normalizeBody(body).split("\n"));
  let inGroup = false;

  for (const line of lines) {
    if (isTopLevelLinkLine(line)) {
      inGroup = true;
      continue;
    }

    if (!inGroup || line.trim() === "") {
      continue;
    }

    return true;
  }

  return false;
}

export function rewriteLinkblogMarkdown(text) {
  const { frontmatter, body } = splitFrontmatter(text);
  const rewrittenBody = rewriteBody(body);
  const separator = frontmatter.includes("\r\n") ? "\r\n" : "\n";

  if (frontmatter) {
    if (!rewrittenBody) {
      return `${frontmatter}${separator}`;
    }

    return `${frontmatter}${separator}${separator}${rewrittenBody}\n`;
  }

  return rewrittenBody ? `${rewrittenBody}\n` : "";
}

function isLinkblogMarkdownFile(filePath) {
  return filePath.endsWith(".md") && path.relative(LINKBLOG_DIR, filePath).startsWith("..") === false;
}

export function transformFileContents(filePath, raw, options = {}) {
  const explicit = options.explicit === true;

  if (!filePath.endsWith(".md")) {
    return { kind: "skipped", reason: "not-markdown" };
  }

  if (!explicit && !isLinkblogMarkdownFile(filePath)) {
    return { kind: "skipped", reason: "not-linkblog" };
  }

  const { body } = splitFrontmatter(raw);

  if (!hasTopLevelLinkGroupingOpportunity(body)) {
    return { kind: "unchanged", content: raw };
  }

  const content = rewriteLinkblogMarkdown(raw);

  if (content === raw) {
    return { kind: "unchanged", content };
  }

  return { kind: "changed", content };
}

function formatLabel(filePath) {
  if (isLinkblogMarkdownFile(filePath)) {
    return path.relative(VAULT_DIR, filePath);
  }

  return filePath;
}

export function run(argv = process.argv) {
  const { dryRun, filePath } = parseArgs(argv);
  const files = filePath ? [filePath] : collectMarkdownFiles(LINKBLOG_DIR);
  const stats = {
    changed: 0,
    skipped: 0,
    manualReview: 0,
  };

  for (const currentFile of files) {
    const raw = fs.readFileSync(currentFile, "utf8");
    const result = transformFileContents(currentFile, raw, { explicit: Boolean(filePath) });
    const label = formatLabel(currentFile);

    if (result.kind === "skipped") {
      stats.skipped += 1;

      if (dryRun) {
        console.log(`skip: ${label} (${result.reason})`);
      }

      continue;
    }

    if (result.kind === "unchanged") {
      if (dryRun) {
        console.log(`no change: ${label}`);
      }

      continue;
    }

    stats.changed += 1;

    if (dryRun) {
      console.log(`would change: ${label}`);
      continue;
    }

    fs.writeFileSync(currentFile, result.content, "utf8");
    console.log(`changed: ${label}`);
  }

  console.log(`Files changed: ${stats.changed}`);
  console.log(`Files skipped: ${stats.skipped}`);
  console.log(`Files flagged for manual review: ${stats.manualReview}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    run();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
