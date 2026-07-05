# Obsidian Migration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Migrate jackharrhy.com from the Logseq-based `site/` to the Obsidian-based `tmp/new-website/`, achieving feature parity and then replacing the old site entirely.

**Architecture:** The new site reads Obsidian `.md` files directly via Astro's Content Layer glob loader (no Python pipeline). Custom remark/rehype plugins handle Obsidian syntax (wikilinks, embeds). The same Tailwind+Flexoki design system, asset-serving strategy (R2 CDN), and hybrid SSR/SSG rendering model are retained.

**Tech Stack:** Astro 5, TypeScript, Tailwind CSS 3 + Flexoki palette, custom unified/remark/rehype plugins, htmx, @astrojs/node, @astrojs/rss, Cloudflare R2

**Branch:** `obsidian-time`

---

## Phase 1: Clean Up New Site Foundation

### Task 1: Promote new-website to repo root, remove old site

The new site in `tmp/new-website/` becomes the main project. The old `site/` directory and Python pipeline are removed.

**Files:**

- Delete: `tmp/new-website/lib/quartz-plugins/` (entire directory — reference copy of Quartz, never used)
- Delete: `tmp/new-website/lib/remark-obsidian-wikilinks.mjs` (superseded)
- Delete: `tmp/new-website/lib/remark-obsidian-images.mjs` (superseded)
- Delete: `tmp/new-website/lib/remark-lists-to-paragraphs.mjs` (superseded)
- Delete: `tmp/new-website/test-plugin.mjs`, `tmp/new-website/test-plugin2.mjs`, `tmp/new-website/test-youtube.mjs` (dev artifacts)
- Delete: `tmp/new-website/src/pages/test.astro` (diagnostic page)
- Delete: `tmp/new-website/docs/` (outdated process artifacts from initial dev sessions)
- Delete: `tmp/new-website/scripts/` (one-time frontmatter fix scripts)
- Move: `tmp/new-website/*` → repo root (replacing `site/`)
- Delete: `site/` (old Logseq-based site)
- Delete: `garden.py`, `pyproject.toml`, `uv.lock`, `.python-version` (Python pipeline)
- Delete: `assets-staging/` reference in `.gitignore` if present
- Keep: `logseq/` directory reference in `.gitignore` (may still be useful)

**Step 1:** Remove dead files from `tmp/new-website/`

**Step 2:** Copy the new site to repo root as the `site/` directory structure (or directly to root — match whatever makes sense for the Dockerfile)

**Step 3:** Remove old `site/`, `garden.py`, `pyproject.toml`, `uv.lock`, `.python-version`

**Step 4:** Copy static assets from old `site/public/` that are still needed: `favicon.svg`, `images/quake-bg.png`, `rss/styles/general.xsl`, `rss/styles/general.css`

**Step 5:** Update `astro.config.mjs` — add `site: 'https://jackharrhy.dev'`

**Step 6:** Update content collection config — the `base` path (`/workspace/extra/vault/Garden`) needs to be configurable via env var or use a relative path. For now, make it an env var `GARDEN_VAULT_PATH` with a sensible default.

**Step 7:** Commit: "feat: replace logseq site with obsidian-based site"

---

## Phase 2: Port the Layout & Page Component

### Task 2: Port the full Layout from old site

The new `BaseLayout.astro` is minimal. The old `Layout.astro` has many features that need porting.

**Files:**

- Modify: `src/layouts/Layout.astro` (the new BaseLayout, renamed)

**Port these features from old Layout.astro:**

- Full props interface: `title`, `description`, `noFooter`, `ogImage`, `width`, `mainClass`, `invert`, `mobileFriendly`
- Custom fonts (Virgil, Cascadia) from excalidraw.com
- htmx loading + `astro:page-load` reprocessing
- GoatCounter analytics script
- Phosphor Icons CSS
- RSS `<link>` alternates (linkblog, posts, devblog, piclog.blue, status.cafe)
- OG meta tags (`og:title`, `og:description`, `og:image`)
- Astro ClientRouter with `fallback="none"` for view transitions
- Conditional viewport meta (mobileFriendly prop)
- Header with conditional Mug component (shown when title is present)
- Footer with conditional rendering (noFooter prop)
- Width/invert/mainClass support on the prose container
- Script to add `data-astro-reload` to `/quake` links

**Step 1:** Rename `BaseLayout.astro` → `Layout.astro`, port all props and head content

**Step 2:** Commit: "feat: port full layout with htmx, analytics, view transitions"

### Task 3: Port the Page component

The old site has a `Page.astro` component that handles all garden content rendering — breadcrumbs, custom layouts, component injection. The new site's `[...slug].astro` has basic breadcrumbs inline but is missing custom layout support and component injection.

**Files:**

- Create: `src/components/Page.astro`
- Modify: `src/pages/index.astro` — use `<Page id="home" header={false} />`
- Modify: `src/pages/[...slug].astro` — simplify to use `<Page>`
- Delete: `src/pages/about.astro`, `src/pages/now.astro`, `src/pages/projects.astro` — the catch-all handles these now

