# jackharrhy.com — Agent Handoff Note

> This file exists to give a fresh agent session full context on where things stand.
> Written after a long session that completed the core Obsidian migration.

---

## Branch

`obsidian-time` — this is the active feature branch. Jack handles deployment.

---

## What This Is

A personal website (jackharrhy.dev) that was migrated from a Logseq-based build pipeline (Python `garden.py` + MDX) to one that reads an Obsidian vault directly. Content is plain `.md` files in the vault. The site is built with Astro 5, Tailwind CSS 3, and custom remark/rehype plugins.

**Live site for comparison:** https://jackharrhy.dev/

---

## Tech Stack

- **Framework**: Astro 5 (SSR, `@astrojs/node` standalone adapter)
- **Styling**: Tailwind CSS 3 + `@tailwindcss/typography`, Flexoki color palette
- **Content**: Astro Content Layer (`glob` loader) reading `vault/Garden/**/*.md`
- **Markdown**: Custom `lib/remark-obsidian.mjs` + `lib/rehype-obsidian.mjs`
- **Client**: htmx 2, Astro ClientRouter (view transitions), GoatCounter analytics
- **Assets**: `/asset/[...path].ts` — local vault in dev, Cloudflare R2 redirect in prod
- **Vault path**: Configured via `GARDEN_VAULT_PATH` env var (default `./vault/Garden`)

---

## Vault Location

The Obsidian vault lives at `/Users/jack/vault/` and is symlinked at `vault/` in the repo root (gitignored). The relevant subdirectory is `vault/Garden/`.

To run locally:

```sh
GARDEN_VAULT_PATH=/Users/jack/vault/Garden npm run dev
```

---

## Key Architecture Decisions

### Content Gating

**All** vault content is gated on `public: true` frontmatter. Enforced:

- `getCollection("garden", ({ data }) => data.public)` in `feeds.ts`
- `if (!entry || !entry.data.public)` → 404 in `Page.astro`
- `[...slug].astro` only generates static paths for public entries

### Component Injection in Markdown

Plain `.md` doesn't support MDX-style inline components. The solution:

1. In `remark-obsidian.mjs`, ` ```component ``` ` fenced blocks are parsed into `<x-componentname attr="val">` HTML elements.
2. In `Page.astro`, pages with component blocks are split via `splitIntoSegments()` — each prose chunk is run through the full `unified` pipeline, each component block is rendered as a real Astro component (`<Mug>`, `<Feed>`, `<FeedTree>`, `<Project>`, `<NowPlaying>`, `<Letterbird>`).
3. Pages with no component blocks use Astro's native `render(entry)` (faster).

Vault syntax:

````md
```component
Feed
source: linkblog
limit: 5
```
````

### OG Images in Frontmatter

Vault entries use Obsidian wikilink syntax in `og-image` frontmatter:

```yaml
og-image: "![[filename_123456789_0.jpg]]"
```

`resolveOgImage()` in `src/utils.ts` strips this to `/asset/filename_123456789_0.jpg`.

### Logseq-Style Content

Many vault entries (especially linkblog/devblog) still use Logseq block format (`- ` bullets for every paragraph). `rehype-obsidian.mjs` handles this by converting `<ul><li>` to `<p>` elements, with nested lists wrapped in `<div class="ml-8 mb-8">`.

---

## Recent Git Log

