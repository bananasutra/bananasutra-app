# BANANASUTRA-app

Monorepo-style workspace: Airtable snapshots, pipelines, and the **banana-catalog-prototype** app under `apps/`.

## `_docs/` (private, never on GitHub)

The **`_docs/`** directory is **gitignored on purpose**: local-only notes and planning. It is **not** missing by mistake after a clone, and it must **never** be committed or pasted into tracked files. Git does **not** remove your existing local `_docs/` on normal pulls. Cursor agents: see **`.cursor/rules/_docs-gitignored.mdc`**.

Shared documentation lives in **tracked** paths (this file, **`apps/banana-catalog-prototype/README.md`**, **`apps/banana-catalog-prototype/docs/`**, **`workers/seo-worker/README.md`**, **`.github/workflows/`**).

## Repo hygiene and safety

- **Agents — git / releases:** **`.cursor/rules/r50-git-guardrails.mdc`** (always applied) — Track 1 (prod) vs Track 2 (redesign on `r50-overhaul` / stage.bananasutra.com); forbidden merges; ask before `main`. Commands and merge subjects: **`.cursor/rules/git-release-workflow.mdc`**. Production merges must use subject `release: merge staging (<scope>)` — not Git’s default `Merge branch 'staging'`.
- **Optional — paste into Cursor User Rules** (applies outside this repo too):  
  `BANANASUTRA: feat/r#-<scope>` branches; ask before `staging → main`; production merge subject must be `release: merge staging (<scope>)` (first line only — GitHub Actions); never `Merge branch 'staging'`.
- Root `.gitignore` is the authoritative ignore policy for this workspace.
- Never commit `.env` secrets. Keep only `*.env.example` templates in git.
- Treat `apps/banana-catalog-prototype/src/data/generated/` and pipeline outputs as build artifacts; keep temporary exports under `backups/` or other disposable paths.
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
