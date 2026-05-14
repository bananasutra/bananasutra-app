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

`catalog:data` only writes JSON under `src/data/generated/`. It does **not** start the Vite dev server; use `npm run catalog:dev` (root) or `npm run dev --prefix "apps/banana-catalog-prototype"` when you want `localhost:5174` (or the port printed in the terminal if 5174 is taken).

**One-shot habit after refreshing snapshots:** `npm run catalog:data:dev` from repo root (regenerates data, then starts dev).

## Production deploy (static hosting)

Vite emits fingerprinted assets under `dist/assets/` (e.g. `song_catalog-*.json`, `index-*.js`). Configure your host or CDN to serve those files with **long-lived immutable caching** (`Cache-Control: public, max-age=31536000, immutable` or equivalent). HTML (`index.html`) should stay short-cache or no-cache so clients pick up new hashed filenames after each deploy.

## Near-Term Directory Targets

- `src/features/catalog/` - song grid and card UI
- `src/features/filters/` - filter state and controls
- `src/features/detail/` - song detail and embedded playback
- `src/lib/` - shared types/helpers
- `src/data/` - local fixture artifacts during prototyping

## Future GitHub Notes

- This structure supports easy extraction into a standalone repo.
- Keep docs and scripts close to app code to preserve onboarding clarity.
