# Contributing to BANANASUTRA-app

## `_docs/` — read this first

**The `_docs/` directory is intentionally gitignored.** It holds **private, local-only** planning (SEO epics, QA CSVs, runbooks). It is **not** missing by accident, **not** something to "add to the repo", and **not** something to remove from `.gitignore`.

- After a **fresh clone**, `_docs/` will **not** exist. That is **normal**.
- Git **does not delete** your existing local `_docs/` when you pull; it simply **never uploads** those paths.

All **shared** documentation for collaborators and CI belongs in **tracked** paths (for example `README.md`, `apps/banana-catalog-prototype/README.md`, `apps/banana-catalog-prototype/docs/`, `workers/seo-worker/README.md`, `.github/workflows/`).

See the root **`README.md`** section **"Local `_docs/` (gitignored on purpose)"** for the full explanation.
