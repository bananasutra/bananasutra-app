# SEO Worker (`bananasutra-com-seo`)

Cloudflare Worker that sits **in front of GitHub Pages** for `bananasutra.com` and `www.bananasutra.com`. It:

- Returns **200** with the SPA shell for deep links that would otherwise 404 at the static origin.
- For **known bot / preview user-agents**, injects **per-route** `<title>`, `meta`, `og:*`, `twitter:*`, and `canonical` from cached `https://bananasutra.com/seo-metadata.json`.

Routes are declared in `wrangler.toml` (`bananasutra.com/*`, `www.bananasutra.com/*`).

---

## End-to-end release (catalog + OG + Worker) — Phase 4 and later

Order matters: **origin (Pages) must serve new static files before you rely on them in production.** The Worker does not build OG images; it only reads HTML/JSON from your site.

### 1. Ship the static site (GitHub Actions → GitHub Pages)

1. Merge to **`main`** (your `.github/workflows/pages.yml` runs on pushes that touch `apps/banana-catalog-prototype/**`).
2. In GitHub: **Actions** → **Deploy BANANASUTRA Pages** → wait for **green** (install → `npm run build` → `npm run verify:seo` → upload `dist/`).
3. Confirm the live site serves new assets, for example:
   - `https://bananasutra.com/seo-metadata.json` (first lines should show recent `generatedAt` after deploy propagates).
   - `https://bananasutra.com/og/site.png` and a sample `https://bananasutra.com/og/songs/<slug>.png` (HTTP 200, correct `content-type`).

**GitHub repo settings (one-time / when domain changes):** Pages **custom domain** and **Enforce HTTPS** should match how DNS is set up. DNS records (apex + `www`) normally point at Cloudflare; Cloudflare proxies to GitHub Pages (`*.github.io` or the Pages load balancer per GitHub’s current docs).

### 2. Deploy the Worker (Cloudflare Wrangler)

Do this **whenever Worker code changes** (`src/`, `wrangler.toml`, bot list, etc.). If you **only** changed catalog content/OG PNGs/`seo-metadata.json` and **did not** change the Worker, you usually **do not** need a Worker redeploy—the next fetch of `seo-metadata.json` will pick up new JSON after **TTL** (see `seoMetadata.ts`). Redeploy the Worker if you want zero wait or you are unsure.

#### Automatic: GitHub Actions (recommended)

The repo workflow **`.github/workflows/deploy-seo-worker.yml`** runs on **`push` to `main`** when anything under **`workers/seo-worker/**`** changes (or when that workflow file changes). It runs **`npm ci` → `npm test` → `npm run typecheck` → `wrangler deploy`** via [`cloudflare/wrangler-action@v3`](https://github.com/cloudflare/wrangler-action).

**One-time — GitHub Actions:** Open **Settings → Secrets and variables → Actions** and add the encrypted variables the deploy workflow expects. **Never commit** API tokens, global API keys, or raw account identifiers into this repo (or paste them into issues/PRs); GitHub Secrets exist specifically so values stay off disk in clones and history.

The **exact variable names** and what Wrangler needs from them live only in **`.github/workflows/deploy-seo-worker.yml`** (see the top comment and the “Deploy to Cloudflare” step). For how to mint a least-privilege Cloudflare API token, use Cloudflare’s guide: [Wrangler CI/CD — API token](https://developers.cloudflare.com/workers/wrangler/ci-cd/#api-token).

After those are configured, merge a change that touches `workers/seo-worker/` or use **Actions → Deploy SEO Worker (Cloudflare) → Run workflow** (`workflow_dispatch`).

**Do not** also wire the same Worker through Cloudflare **Worker → Settings → Build → Connect GitHub/GitLab** unless you want a **second** deploy pipeline. Prefer **one** source of truth: this repo’s workflow file.

#### Manual: from your machine

From repo root:

```bash
cd workers/seo-worker
npm ci                    # first time or after package-lock changes
npx wrangler login        # once per machine / CI user (opens browser OAuth)
npm run deploy            # uploads Worker and attaches zone routes from wrangler.toml
```

**Account access:** The Cloudflare user you `wrangler login` with must have permission to deploy Workers on the **bananasutra.com** zone.

**First-time route binding:** `wrangler deploy` reads `[[routes]]` in `wrangler.toml` and attaches the Worker to those patterns. If routes already exist in the dashboard, Wrangler should align them with this file.

### 3. Smoke-test production (human vs bot)

```bash
BASE=https://bananasutra.com
curl -sSI "$BASE/songs/curious-like-a-kiss" | head -n 8
curl -sSI -A "Twitterbot/1.0" "$BASE/songs/curious-like-a-kiss" | head -n 20
curl -sS -A "Twitterbot/1.0" "$BASE/songs/curious-like-a-kiss" | grep -E 'og:title|og:image|canonical|<title>' | head
```

Expect **200** on the document request, and bot HTML containing **`og:image`** URLs that match what you ship from Pages (`/og/site.png`, `/og/songs/...`).

**Live logs:** `npm run tail` in `workers/seo-worker` while you hit URLs or trigger link previews.

### 4. Caching and “it still shows the old preview”

- **Worker** caches `seo-metadata.json` in-memory for roughly an hour (see `SEO_METADATA_TTL_MS` in `src/seoMetadata.ts`). After a deploy, previews can lag until TTL expires or the Worker instance refreshes.
- **Cloudflare edge cache:** If you use aggressive caching for HTML/JSON, **purge** the relevant URLs in the dashboard (**Caching** → **Configuration** → purge custom URL) for `https://bananasutra.com/seo-metadata.json` and a few sample pages.
- **Social platforms** cache aggressively; use each platform’s “scrape again” / debugger tool after changes.

### 5. Rollback

- **Bad Worker deploy:** Cloudflare dashboard → **Workers & Pages** → `bananasutra-com-seo` → **Deployments** → **Rollback** to a previous version.
- **Bad static deploy:** revert the GitHub commit on `main` and let the Pages workflow redeploy, or redeploy a known-good run from **Actions**.

---

## Local development

```bash
npm ci
npm run dev             # wrangler dev — local Worker + optional origin fetch
npm test
npm run typecheck
```

---

## Related repo docs (tracked)

- Catalog build + `dist/` / OG pipeline: `apps/banana-catalog-prototype/README.md`, `.github/workflows/pages.yml`
- Root monorepo notes (including why `_docs/` is gitignored locally): root `README.md`

Private planning CSVs / epics under `_docs/` stay on your machine by design; they are not cloned from GitHub.