**Port from old Page.astro:**

- Custom layout switching (`quake`, `terminal`) with all their class overrides
- `titlePartOfBreadcrumbs` for devblog/linkblog entries
- Breadcrumb generation from entry ID segments
- Component injection into `<Content>`: `{ Mug, Project, Feed, FeedTree, Image, NowPlaying }`
- Description display for non-feed entries
- Title size adjustment for long titles (>120 chars)

**Key difference:** Old site uses `entry.data.name` for breadcrumbs (set by garden.py). New site needs to derive the display name from the entry `id` (file path), since Obsidian files don't have a `name` frontmatter field. The `id` is already the path like `linkblog/2025/03/15`.

**Step 1:** Create `Page.astro` with all features

**Step 2:** Simplify page files to use it

**Step 3:** Commit: "feat: port Page component with custom layouts and breadcrumbs"

---

## Phase 3: Port Components

### Task 4: Port the Mug component

**Files:**

- Create: `src/components/Mug.astro` (from old site)
- Create: `src/components/Mug/pico-cad-viewer.js` (copy from old site)
- Create: `src/components/Mug/cuppa.txt` (copy from old site)

**Step 1:** Copy all three files from `site/src/components/Mug*` to new `src/components/`

**Step 2:** Commit: "feat: port 3D mug component"

### Task 5: Port the Feed and FeedTree components

**Files:**

- Create: `src/feeds.ts` (from old `site/src/feeds.ts`)
- Create: `src/components/Feed.astro` (from old site)
- Create: `src/components/FeedTree.astro` (from old site)

**Key adaptation:** The old `feeds.ts` uses `entry.data.name` which was set by garden.py. In the new site, the entry `id` is the file path (e.g., `linkblog/2025/03/15`). The feed functions filter by `entry.id.startsWith(...)` which should work the same way since Astro's glob loader generates IDs from file paths.

The `deslugify` function needs to work with IDs instead of slugified names, but since the old site's IDs were already paths like `linkblog/2025/03/15`, this should be compatible.

**Step 1:** Copy and adapt `feeds.ts` — keep the same logic, just verify it works with the glob loader's ID format

**Step 2:** Copy `Feed.astro` and `FeedTree.astro`

**Step 3:** Commit: "feat: port feed components and utilities"

### Task 6: Port the Project component

**Files:**

- Create: `src/components/Project.astro` (from old site)

**Step 1:** Copy from old site (it has no dependencies beyond props)

**Step 2:** Commit: "feat: port project card component"

### Task 7: Port the NowPlaying component and Last.fm endpoint

**Files:**

- Create: `src/components/NowPlaying.astro` (from old site)
- Create: `src/pages/tools/lastfm.astro` (from old site)
- Create: `src/pages/tools/lastfm/now-playing.astro` (from old site)

**Step 1:** Copy all three files. The htmx dependency is loaded in the Layout (Task 2).

**Step 2:** Commit: "feat: port now-playing widget and last.fm endpoint"

### Task 8: Port the Spinner component

**Files:**

- Create: `src/components/Spinner.astro` (from old site)

**Step 1:** Copy from old site

**Step 2:** Commit: "feat: port spinner component"

---

## Phase 4: Port RSS Feeds & Utilities

### Task 9: Port utilities and RSS infrastructure

**Files:**

- Create: `src/utils.ts` (from old `site/src/utils.ts`)
- Add dependency: `@astrojs/rss`

**Step 1:** Copy `utils.ts`, install `@astrojs/rss`: `npm install @astrojs/rss`

**Step 2:** Commit: "feat: add utilities and RSS dependency"

### Task 10: Port RSS feed endpoints

**Files:**

- Create: `src/pages/linkblog/rss.xml.ts` (from old site)
- Create: `src/pages/devblog/rss.xml.ts` (from old site)
- Create: `src/pages/posts/rss.xml.ts` (from old site)

**Key adaptation:** The old feeds reference `post.data.ogImage` — in the new schema this is `post.data['og-image']`. Update accordingly.

**Step 1:** Copy all three RSS endpoints, adapt frontmatter field names

**Step 2:** Copy RSS stylesheet files to `public/rss/styles/` (general.xsl, general.css)

**Step 3:** Commit: "feat: port RSS feeds for linkblog, devblog, posts"

---

## Phase 5: Port Tools Pages

### Task 11: Port YouTube thumbnail fetcher

**Files:**

- Create: `src/pages/tools/youtube-thumbnail-fetcher.astro` (from old site)
- Create: `src/pages/tools/youtube-thumbnail-fetcher/fetch.astro` (from old site)

**Step 1:** Copy both files

**Step 2:** Commit: "feat: port youtube thumbnail fetcher tool"

### Task 12: Port tweet archiver (stub)

**Files:**

- Create: `src/pages/tools/tweet-archiver.astro` (from old site)
- Create: `src/pages/tools/tweet-archiver/archive.astro` (from old site)

**Step 1:** Copy both files (the archive endpoint is already stubbed in old site)

