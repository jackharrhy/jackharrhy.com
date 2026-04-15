import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

import {
  isTopLevelLinkLine,
  rewriteLinkblogMarkdown,
  transformFileContents,
} from "./retab-linkblog.mjs";

test("isTopLevelLinkLine ignores space-indented links", () => {
  assert.equal(isTopLevelLinkLine("  [Example](https://example.com)"), false);
  assert.equal(isTopLevelLinkLine("[Example](https://example.com)"), true);
});

test("rewriteLinkblogMarkdown groups content under each top-level link", () => {
  const input = `---
public: true
description: sample
---

[Example One](https://example.com/one)

First paragraph.

> quoted line
>
> second line

![[image.png]]

[Example Two](https://example.com/two)

Second paragraph.
`;

  const expected = `---
public: true
description: sample
---

[Example One](https://example.com/one)
	First paragraph.
	
	> quoted line
	>
	> second line
	
	![[image.png]]
[Example Two](https://example.com/two)
	Second paragraph.
`;

  assert.equal(rewriteLinkblogMarkdown(input), expected);
});

test("transformFileContents preserves frontmatter and tabs blank lines inside groups", () => {
  const input = `---
title: Example
summary: keep me exactly
---

[Example](https://example.com)

Paragraph one.

Paragraph two.
`;

  const result = transformFileContents(
    "/tmp/Linkblog/2025/06/04.md",
    input,
    { explicit: true },
  );

  assert.equal(result.kind, "changed");
  assert.equal(
    result.content,
    `---
title: Example
summary: keep me exactly
---

[Example](https://example.com)
	Paragraph one.
	
	Paragraph two.
`,
  );
});

test("transformFileContents leaves arbitrary markdown unchanged in explicit file mode when there are no link groups", () => {
  const input = `---
title: Notes with custom spacing   
summary: keep body formatting as-is
---

# Heading

Paragraph with trailing spaces.   

- list item
- another item
`;

  const result = transformFileContents(
    "/tmp/random-note.md",
    input,
    { explicit: true },
  );

  assert.equal(result.kind, "unchanged");
  assert.equal(result.content, input);
});

test("transformFileContents leaves auto-scanned linkblog files unchanged when there are no link groups", () => {
  const input = `---
title: Notes with custom spacing   
summary: keep body formatting as-is
---

# Heading

Paragraph with trailing spaces.   

- list item
- another item
`;

  const result = transformFileContents(
    path.resolve(import.meta.dirname, "../vault/Garden/Linkblog/2025/06/04.md"),
    input,
  );

  assert.equal(result.kind, "unchanged");
  assert.equal(result.content, input);
});

test("transformFileContents preserves CRLF frontmatter bytes while rewriting the body", () => {
  const input =
    "---\r\n" +
    "title: Example\r\n" +
    "summary: keep these bytes\r\n" +
    "---\r\n" +
    "\r\n" +
    "[Example](https://example.com)\r\n" +
    "\r\n" +
    "Paragraph one.\r\n";

  const result = transformFileContents(
    "/tmp/Linkblog/2025/06/04.md",
    input,
    { explicit: true },
  );

  assert.equal(result.kind, "changed");
  assert.equal(
    result.content,
    "---\r\n" +
      "title: Example\r\n" +
      "summary: keep these bytes\r\n" +
      "---\r\n" +
      "\r\n" +
      "[Example](https://example.com)\n" +
      "\tParagraph one.\n",
  );
});

test("cli dry-run reports whether a file would change", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "retab-linkblog-"));
  const filePath = path.join(tempDir, "Linkblog", "2025", "06", "04.md");

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(
    filePath,
    `---
title: Example
---

[Example](https://example.com)

Paragraph.
`,
  );

  const output = execFileSync(
    process.execPath,
    ["scripts/retab-linkblog.mjs", "--dry-run", "--file", filePath],
    {
      cwd: path.resolve(import.meta.dirname, ".."),
      env: { ...process.env, GARDEN_VAULT_PATH: tempDir },
      encoding: "utf8",
    },
  );

  assert.match(output, /would change/i);
  assert.match(output, /Files changed:\s+1/);
});
