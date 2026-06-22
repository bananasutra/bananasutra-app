# Data release workflow (catalog + Bertrand)

Canonical checklist for refreshing Airtable snapshot data through production. **Cursor agents:** follow this end-to-end when Banana asks to ship a data update; she expects agents to handle branch, commit, merge, and push unless she says otherwise.

**Git track:** Track 1 only (`feat/r##-<scope>` → `staging` → `main`). See `.cursor/rules/r50-git-guardrails.mdc` and `.cursor/rules/git-release-workflow.mdc`.

---

## Two production deploy targets (same commit, different CI)

| Target | What updates | CI trigger |
|--------|----------------|------------|
| **Catalog site** (bananasutra.com) | `apps/banana-catalog-prototype/src/data/generated/*` | Push to `main` → GitHub Pages |
| **Bertrand** (`bbb-api` Worker) | `bbb-api/src/library-data.ts` | Push to `main` when `bbb-api/**` changed → `.github/workflows/deploy-bbb-api.yml` |

Bertrand does **not** read live catalog JSON at runtime. If you ship catalog JSON without regenerating and committing `library-data.ts`, the site shows new songs but Bertrand's "what's new?" answers stay stale.

---

## End-to-end steps

### 1. Export and clean Airtable snapshot

```bash
# Drop CSV exports into AIRTABLE/snapshots/YYYY-MM-DD/
python3 tools/clean_airtable_snapshot.py
# or: python3 tools/clean_airtable_snapshot.py AIRTABLE/snapshots/YYYY-MM-DD
```

If clean fails on unmapped headers, add variants to `HEADER_MAP` in `tools/clean_airtable_snapshot.py` first.

### 2. Run pipelines (when SC/YT source data changed)

```bash
cd pipelines/sc && python3 build_sc_final_v4.py
cd pipelines/yt && …   # YT scripts as needed
```

Re-import to Airtable if that is part of your cycle, then re-export snapshot.

### 3. Regenerate catalog + Bertrand library (repo root)

```bash
npm run catalog:data
```

Runs, in order:

1. `validate_snapshot.py`
2. `apps/banana-catalog-prototype/scripts/build_artifacts.py` → `src/data/generated/*`
3. `bbb-api` `build:library` → `bbb-api/src/library-data.ts`
4. Slug and genre audits

Optional local verification:

```bash
npm run catalog:data:dev          # regenerate, then Vite dev
npm run build --prefix apps/banana-catalog-prototype   # production build smoke test
```

### 4. Stage and commit (agents do this when Banana asks to ship)

**Include in the data-release commit:**

- `AIRTABLE/snapshots/YYYY-MM-DD/` (raw exports + `clean/`)
- `pipelines/**/outputs/` (AT CSVs, QA files, dated `archive/YYYY-MM-DD/` as produced)
- `apps/banana-catalog-prototype/src/data/generated/*`
- `apps/banana-catalog-prototype/scripts/song_slug_audit.csv` (if audit updated it)
- **`bbb-api/src/library-data.ts`** (must change when songs/tracks/videos changed)
- Pipeline/tool changes in the same session (`build_sc_final_v4.py`, `clean_airtable_snapshot.py`, etc.)

**Do not commit:**

- `_docs/` (gitignored, local only)
- `.env`, `.dev.vars`, secrets
- Scratch copies (`pipelines/YT-NEW-VIDEOS-QA.csv` at repo root, `QA - Sheet2.csv`, etc.)
- Superseded snapshot folders unless intentionally archiving both dates

**Sanity check before commit:** `library-data.ts` `latestDrops` refresh date and top songs should match newest `published_at` in `song_catalog.json`.

### 5. Git release (agents execute unless Banana says stop)

Banana's default: **agents create the branch, commit, merge to `staging`, push, and promote to `main` when she asks to push data live** (or confirms after local QA).

```bash
git checkout staging && git pull origin staging
git checkout -b feat/r##-<scope>    # e.g. feat/r54-sc-yt-data-refresh

# stage + commit
git commit -m "feat(data): R## …"   # or fix(bbb): … for library-only catch-up

git checkout staging && git pull origin staging
git merge --no-ff feat/r##-<scope> -m "merge feat/r##-<scope> (R## one-line summary)"
git push origin staging
git push -u origin feat/r##-<scope>

# Production (when Banana asked to ship live / push to git)
git checkout main && git pull origin main
git merge --no-ff staging -m "release: merge staging (R## one-line summary)"
git push origin main
git checkout staging && git pull origin staging
```

**Production merge subject (first line only):** `release: merge staging (R## one-line summary)` — never `Merge branch 'staging'`.

**When to pause before `main`:** Banana did not ask to ship live; W-074 `bbb-api` route changes that must wait for final R50; or you are unsure Track 1 vs Track 2.

### 6. Post-ship verification

**GitHub Actions**

- Pages deploy green (catalog)
- **Deploy BBB API** green when `bbb-api/**` was in the push

**Site:** https://bananasutra.com — spot-check new songs, listen links, one songbook.

**Bertrand:** ask "what's new?" — titles should match newest catalog drops, not an old refresh date in `library-data.ts`.

**Optional maintenance:** after data lands on `main`, merge `origin/main` into `r50-overhaul` so stage redesign stays current (see git-release-workflow.mdc).

---

## Agent responsibility summary

| Task | Who |
|------|-----|
| Run pipelines, `catalog:data`, local build/dev QA | Agent or Banana |
| Update `HEADER_MAP` / pipeline scripts when needed | Agent |
| Create `feat/r##-*`, commit, merge `staging`, push | **Agent** (default) |
| Promote `staging` → `main` when Banana asked to ship live | **Agent** (with explicit ask or clear "push live" instruction) |
| Promote `staging` → `main` without any ship intent | **Stop and ask** |
| Force-push `main` / `staging` | Only if Banana explicitly requests |

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|----------------|-----|
| Clean script exits on unknown header | Missing `HEADER_MAP` entry | Add mapping in `tools/clean_airtable_snapshot.py`, re-run clean |
| Bertrand lists old "latest" songs | Stale `library-data.ts` on Worker | `npm run build:library --prefix bbb-api`, commit, push `main` |
| Site updated, Bertrand did not | R54-style miss: catalog committed without `bbb-api/**` | Same as above; ensure `catalog:data` runs `build:library` (wired in root `package.json`) |
| Deploy BBB API did not run | No `bbb-api/**` changes in `main` push | Commit must include `library-data.ts` |

---

## Related docs

- `.cursor/rules/git-release-workflow.mdc` — merge subjects, R50 dual-track, agent data-release rules
- `.cursor/rules/r50-git-guardrails.mdc` — Track 1 vs Track 2 classification
- `bbb-api/README.md` — Bertrand library refresh and deploy
- `apps/banana-catalog-prototype/docs/BUILD-ENV.md` — artifact builder boundaries
