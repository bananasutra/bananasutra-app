# Apps Workspace

This folder isolates app prototyping from Airtable snapshot/pipeline tooling.

## Current App

- `banana-catalog-prototype/` - Phase-oriented SoundCloud-first catalog prototype.

### Catalog commands (repo root cheatsheet)

From **`BANANASUTRA-app`** (parent of `apps/`), the root `package.json` defines:

```bash
npm run catalog:data      # regenerate JSON only
npm run catalog:dev       # Vite dev server only
npm run catalog:data:dev  # data, then dev
```

See `banana-catalog-prototype/README.md` for full notes (including that `build:data` does not keep `localhost` alive; only `dev` does).

## Why This Layout

- Keeps app code separated from `pipelines/` and `AIRTABLE/` source-of-truth data.
- Supports phased delivery without touching data tooling until needed.
- Simplifies future GitHub setup (single app folder can be split or promoted later).

## Future GitHub Options

1. **Single repo root (recommended initially)**
   - Keep current structure and add git at root.
   - Track app + docs + pipelines together.
2. **App-first repo split (later)**
   - Move `apps/banana-catalog-prototype` into its own repository.
   - Keep this root as data/pipeline operations repo.
3. **Monorepo**
   - Keep `apps/` for UI and add `packages/` for shared data prep modules.

