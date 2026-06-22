# bbb-api

Bertrand the Banana Butler API on Cloudflare Workers, with Level 1 logging plus **structured signals** (page type + intent flags) on each chat row:
- stores latest user prompt + assistant reply in D1,
- stores deterministic intent signals (same heuristics BBB already uses live — no extra model cost),
- protects log access with bearer token auth,
- hashes IPs (no raw IP storage),
- hashes optional client actor IDs (`X-BBB-Actor`) for stable per-browser filtering on a given site origin (localhost and prod are separate),
- supports log cleanup by retention window.

## What this gives you

- Chat endpoint: `POST /api/bbb` (existing behavior preserved)
- Feedback relay endpoint: `POST /api/bbb/feedback` (BBB → Worker → Apps Script, mirrored to D1)
- Admin logs endpoint: `GET /api/bbb/admin/logs`
- Cleanup endpoint: `POST /api/bbb/admin/logs/cleanup`
- Admin 404 endpoint: `GET /api/bbb/admin/404` (no shell helper yet — use curl or JSON)
- Admin feedback endpoint: `GET /api/bbb/admin/feedback`
- Admin feedback cleanup endpoint: `POST /api/bbb/admin/feedback/cleanup`

---

## One-time setup (follow in order)

### 1) Install dependencies

```bash
cd /Users/cee/Developer/BANANASUTRA-app/bbb-api
npm install
```

### 2) Set local secrets in `.dev.vars`

Create/update `bbb-api/.dev.vars` (gitignored):

```env
ANTHROPIC_API_KEY=...
BBB_MODEL=claude-haiku-4-5-20251001
BBB_ALLOWED_ORIGINS=http://localhost:5174,http://127.0.0.1:5174
BBB_ADMIN_TOKEN=...      # long random string
BBB_LOG_IP_SALT=...      # different long random string
BBB_LOG_ACTOR_SALT=...   # optional; falls back to BBB_LOG_IP_SALT
CONTACT_ENDPOINT_URL=... # existing Apps Script web app URL used by footer form
BBB_FEEDBACK_MAX_PER_HOUR=5
BBB_FEEDBACK_RETENTION_DAYS=30
# Optional: extra prefixes for logs:remote:not-me (merged with script defaults)
# BBB_ME_ACTOR_HASHES=4619a462d2de|183a65d49281|a2e60ef0102a|4336e64c5639
# BBB_ME_IP_HASHES=0492da13ba34
```

### 3) Create D1 database (once)

```bash
npx wrangler d1 create bbb-logs
```

Wrangler prints a `database_id`. Copy it into `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "bbb-logs"
database_id = "PASTE_REAL_DATABASE_ID_HERE"
```

### 4) Apply migrations

Local:

```bash
npx wrangler d1 migrations apply bbb-logs --local
```

Remote (required after deploy that adds `page_type` / `intent_json`):

```bash
npx wrangler d1 migrations apply bbb-logs --remote
```

### 5) Set remote Worker secrets

Run each command and paste the matching value from `.dev.vars`:

```bash
npx wrangler secret put ANTHROPIC_API_KEY
npx wrangler secret put BBB_ADMIN_TOKEN
npx wrangler secret put BBB_LOG_IP_SALT
npx wrangler secret put BBB_LOG_ACTOR_SALT
npx wrangler secret put CONTACT_ENDPOINT_URL
```

Optional runtime env vars (non-secret) in `wrangler.toml`:
- `BBB_FEEDBACK_MAX_PER_HOUR` (default `5`)
- `BBB_FEEDBACK_RETENTION_DAYS` (fallback to `BBB_LOG_RETENTION_DAYS`, default `30`)

### 6) Deploy

```bash
npm run deploy
```

**R50 route flattening (W-074):** `bbb-api` changes for flat `/sutras`, `/muses`, `/quotes` ship with the **final R50 production launch** (`r50-overhaul` → `staging` → `main`), not via an early Track 1 deploy. Early deploy would make Bertrand link to URLs that do not exist on bananasutra.com yet. CI deploys automatically on push to `main` when `bbb-api/**` changes (`.github/workflows/deploy-bbb-api.yml`).

### Catalog data refresh (Bertrand library)

Bertrand's song/track/video/songbook knowledge is **not** read from the live site at runtime. It is baked into `src/library-data.ts` at build time.

After any Airtable snapshot refresh:

```bash
# From repo root — preferred (also runs slug/genre audits)
npm run catalog:data
```

**Full checklist (local QA through git ship):** `../apps/banana-catalog-prototype/docs/DATA-RELEASE-WORKFLOW.md`. Agents commit and push when Banana asks to ship live.

Or only the Worker injects:

```bash
npm run build:library
```

