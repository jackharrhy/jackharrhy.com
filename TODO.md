# Migration TODO

Follow-up work from the local/prod debug review. Keep this as the repo-level migration punch-list; the public `/meta/todo` page can stay editorial/aspirational until it is cleaned up separately.

## Content Page Rework

- [ ] Update `/meta/how-this-is-built`.
  - Current copy still describes the old Logseq pipeline.
  - Rewrite around the Obsidian vault, Astro content collection, `remark-obsidian`, `rehype-obsidian`, asset proxy/R2, and component fenced blocks.
- [ ] Clean up `/meta/todo`.
  - Mark completed items with strikethrough so Jack can review.
  - Keep or split aspirational ideas separately from migration cleanup.
- [ ] Reformat `/newfoundland/st-johns/third-spaces`.
  - Production/Logseq version was heavily indented.
  - Likely needs the same style of separator/list-to-section cleanup done for linkblog entries.
- [ ] Major rework `/quake`.
  - Production has heavy indentation and local needs substantial structure work.
  - Decide whether to split into multiple pages or section it in-place.
  - Preserve `custom_layout: quake` or replace with a more maintainable layout if the content becomes multi-page.

## Technical Follow-Ups

- [ ] Decide whether old/new path compatibility is needed anywhere.
  - Do not add one-off `.astro` redirects for migration parity.
  - Prefer central canonical route mapping at content ingestion time.
  - Revisit only if externally-linked legacy URLs need explicit compatibility.
- [ ] Refresh `WEBSITE.md` after the remaining migration work lands.
  - Current handoff still says Astro 5/Tailwind 3 and native render paths; the project is now Astro 6/Tailwind 4 and `Page.astro` uses `createMarkdownProcessor` for all prose segments.
