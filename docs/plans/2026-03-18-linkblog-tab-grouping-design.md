# Linkblog Tab Grouping Design

Date: 2026-03-18
Status: Approved

## Goal

Restore the grouped feel of linkblog entries while keeping the source markdown natural to edit in Obsidian.

## Decision

Use a content convention for linkblog entries:

- Each outbound link stays at the top level.
- All commentary, quotes, and embeds that belong to that link are written as tab-indented continuation lines under it.
- The next non-tabbed line starts the next link item.

This uses the existing tab-indented continuation rendering instead of adding linkblog-specific rendering rules.

## Why This Approach

- Keeps linkblog files readable and structured in raw markdown.
- Feels native in Obsidian instead of bringing back Logseq-style bullets.
- Reuses the renderer behavior already added for tab-indented continuation lines.
- Avoids brittle heuristics that try to infer grouping from flat prose.

## Content Shape

Linkblog entries should follow this pattern:

```md
[Some Link](https://example.com)
	Commentary paragraph...

	> Quoted excerpt...

	More commentary.

	![[image.png]]

[Next Link](https://example.com)
	Commentary for the next item...
```

## Rendering Expectations

- Top-level links render at the normal content margin.
- Tab-indented continuation blocks render visually nested under the link.
- Quotes and embeds inside those tabbed sections stay attached to the parent link item.
- No new linkblog-specific page logic is needed.

## Migration Scope

- Update linkblog entry files to use tab-indented grouped sections.
- Prefer a scriptable rewrite for straightforward entries.
- Manually review entries with complex structure, especially multi-paragraph notes, quotes, and images.

## Migration Rules

- Preserve frontmatter exactly.
- Preserve top-level outbound link order.
- Indent all related commentary blocks with tabs.
- Keep blank lines inside a grouped section tab-indented so the group does not break.
- Treat the next non-tabbed line as the start of a new link item.

## Risks

- Blank lines inside an indented group can break grouping if they are not also tab-indented.
- Some entries may need manual cleanup where structure is ambiguous.
- Existing scripts that normalized prose may need to avoid flattening linkblog grouping in the future.

## Success Criteria

- Linkblog pages feel visually grouped again, similar to the earlier site.
- Raw markdown in Obsidian remains pleasant to author and scan.
- The existing tab-indent renderer is sufficient without special-case linkblog rendering.
