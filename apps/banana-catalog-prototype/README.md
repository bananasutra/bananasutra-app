# BANANASUTRA Catalog Prototype

SoundCloud-first, song-first exploration app workspace.

## Purpose

This app is the designated build environment for phased development of the BANANASUTRA catalog UI:

- Browse by `lyrics_title` and `lyrics_summary` (not raw SoundCloud EP lists).
- Filter by meaning (`sutra`, `topic`, `intention`, `light_shadow`) and track-level fusion genres (parsed SC `genres` tokens; facet key `track_genre`).
- Surface best track variants with embedded SoundCloud playback.

## Routes (IA-1)

| Path | Page |
|------|------|
| `/` | Home portal — discovery search (browse facets + tabbed previews); `/?q=` shareable |
| `/songs` | Filterable song catalog; optional `?find=` broad text match from discovery “See all” |
| `/search` | Redirects to `/?q=…` (legacy bookmarks) |
| `/about` | About / intent |
| `/songs/:slug` | Song detail + playback |

## Phase Scope

- **Phase A**: data contract, join validation, scaffold UI.
- **Phase B**: song grid with sort and filter controls.
- **Phase C**: detail view with embedded playback.
- **Phase D+**: creator QA overlays and YouTube-ready expansion.

See:

- `docs/PHASED-ROADMAP.md`
- `docs/BUILD-ENV.md`

## Cheatsheet (from repo root)

All commands below assume your shell’s current directory is **`BANANASUTRA-app`** (the repo root: the folder that contains `apps/` and the root `package.json`). They are shortcuts defined in that root `package.json`.

**`build:data` only regenerates JSON** (from the latest Airtable snapshot CSVs). It does **not** start a web server.

**SC catalog fallbacks** (no primary SC EP on the lyrics row): **`data/sc_catalog_listen_overrides.csv`** (optional) → **`pipelines/sc/outputs/AT-TRACKS-FULL-v4.csv`** → title match on **`pipelines/sc/raw/bananasutra_sc_export.csv`**. Re-scrape / rebuild pipelines when joins or SoundCloud titles change, then `npm run catalog:data`. (Optional local notes: `_docs/runbooks/CATALOG-DATA-CYCLE-CHEATSHEET.md` — that folder is gitignored; see repo root `README.md`.)

**`dev` starts Vite** on `http://localhost:5174` (see `vite.config.ts`; if that port is busy, Vite picks the next free port—check the terminal line `Local:`).

```bash
# Regenerate catalog JSON only
npm run catalog:data

# Dev server only (after data is already built)
npm run catalog:dev

# Regenerate data, then start dev (good habit when you refreshed snapshots)
npm run catalog:data:dev
```

First-time setup still installs dependencies **into this app folder**:

```bash
npm install --prefix "apps/banana-catalog-prototype"
```

## Equivalent (`--prefix` from repo root)

If you prefer not to use the root shortcuts:

```bash
npm install --prefix "apps/banana-catalog-prototype"
npm run dev --prefix "apps/banana-catalog-prototype"
npm run build:data --prefix "apps/banana-catalog-prototype"
npm run build --prefix "apps/banana-catalog-prototype"
```

## Build Data Artifacts

Generate song-first prototype artifacts from the latest clean Airtable snapshot (same as `npm run catalog:data` from root):

```bash
npm run build:data --prefix "apps/banana-catalog-prototype"
```

Outputs are written to:

- `src/data/generated/song_catalog.json` — one card per **`song_in_app`** lyric (`has_in_app_playback` when SC in-app tracks exist)
- `src/data/generated/song_detail.json`
- `src/data/generated/facets.json`

## Production build

```bash
npm run build --prefix "apps/banana-catalog-prototype"
```

This runs **`tsc` → `vite build` → OG image generation → `seo-metadata.json` → sitemap → catalog-data sync** (see `package.json` `build`). The **`dist/`** folder (including **`dist/og/*.png`**) is **gitignored**; it is produced on each machine and on **GitHub Actions** (`.github/workflows/pages.yml` runs `npm run build` then `npm run verify:seo` before uploading `apps/banana-catalog-prototype/dist` to Pages). You do not commit `dist/`—the deploy pipeline is the source of built assets.

**Preview vs production-shaped HTML:** With Vite’s default **`appType: 'spa'`**, **`vite preview`** applies SPA fallback: HTML requests that do not match a file under `dist/` are rewritten to **`dist/index.html`**. Pre-rendered routes live at **`dist/<path>/index.html`** (for example **`dist/songs/<slug>/index.html`**), so **View Source on deep URLs after `npm run preview` can show the home shell** even though the prerendered files on disk are correct. For QA that matches static hosting (no SPA `--single`), serve `dist/` with **`npm run preview:dist`** (uses **`serve`** without `-s`). If a given host differs on trailing slashes (`/about` vs `/about/`), compare behavior to **GitHub Pages**.

**OG layout changes:** incremental skips avoid refetching every cover on every build. For a full re-render after editing `scripts/ogSongCard.mjs`, use **`npm run build:fresh-og`** (same as `FORCE_OG=1 npm run build`) or delete `dist/og` locally, then build. **`npm run og:samples`** writes review PNGs under **`og-samples/`** (also gitignored).

**Required in git:** `scripts/ogSongCard.mjs`, `scripts/generate-og-images.mjs`, and `scripts/preview-og-samples.mjs` must be committed so CI can run the OG step.

**Cloudflare Worker (not part of Pages):** deploy from **`workers/seo-worker`** — see **`workers/seo-worker/README.md`** for the full Pages + Worker checklist.

## Suggested Future GitHub Setup

When you initialize git, this app is already isolated and can be:

- tracked as part of the root repo, or
- moved into its own repo with minimal path changes.