**Data-release checklist:** include `bbb-api/src/library-data.ts` in the same commit as `apps/banana-catalog-prototype/src/data/generated/*`. After `main` push, confirm GitHub Actions **Deploy BBB API** is green, then smoke-test: ask Bertrand "what's new?" and check titles match the newest `published_at` songs in the catalog.

---

## Command reference (daily use)

All helpers read `BBB_ADMIN_TOKEN` from the environment or `bbb-api/.dev.vars`. No manual export needed.

### Chat logs

| Command | What it does |
|---------|----------------|
| `npm run logs:remote` | Last 50 chats, pretty print (newest at **bottom** of terminal) |
| `npm run logs:remote:tail` | Last 15 chats, compact one-liners (best daily check-in) |
| `npm run logs:local` | Same against `wrangler dev` (must be running) |
| `npm run logs:remote:not-me` | Remote logs, excluding your hashed IP/actor prefixes |
| `npm run logs:cleanup:remote` | Delete chat rows older than retention (default 30 days) |
| `npm run logs:cleanup:local` | Same for local D1 |

**Pass-through flags** (after `--`):

| Flag | Purpose |
|------|---------|
| `--tail N` | Fetch N rows; auto-enables compact |
| `--limit N` | Max rows (default 50, max 200) |
| `--status ok` | Filter by status |
| `--query hope` | Substring search in `user_prompt` |
| `--before UNIX_MS` | Pagination cursor (older page) |
| `--compact` | One line per row |
| `--no-reply` | Hide Bertrand reply body |
| `--no-color` | Plain text |
| `--api-order` | #1 = newest at top (legacy layout) |

**Raw JSON** (for scripts / export):

```bash
BBB_LOG_FORMAT=json npm run logs:remote -- --limit 100
```

### Feedback mirror

| Command | What it does |
|---------|----------------|
| `npm run feedback:remote` | Last 50 feedback rows (newest at bottom) |
| `npm run feedback:remote:tail` | Last 10, compact |
| `npm run feedback:local` | Local Worker |
| `npm run feedback:cleanup:remote` | Prune old feedback rows |

**Pass-through flags:** `--tail N`, `--limit N`, `--intent feedback` (`feedback`, `song-idea`, `bug-report`, `broken-link`), `--before UNIX_MS`, `--compact`, `--no-color`, `--api-order`.

```bash
BBB_FEEDBACK_FORMAT=json npm run feedback:remote -- --limit 50
```

### Failure-path test (local only)

```bash
npm run feedback:failure-test:local
```

### Dev / quality

| Command | Purpose |
|---------|---------|
| `npm run dev` | Local Worker |
| `npm run deploy` | Deploy Worker |
| `npm run test` | All unit tests |
| `npm run test:prompt` | Prompt + recommendation-context tests |
| `npm run typecheck` | TypeScript |

---

## Best practices

### Daily triage (2 minutes)

```bash
npm run logs:remote:tail
npm run feedback:remote:tail
```

You land on the newest rows at the bottom of the terminal. Look for `sig:` lines (`page:…`, `intent:…`, `support:…`) before reading full prompts.

### Exclude your own testing

`npm run logs:remote:not-me` drops rows whose `actor:` or `ip:` line matches your hash **prefixes** (pipe-separated). Built-in defaults in `scripts/bbb-logs-not-me.sh` include all prefixes you logged, including both laptop hashes; `bbb-api/.dev.vars` entries are **merged** with those defaults (not replaced).

| Device | Actor prefix (in logs) |
|--------|--------------------------|
| Mac mini | `4619a462d2de` |
| Laptop | `183a65d49281` and `4336e64c5639` (same machine — see note) |
| iPhone | `a2e60ef0102a` |

**Why two hashes on one laptop?** Not new hardware. Bertrand stores `bbb_actor_id` in `localStorage` **per origin** — `http://localhost:5174` and `https://bananasutra.com` each get their own id, so each gets its own log hash. The same laptop also gets a new hash if you clear site data, use a different browser, or an ephemeral/private window. Both prefixes stay in the exclude list so your traffic drops either way.

Add more devices via env or `bbb-api/.dev.vars`:

```env
BBB_ME_ACTOR_HASHES=4619a462d2de|183a65d49281|a2e60ef0102a|4336e64c5639
BBB_ME_IP_HASHES=0492da13ba34|other_ip_prefix
```

```bash
npm run logs:remote:not-me -- --tail 20
```

Copy prefixes from log output (`actor: abc123…` / `ip: def456…` — first 12 hex chars are enough).

### When a user reports a bug

1. `npm run feedback:remote -- --intent bug-report --limit 10`
2. Note `req:` / `request_id` if present
3. `npm run logs:remote -- --query "snippet from their message"` or cross-check timestamp

### Pagination

