# Build Environment Notes

## Workspace Boundaries

- App code lives in `apps/banana-catalog-prototype/`.
- Airtable source-of-truth remains in `AIRTABLE/snapshots/.../clean/`.
- Pipeline scripts remain in `pipelines/`.
- Catalog SC listen + SC cover fallbacks use **`AT-TRACKS-FULL-v4.csv`**, optional **`data/sc_catalog_listen_overrides.csv`**, and **`pipelines/sc/raw/bananasutra_sc_export.csv`**. Optional local notes: `_docs/runbooks/CATALOG-DATA-CYCLE-CHEATSHEET.md` (that tree is gitignored; see repo root `README.md`).

## Intentional Separation

This app should consume prepared JSON artifacts, not directly mutate pipeline outputs.

- Keep app runtime focused on fast filtering and rendering.
- Keep data shaping logic in dedicated scripts (phase-based, explicit inputs/outputs).
- Artifact builder script: `scripts/build_artifacts.py`.

### Run the artifact builder

From **repo root** (`BANANASUTRA-app`), either:

```bash
npm run catalog:data
```

or the explicit form:

```bash
npm run build:data --prefix "apps/banana-catalog-prototype"
```

`catalog:data` writes JSON under `src/data/generated/` **and** regenerates Bertrand's embedded catalog in `bbb-api/src/library-data.ts` (`npm run build:library` in `bbb-api/`). Ship both when committing a data release so the Worker knows new songs, tracks, and latest drops. It does **not** start the Vite dev server; use `npm run catalog:dev` (root) or `npm run dev --prefix "apps/banana-catalog-prototype"` when you want `localhost:5174` (or the port printed in the terminal if 5174 is taken).

**One-shot habit after refreshing snapshots:** `npm run catalog:data:dev` from repo root (regenerates catalog + BBB library, then starts dev).

**Full data-release + git workflow:** `docs/DATA-RELEASE-WORKFLOW.md`.

## Production deploy (static hosting)

Vite emits fingerprinted assets under `dist/assets/` (e.g. `song_catalog-*.json`, `index-*.js`). Configure your host or CDN to serve those files with **long-lived immutable caching** (`Cache-Control: public, max-age=31536000, immutable` or equivalent). HTML (`index.html`) should stay short-cache or no-cache so clients pick up new hashed filenames after each deploy.

## R31 Lighthouse notes (IDs 61 + 63)

### Deprecated API warnings from `/cdn-cgi/challenge-platform/*`

- Lighthouse "Deprecated APIs" entries such as `SharedStorage`, `Fledge`, and `StorageType.persistent` can appear with source `cdn-cgi/challenge-platform/.../main.js`.
- Those scripts are injected by Cloudflare challenge/security features and are **not** emitted by this app bundle.
- Repo code can document/acknowledge this, but fixing those specific warnings requires Cloudflare dashboard/security configuration changes (outside app code).

### Cloudflare cache policy checklist

Apply these rules in Cloudflare for the production zone:

1. Keep long immutable cache for `dist` assets (already expected):
   - `/assets/*`
   - `/fonts/*`
2. Add long cache for transformed image URLs:
   - `/cdn-cgi/image/*`
3. Add longer cache for static generated artifacts where acceptable:
   - `/catalog-data/*`
   - `/og/*`
4. Keep HTML routes (`/`, `/about/*`, `/songs/*`, etc.) on short cache/no-cache so new deploys are discoverable quickly.

The seo worker now also sets immutable cache headers on `/cdn-cgi/image/*` responses to prevent fallback to short platform defaults.

## Near-Term Directory Targets

- `src/features/catalog/` - song grid and card UI
- `src/features/filters/` - filter state and controls
- `src/features/detail/` - song detail and embedded playback
- `src/lib/` - shared types/helpers
- `src/data/` - local fixture artifacts during prototyping

## Future GitHub Notes

- This structure supports easy extraction into a standalone repo.
- Keep docs and scripts close to app code to preserve onboarding clarity.