````
f3fa1ca fix: enforce public:true gate across all content queries
22751a6 fix: implement proper server-side component injection for markdown pages
fe2a454 fix: mug canvas init timing and id collision
5a383d0 feat: add component block support via ```component fenced blocks
038f8da fix: graceful handling when vault is absent, use mime for asset types
37b49f6 feat: port RSS feeds, tools pages, and infrastructure
3e22475 feat: port all components, layout, and page system from old site
12e961b feat: replace logseq-based site with obsidian-based foundation
````

---

## Current State — What Works

- ✅ Home page: Mug (picoCAD 3D), Feed (devblog + linkblog recents)
- ✅ About, Now, Projects pages (clean Obsidian markdown, rewritten from Logseq format)
- ✅ Linkblog index (`/linkblog`) — FeedTree with year/month/day hierarchy
- ✅ Devblog index (`/devblog`) — FeedTree
- ✅ Individual linkblog/devblog entries
- ✅ All other public garden pages via `[...slug].astro`
- ✅ RSS feeds: `/linkblog/rss.xml`, `/devblog/rss.xml`, `/posts/rss.xml`
- ✅ Tools: Last.fm page, YouTube thumbnail fetcher, tweet archiver (stub)
- ✅ Asset serving: `/asset/[...path]` → local vault in dev, R2 in prod
- ✅ Custom layouts: `quake`, `terminal`
- ✅ View transitions (Astro ClientRouter)
- ✅ Breadcrumb navigation
- ✅ Dockerfile, compose.yml, CI/CD (`.github/workflows/build-and-push.yml`)
- ✅ Build succeeds without vault (graceful degradation)

---

## Known Issues / Still To Do

### NowPlaying Widget

The `/tools/lastfm/now-playing` htmx endpoint works but requires `JACKHARRHY_LASTFM_API_KEY` in `.env`. Without it, the endpoint returns 204 silently. Set the key locally to test. The endpoint itself (`src/pages/tools/lastfm/now-playing.astro`) looks correct.

### Linkblog/Devblog Entry Layout

The `titlePartOfBreadcrumbs` logic in `Page.astro` uses the description as the H1 for linkblog/devblog entries (matching old site). The breadcrumb path should show `Linkblog / 2025 / 06 / 04` with the description as the page title. Verify this looks correct on an actual entry.

### Feed.astro Description Display

Currently the description renders inline after the date link in a `<>` fragment. Compare to the live site to ensure spacing/styling matches.

### FeedTree Styling

The `FeedTree` component renders `<details>`/`<summary>` elements. Compare `/linkblog` on localhost vs the live site — the tree structure may need styling tweaks (border colors, `shade-300` Tailwind classes should be in the Flexoki palette).

### Vault Pages Still in Logseq Block Format

The rewritten pages (Home, About, Now, Linkblog, Devblog, Projects) are now clean Obsidian markdown. However **all individual linkblog/devblog/posts entries** still use `- ` Logseq bullet format. The `rehype-obsidian.mjs` list-to-paragraph conversion handles this, but check that complex entries (nested bullets, blockquotes inside bullets) render correctly.

### `deslugify` for Devblog

`deslugify` in `feeds.ts` handles `devblog/<project>/YYYY/MM/DD` but `projectNameToBetterName` only has two projects (`quakeless-ii`, `narrows`). If new projects are added to the devblog, this map needs updating.

### Quake Page

`/quake` uses `custom_layout: quake` — verify it renders with the retro background image and correct inverted styling. The layout forces `data-astro-reload` on links to `/quake` (set in Layout.astro script) to bypass view transitions.

### Asset Sync Verification

Asset sync now uses `scripts/assets.ts` and `rclone`. Before production cutover, run `npm run assets:diff`, pull any files missing locally with `npm run assets:pull:missing`, and upload local-only assets with `npm run assets:copy:to-r2`.

### `utils.ts` — `slugify` function

The `slugify` function exists but doesn't appear to be used anywhere in the current codebase. May have been carried over unnecessarily.

### `public/favicon.ico`

There is both a `favicon.ico` and `favicon.svg` in `public/`. The layout references `favicon.svg`. The `.ico` file is likely a leftover.

---

## File Map (Key Files)

| File                                       | Purpose                                                 |
| ------------------------------------------ | ------------------------------------------------------- |
| `astro.config.mjs`                         | Astro config, registers remark/rehype plugins           |
| `src/content/config.ts`                    | Garden collection schema, vault path from env           |
| `lib/remark-obsidian.mjs`                  | Component blocks, wikilinks, media embeds, YouTube      |
| `lib/rehype-obsidian.mjs`                  | List-to-paragraph conversion (Logseq compat)            |
| `src/layouts/Layout.astro`                 | Full HTML shell, htmx, GoatCounter, view transitions    |
| `src/components/Page.astro`                | Core page renderer, component injection, breadcrumbs    |
| `src/components/Mug.astro`                 | picoCAD 3D spinning mug, uses `transition:persist`      |
| `src/components/Feed.astro`                | Flat recent post list (date + description)              |
| `src/components/FeedTree.astro`            | Hierarchical year/month/day tree with details/summary   |
| `src/components/NowPlaying.astro`          | htmx-powered Last.fm widget                             |
| `src/components/Project.astro`             | Project card (image, link, name, description, date)     |
| `src/feeds.ts`                             | Collection queries for linkblog/devblog, public-gated   |
| `src/utils.ts`                             | `resolveOgImage`, `createImageCustomData`, CORS helpers |
| `src/pages/index.astro`                    | Home page — uses `<Page id="home" header={false} />`    |
| `src/pages/[...slug].astro`                | Catch-all for all public garden entries                 |
| `src/pages/asset/[...path].ts`             | Asset proxy — local vault or R2 redirect                |
| `src/pages/linkblog/rss.xml.ts`            | Linkblog RSS with 8AM NST embargo                       |
| `src/pages/devblog/rss.xml.ts`             | Devblog RSS with 8AM NST embargo                        |
| `src/pages/tools/lastfm/now-playing.astro` | htmx partial, Last.fm API, returns 204 if not playing   |

---

## Vault Page Formats

### Pages with Components (use `splitIntoSegments` path)

- `Garden/Home.md` — Mug, NowPlaying, two Feed components
- `Garden/Linkblog.md` — FeedTree
- `Garden/Devblog.md` — FeedTree
- `Garden/Projects.md` — many Project components interspersed with headings

### Plain Markdown Pages (use native `render()` path)

- `Garden/About.md`, `Garden/Now.md`, `Garden/Contact.md`, etc.

### Logseq-Format Entries (handled by rehype-obsidian list→p conversion)

- All `Garden/Linkblog/YYYY/MM/DD.md` entries
- All `Garden/Devblog/<project>/YYYY/MM/DD.md` entries

---

## Environment Variables

See `.env.dist`. Key ones:

- `GARDEN_VAULT_PATH` — path to `vault/Garden` folder (default: `./vault/Garden`)
- `GARDEN_VAULT_ASSETS_PATH` — path to vault assets (default: `./vault/Assets`)
- `GARDEN_RCLONE_REMOTE` — rclone remote for the R2 bucket (default: `garden:jacks-garden`)
- `JACKHARRHY_LASTFM_API_KEY` — for NowPlaying widget

---

## Asset Sync

R2 asset sync is handled through `rclone` using `scripts/assets.ts`. The default remote matches the old Logseq pipeline: `garden:jacks-garden`.

Useful commands:

```sh
npm run assets:diff
npm run assets:missing:local
npm run assets:pull:missing
npm run assets:missing:remote
npm run assets:copy:to-r2
npm run assets:sync:to-r2:dry-run
npm run assets:sync:to-r2 -- --yes
```

Use `assets:pull:missing` to restore local dev parity from the production bucket. Use `assets:copy:to-r2` to upload local assets without deleting anything in R2. Use `assets:sync:to-r2` only when the local assets directory should be authoritative.
