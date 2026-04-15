# Linkblog Tab Grouping Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Restore grouped linkblog entry presentation by rewriting linkblog markdown files to use tab-indented continuation blocks under each top-level link.

**Architecture:** Keep rendering generic and Obsidian-native. Reuse the existing tab-indent behavior in `lib/remark-obsidian.mjs`, and convert linkblog entry source files into a convention where each top-level outbound link owns the following tab-indented commentary, quotes, and embeds until the next non-tabbed link line.

**Tech Stack:** Node.js scripts, Astro content files, custom remark pipeline, Chrome DevTools for visual verification.

---

### Task 1: Inspect representative linkblog files and lock down rewrite rules

**Files:**
- Read: `/Users/jack/vault/Garden/Linkblog/2025/06/04.md`
- Read: `/Users/jack/vault/Garden/Linkblog/**/*.md`
- Reference: `docs/plans/2026-03-18-linkblog-tab-grouping-design.md`

**Step 1: Read a representative file with mixed content**

Read `/Users/jack/vault/Garden/Linkblog/2025/06/04.md` and note all block types that appear after a top-level link:
- plain paragraphs
- blockquotes
- image embeds
- blank lines

**Step 2: Sample more linkblog files for edge cases**

Search `Linkblog/**/*.md` for:
- code fences
- multiple consecutive commentary paragraphs
- multiple embeds under one link
- existing tab-indented lines

Expected: a short list of patterns the rewrite script must preserve.

**Step 3: Write down the exact grouping rule**

Use this rule for the script:
- a non-tabbed markdown link line starts a new link item
- every following non-link block belongs to that item until the next non-tabbed markdown link line
- every owned block is rewritten with leading tabs, including blank separator lines inside the group

**Step 4: Stop if ambiguous cases appear**

If any file cannot be safely grouped by this rule, record it for manual review instead of guessing.

### Task 2: Add a dedicated linkblog rewrite script

**Files:**
- Create: `scripts/retab-linkblog.mjs`
- Reference: `scripts/delogseq.mjs`

**Step 1: Write the failing dry-run path first**

Create a script skeleton with CLI flags:

```js
#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VAULT_DIR = process.env.GARDEN_VAULT_PATH || path.resolve(__dirname, "../vault/Garden");
```

Support:
- `--dry-run`
- `--file <path>`

**Step 2: Implement frontmatter-safe file splitting**

Reuse the same pattern as `scripts/delogseq.mjs`:
- preserve frontmatter exactly
- operate only on the body

**Step 3: Implement minimal grouping detection**

Write a helper like:

```js
function isTopLevelLinkLine(line) {
  return /^\[[^\]]+\]\(https?:\/\/.+\)$/.test(line.trim());
}
```

Then iterate through body lines and build grouped sections.

**Step 4: Implement block indentation rules**

For content owned by the current link item:
- prefix non-empty lines with `\t`
- convert blank separator lines inside a group to `\t`
- preserve relative block structure for blockquotes and embeds

Example output:

```md
[Example](https://example.com)
	First note.
	
	> quote
	
	![[image.png]]
```

**Step 5: Preserve file formatting**

Normalize output to:
- exactly one blank line after frontmatter
- single trailing newline
- no trailing spaces

**Step 6: Print a useful dry-run summary**

Expected summary fields:
- files changed
- files skipped
- files flagged for manual review

### Task 3: Prove the script on one file first

**Files:**
- Test target: `/Users/jack/vault/Garden/Linkblog/2025/06/04.md`
- Modify: `scripts/retab-linkblog.mjs`

**Step 1: Run the script in dry-run mode on one file**

Run:

```bash
GARDEN_VAULT_PATH=/Users/jack/vault/Garden node scripts/retab-linkblog.mjs --dry-run --file /Users/jack/vault/Garden/Linkblog/2025/06/04.md
```

Expected: a readable preview or changed-file notice for that file only.

**Step 2: Inspect the rewritten output**

Verify the transformed body groups:
- Ryan Florence commentary under the Ryan Florence link
- Evan Hemsley quote and commentary under the Evan Hemsley link
- Lucid Blocks image under the Lucid Blocks link

