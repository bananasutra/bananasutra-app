# BANANASUTRA-app

Monorepo-style workspace: Airtable snapshots, pipelines, and the **banana-catalog-prototype** app under `apps/`.

## Workflow source of truth

For all data operations, use:

- `/_docs/runbooks/AIRTABLE-SOURCE-OF-TRUTH-RUNBOOK.md` (single "what to run when")
- `/_docs/runbooks/ARTIFACT-LIFECYCLE.md` (what is canonical vs temporary)
- `/_docs/runbooks/LAUNCH-AND-CHANGE-HANDBOOK.md` (GitHub + staging/production + change management)
- `/_docs/runbooks/README.md` (the short index of active docs only)

## Repo hygiene and safety

- Root `.gitignore` is the authoritative ignore policy for this workspace.
- Never commit `.env` secrets. Keep only `*.env.example` templates in git.
- Treat the files listed in `/_docs/runbooks/ARTIFACT-LIFECYCLE.md` as canonical; temporary files should stay in temporary paths or backups.
- Keep root tidy: avoid one-off exports at repo root, and place ad-hoc exports in `backups/`.

## Catalog prototype — command cheatsheet

Run from **this directory** (repo root):

```bash
# Regenerate catalog JSON only
npm run catalog:data
# same as: npm run build:data

# Dev server only (after data is already built)
npm run dev
# same as: npm run catalog:dev

# Regenerate data, then start dev (good habit when you refreshed snapshots)
npm run catalog:data:dev
```

- **`catalog:data`** / **`build:data`** runs Python and writes JSON under `apps/banana-catalog-prototype/src/data/generated/`. It does **not** start a web server.
- **`dev`** / **`catalog:dev`** starts Vite on **http://localhost:5173**. Keep that terminal open while you use the site.

First-time install for the app:

```bash
npm install --prefix "apps/banana-catalog-prototype"
```

More detail: `apps/banana-catalog-prototype/README.md` and `apps/banana-catalog-prototype/docs/BUILD-ENV.md`.
