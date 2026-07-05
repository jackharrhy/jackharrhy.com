# Migration TODO

Follow-up work from the local/prod debug review. Keep this as the repo-level migration punch-list; the public `/meta/todo` page can stay editorial/aspirational until it is cleaned up separately.

## Small Fixes

- [x] Clean up `@@html` handling in `vault/Garden/Workshops/2025/Astro-Workshop.md`.
  - Converted the Excalidraw iframe to plain HTML in the vault.
- [x] Fix `/linkblog/2025/03/29` formatting.
  - Quake links now render as a real list.
  - The long prompt beginning `Summarize the differences / similarities...` is now a blockquote.
  - `Source has really cool surf mechanics, how would I backport that to Quake II?` is now a blockquote.
- [x] Fix `/linkblog/2025/05/21` blockquote/media nesting.
  - Cursor screenshot now renders inside the blockquote.
- [x] Re-check code block rendering after content fixes.
  - Shiki highlighting is restored through `@astrojs/markdown-remark`.
  - `.astro-code .line { white-space: pre; }` preserves indentation visually.

## Route And Slug Parity

- [x] Fix `/meta/what--why` route parity.
  - Production route is `/what-and-why`.
  - Source moved to top-level `What & Why.md`; `&` is handled by canonical segment slugification.
- [x] Fix `/projects/stickertradeca` route parity.
  - Production route is `/projects/stickertrade-ca`.
  - `Projects/stickertrade.ca.md` now maps to `/projects/stickertrade-ca` through the shared `canonicalRouteId` helper.
  - Wikilinks like `[[Garden/Projects/stickertrade.ca]]` resolve through the vault index to the same canonical route.
- [x] Investigate `/posts/ive-lost-the-chance-to-become-a-senior-developer` visibility.
  - Set `vault/Garden/Posts/I've lost the chance to become a Senior Developer.md` to `public: false` to match production 404 behavior.

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

## `/things` Unburying

- [ ] Remove the `/things/` nesting for public topic pages without deleting content.
  - Current public pages include `CLI Utils`, `Web Dev`, `Design`, `Fonts`, `Game Dev`, and `Indieweb`.
  - Proposed canonical routes: `/cli-utils`, `/web-dev`, `/design`, `/fonts`, `/game-dev`, `/indieweb`.
- [ ] Merge duplicate topic content where needed.
  - Debug notes call out `/things/design`, `/things/fonts`, and `/things/game-dev` as pages to merge upward.
  - Check whether production already has top-level equivalents and use those as canonical shape.
- [ ] Make nested game-dev subpages private unless explicitly kept.
  - `/things/game-dev/interviews`: make private.
  - `/things/game-dev/resources`: make private.
- [ ] Decide what to do with non-reviewed private/misc topic pages.
  - `Things/Aesthetics/90s CGI.md`
  - `Things/ORMs.md`

## Technical Follow-Ups

- [x] Decide on canonical slug strategy.
  - Route ids now come through shared `canonicalRouteId` logic in `lib/garden-routing.mjs`.
  - Wikilinks resolve against a vault index from `lib/garden-routing.mjs` instead of guessing routes in `remark-obsidian`.
  - Global Markdown Obsidian transforms were removed from `astro.config.mjs`; page rendering uses the configured processor in `Page.astro`.
- [ ] Decide whether old/new path compatibility is needed anywhere.
  - Do not add one-off `.astro` redirects for migration parity.
  - Prefer central canonical route mapping at content ingestion time.
  - Revisit only if externally-linked legacy URLs need explicit compatibility.
- [ ] Refresh `WEBSITE.md` after the remaining migration work lands.
  - Current handoff still says Astro 5/Tailwind 3 and native render paths; the project is now Astro 6/Tailwind 4 and `Page.astro` uses `createMarkdownProcessor` for all prose segments.

## Done Recently

- [x] Restore syntax highlighting for code fences via `@astrojs/markdown-remark`.
- [x] Preserve Shiki indentation with `.astro-code .line { white-space: pre; }`.
- [x] Fix `.mov` embeds to render as playable `<video src="...mov">` without `type="video/mov"`.
- [x] Add local/prod debug compare notes API/UI.
- [x] Add asset sync tooling around `rclone`.
- [x] Broadly review and clean linkblog formatting/code-block indentation.
- [x] Remove breadcrumb parent-entry warning spam by avoiding missing `getEntry()` probes.
- [x] Exclude `404` from catch-all static paths so it does not conflict with `src/pages/404.astro`.