**Step 3: Fix mis-grouping before wider rollout**

If any section attaches to the wrong parent link, adjust the grouping logic before touching more files.

**Step 4: Apply to the single file**

Run:

```bash
GARDEN_VAULT_PATH=/Users/jack/vault/Garden node scripts/retab-linkblog.mjs --file /Users/jack/vault/Garden/Linkblog/2025/06/04.md
```

Expected: the file is rewritten in place with tab-indented groups.

### Task 4: Verify rendering on the rewritten sample page

**Files:**
- Verify: `/Users/jack/vault/Garden/Linkblog/2025/06/04.md`
- Reference: `lib/remark-obsidian.mjs`

**Step 1: Restart Astro if remark behavior was changed**

If only content changed, hot reload is enough. If `lib/remark-obsidian.mjs` changed during debugging, fully restart the dev server and clear Astro/Vite caches.

**Step 2: Open the page locally**

Visit:

```bash
http://localhost:4321/linkblog/2025/06/04
```

Expected: each commentary cluster is visually nested under its link.

**Step 3: Compare against the desired feel**

Check that:
- the top-level links remain easy to scan
- the nested commentary feels grouped with its link
- quotes and image embeds stay visually attached to the correct link item

**Step 4: Fix any spacing regressions**

If the grouping works but spacing feels off, make a small renderer/style adjustment separately rather than weakening the content convention.

### Task 5: Run the script across all linkblog entries

**Files:**
- Modify: `/Users/jack/vault/Garden/Linkblog/**/*.md`
- Modify: `scripts/retab-linkblog.mjs`

**Step 1: Dry-run all linkblog files**

Run:

```bash
GARDEN_VAULT_PATH=/Users/jack/vault/Garden node scripts/retab-linkblog.mjs --dry-run
```

Expected: a count of all changed files and any manual-review candidates.

**Step 2: Review flagged files**

Open only the flagged files and decide whether to:
- support the pattern in the script
- or leave the file for manual editing

**Step 3: Apply the rewrite across linkblog**

Run:

```bash
GARDEN_VAULT_PATH=/Users/jack/vault/Garden node scripts/retab-linkblog.mjs
```

Expected: all safe linkblog files are rewritten in place.

**Step 4: Spot-check multiple pages**

Open at least:
- `/linkblog/2025/06/04`
- one page with an image embed
- one page with several quoted sections

Expected: grouping is consistent across all samples.

### Task 6: Add guardrails so future cleanup scripts do not flatten linkblog again

**Files:**
- Modify: `scripts/delogseq.mjs`
- Optionally modify: `WEBSITE.md`

**Step 1: Audit the existing cleanup assumptions**

Review whether `scripts/delogseq.mjs` or future content-cleanup notes assume linkblog should be flattened into plain prose.

**Step 2: Add a protective note or skip rule**

Add the smallest needed safeguard, for example:
- a comment documenting that linkblog now intentionally uses tab-indented grouping
- or a conditional that avoids flattening already-tabbed linkblog content

**Step 3: Record the convention in project docs**

Add a short note in `WEBSITE.md` if needed:
- linkblog entries group commentary beneath top-level links using tab-indented continuation lines

### Task 7: Verify and summarize the final state

**Files:**
- Verify: `scripts/retab-linkblog.mjs`
- Verify: `/Users/jack/vault/Garden/Linkblog/**/*.md`
- Verify: `docs/plans/2026-03-18-linkblog-tab-grouping-design.md`

**Step 1: Run the final verification commands**

Run:

```bash
GARDEN_VAULT_PATH=/Users/jack/vault/Garden node scripts/retab-linkblog.mjs --dry-run
```

Expected: zero pending rewrites for already-converted files.

Also verify the site locally by loading a few converted linkblog pages.

**Step 2: Summarize exactly what changed**

Capture:
- how many linkblog files were rewritten
- how many files needed manual review
- which pages were visually verified

**Step 3: Commit when explicitly requested**

If the user asks for a commit later, stage only the script, docs, and intended linkblog file changes.
