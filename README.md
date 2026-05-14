# BANANASUTRA-app

Monorepo-style workspace: Airtable snapshots, pipelines, and the **banana-catalog-prototype** app under `apps/`.

## Local `_docs/` (gitignored on purpose)

The **`_docs/`** tree is listed in **`.gitignore`**: it is for **private / local planning** (runbooks, SEO notes, epics) that you keep on disk but **do not push** to GitHub. A **fresh clone has no `_docs/`**—that is expected, not a broken checkout. Git **does not delete** your local `_docs/` when you pull; it simply never tracks those paths.

If you maintain optional local runbooks under `_docs/`, common entry points include:

- `_docs/runbooks/AIRTABLE-SOURCE-OF-TRUTH-RUNBOOK.md`
- `_docs/runbooks/ARTIFACT-LIFECYCLE.md`
- `_docs/runbooks/LAUNCH-AND-CHANGE-HANDBOOK.md`
- `_docs/runbooks/README.md`

**In-repo (tracked) references:** catalog build and deploy are documented under **`apps/banana-catalog-prototype/README.md`**, **`apps/banana-catalog-prototype/docs/BUILD-ENV.md`**, and **`.github/workflows/pages.yml`**.

## Repo hygiene and safety

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