**Step 2:** Add `cheerio` dependency: `npm install cheerio`

**Step 3:** Commit: "feat: port tweet archiver tool (stub)"

---

## Phase 6: Infrastructure

### Task 13: Port Dockerfile and compose.yml

**Files:**

- Create: `Dockerfile` (adapted from old site — paths change since site is no longer in `site/` subdir)
- Create: `compose.yml` (from old site)

**Step 1:** Adapt Dockerfile — the new site is at repo root, not `site/` subdirectory. Update COPY paths accordingly.

**Step 2:** Copy `compose.yml` from old site

**Step 3:** Commit: "feat: add Docker build and compose configuration"

### Task 14: Port GitHub Actions CI/CD

**Files:**

- Modify: `.github/workflows/build-and-push.yml` (adapt paths for new structure)

**Step 1:** Update the workflow — paths no longer include `site/` prefix

**Step 2:** Commit: "feat: update CI/CD for new site structure"

### Task 15: Update .gitignore and environment config

**Files:**

- Modify: `.gitignore` — remove old site entries, add new ones (node_modules, dist, .astro, .env)
- Create: `.env.dist` — document required env vars (R2 creds, Last.fm API key, GARDEN_VAULT_PATH)

**Step 1:** Update `.gitignore`

**Step 2:** Create `.env.dist` with all required env vars

**Step 3:** Commit: "chore: update gitignore and environment config"

### Task 16: Port justfile

**Files:**

- Modify: `justfile` — update commands for new site structure

**Step 1:** Adapt justfile recipes (remove `garden.py` references, update paths)

**Step 2:** Commit: "chore: update justfile for new site structure"

---

## Phase 7: Content Collection Schema Alignment

### Task 17: Align content schema between old and new frontmatter conventions

The old site used `garden.py` to set frontmatter fields like `name`, `customLayout`, `ogImage` (camelCase). The Obsidian vault uses `custom_layout` / `custom-layout`, `og-image` (kebab-case). The content config schema needs to handle both gracefully and the Page component needs to read the right fields.

**Files:**

- Modify: `src/content/config.ts` — ensure schema handles Obsidian frontmatter conventions
- Modify: `src/components/Page.astro` — read `custom_layout` or `custom-layout` instead of `customLayout`

**Step 1:** Audit which frontmatter fields the Obsidian vault actually uses vs what the old site expected. Add a `z.union` or coalesce in the Page component where field names differ.

**Step 2:** Commit: "fix: align content schema with obsidian frontmatter conventions"

---

## Phase 8: Final Cleanup

### Task 18: Remove old site artifacts

**Files:**

- Delete: `tmp/` directory (the new-website source is now at repo root)
- Delete: any remaining Python/Logseq artifacts
- Clean up: `package.json` name field, any stale references

**Step 1:** Remove `tmp/`, verify no remaining old-site references

**Step 2:** Commit: "chore: remove migration artifacts"

### Task 19: Verify build

**Step 1:** Run `npm install`

**Step 2:** Run `npm run build` (will need GARDEN_VAULT_PATH set, may fail without vault — that's OK, verify the build process itself works)

**Step 3:** Fix any build errors

**Step 4:** Commit any fixes: "fix: resolve build issues"

---

## Deprecated / Removed (for reference)

These files from the old site are **intentionally not ported** because they're replaced by the Obsidian-based approach:

| Old File                                       | Reason for Removal                                    |
| ---------------------------------------------- | ----------------------------------------------------- |
| `garden.py` (783 lines)                        | Replaced by direct Obsidian vault reading             |
| `pyproject.toml`, `uv.lock`, `.python-version` | No more Python runtime                                |
| `site/src/data/garden/*.mdx`                   | Generated artifacts — content lives in Obsidian vault |
| `remark-wiki-link` dependency                  | Replaced by custom `remark-obsidian.mjs`              |
| `@astrojs/mdx` integration                     | Content is `.md` not `.mdx` now                       |
| `astro-meta-tags` integration                  | OG tags are manually set in Layout                    |
| `logseq/` directory                            | No longer the content source                          |

---

## Notes

- **Content path:** The vault path in `content/config.ts` needs to be configurable. In the old container environment it was `/workspace/extra/vault/Garden`. On Jack's Mac it'll be different. Use an env var.
- **Asset path:** Similarly, the asset serving endpoint reads from a local path in dev. This needs to be configurable.
- **The `name` field:** The old site had `entry.data.name` set by `garden.py` (e.g., `"Linkblog/2025/03/15"`). The new site doesn't have this — it has `entry.id` which is the file path. The Page component and feed utilities need to use `entry.id` instead of `entry.data.name` for display name generation and breadcrumbs.
- **MDX vs MD:** Old content was `.mdx` (allowing inline JSX components like `<Mug />`). New content is `.md`. Components that were used inline in MDX (Mug, Feed, FeedTree, Project, NowPlaying) won't work the same way in plain markdown. Need to figure out how these are referenced — likely via frontmatter `component` field and rendered by `Page.astro` conditionally, rather than inline in content.