The **older page** cursor prints at the **top** of the output (not the bottom):

```bash
npm run logs:remote -- --before 1748400000000
```

### Analysis without re-reading every transcript

- **Structured signals** (`page_type`, `intent_json.flags`, `intent_json.support`) are stored on new rows after migration `0005` and deploy.
- Export JSON and aggregate in a spreadsheet or a one-off script:

```bash
BBB_LOG_FORMAT=json npm run logs:remote -- --limit 200 > /tmp/bbb-logs.json
```

- **Feedback** remains the richest explicit signal (user chose intent + wrote a message).
- **404 admin API** (`GET /api/bbb/admin/404`) helps UI/data gaps; no pretty printer yet.

### Deploy checklist when logging schema changes

1. `npm run deploy`
2. `npx wrangler d1 migrations apply bbb-logs --remote`
3. `npm run logs:remote:tail` — confirm `sig:` lines on new chats

---

## Privacy (practical, honest)

**What visitors should know (plain language):** BBB is an anonymous helper on a small independent site. Chats are not sold or used for ads. Short-lived server logs help improve recommendations and fix bugs. Optional feedback may include an email only if they choose to provide one.

**What you actually store:**

| Data | Notes |
|------|--------|
| Latest user message + Bertrand reply | Per request; not full thread history |
| Page path + query string | Where they were browsing |
| Hashed IP + optional hashed device id | No raw IP; used to filter your own tests |
| Intent flags + page type | Rule-based tags (e.g. `soundLedIntent`, `support:hope`) |
| Feedback form | Name/email/message if they submit; mirrored to your sheet |

**What you do not do (and should keep that way):** sell data, build ad profiles, require login for chat, or retain logs longer than needed.

**Retention:** default 30 days (`BBB_LOG_RETENTION_DAYS` / `BBB_FEEDBACK_RETENTION_DAYS`). Run cleanup on a schedule you trust.

**Compared to big corporate chat:** those products often tie chats to accounts, train on data at scale, and bury opt-outs in legal text. Your surface is smaller: no accounts for chat, hashed identifiers, admin-only access, a single operator with a stated purpose (better music discovery and site quality). That is lower risk for visitors — not zero risk (prompt text is still personal sometimes), but materially different from ad-driven platforms.

**Site privacy / cookie notice (recommended):** When you add a site-wide privacy or cookie page, include a short **Bertrand (BBB) chat** bullet there — not on the chat widget. Suggested wording:

> **Bertrand chat:** Messages are stored briefly on our server to improve recommendations and fix issues. No account is required. We do not sell chat data.

**When to be stricter:** if you add full-thread logging, public sharing of logs, or LLM batch review of transcripts — revisit retention and mention it clearly.

---

## Expected responses

### Success (logs)

```json
{
  "logs": [],
  "nextBefore": null
}
```

`logs: []` is normal when no chats have been logged yet.

Each log row may include `page_type` and `intent_json` (e.g. `{"flags":["soundLedIntent"],"support":["hope"]}`).

### Unauthorized

```json
{
  "error": "Unauthorized."
}
```

Usually means token is missing, wrong, or not set in remote secrets.

---

## Troubleshooting

### `curl: (3) URL rejected: Bad hostname`

You used placeholders like `<your-bbb-api-domain>`. Use the real URL:
- `https://bbb-api.itsbananasutra.workers.dev`

### Always getting `Unauthorized`

1. Confirm `.dev.vars` has a real value for `BBB_ADMIN_TOKEN` (not `PASTE_TOKEN`).
2. Re-upload secret:
   ```bash
   npx wrangler secret put BBB_ADMIN_TOKEN
   ```
3. Re-deploy:
   ```bash
   npm run deploy
   ```
4. Retry with helper command:
   ```bash
   npm run logs:remote:tail
   ```

### Local logs command hangs

`npm run logs:local` calls `http://localhost:8787`. If `wrangler dev` is not running, it will hang or fail.

Use:

```bash
npm run dev
```

then in a second terminal:

```bash
npm run logs:local
```

### Logs endpoint returns empty list

This is normal until new chat requests hit `POST /api/bbb`.

### No `sig:` line on new logs

Migration `0005` not applied remotely, or Worker not deployed. Run deploy + `migrations apply --remote`.

### Migrations not applying remotely

Make sure `database_id` in `wrangler.toml` is real, then run:

```bash
npx wrangler d1 migrations apply bbb-logs --remote
```

---

## Security notes

- Never commit `.dev.vars`.
- `BBB_ADMIN_TOKEN` and `BBB_LOG_IP_SALT` should be long random values.
- Rotate `ANTHROPIC_API_KEY` if exposed accidentally.
- Admin logs endpoint is sensitive: share token sparingly.
