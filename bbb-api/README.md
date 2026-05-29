# bbb-api

Bertrand the Banana Butler API on Cloudflare Workers, with Level 1 logging:
- stores latest user prompt + assistant reply in D1,
- protects log access with bearer token auth,
- hashes IPs (no raw IP storage),
- hashes optional client actor IDs (`X-BBB-Actor`) for stable per-device filtering,
- supports log cleanup by retention window.

## What this gives you

- Chat endpoint: `POST /api/bbb` (existing behavior preserved)
- Admin logs endpoint: `GET /api/bbb/admin/logs`
- Cleanup endpoint: `POST /api/bbb/admin/logs/cleanup`

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

Remote:

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
```

### 6) Deploy

```bash
npm run deploy
```

---

## Daily use

Use these commands exactly. No manual token export needed.

### 1) Read remote logs (easiest, most common)

```bash
npm run logs:remote
```

### 2) Read local logs

Only works while local Worker is running.

```bash
npm run dev
# in another terminal:
npm run logs:local
```

### 3) Filter remote logs

```bash
npm run logs:remote -- --limit 25 --status ok
npm run logs:remote -- --query "hope"
npm run logs:remote -- --before 1748400000000
BBB_ME_ACTOR_HASHES='abc123|def456' npm run logs:remote:not-me -- --limit 100
```

### 3b) Readability modes

```bash
# one-line summary per log (compact view)
npm run logs:remote -- --compact

# hide Bertrand reply body (prompt + metadata only)
npm run logs:remote -- --no-reply

# disable terminal colors
npm run logs:remote -- --no-color
```

Filter options:
- `limit` (default `50`, max `200`)
- `before` or `cursor` (unix ms for pagination)
- `status` (`ok`, `upstream_error`, `validation_error`, `network_error`, `aborted`)
- `query` (keyword search in `user_prompt`)
- `compact` (one-line per entry)
- `no-reply` (omit assistant body)
- `no-color` (plain text output)

### 4) Cleanup old logs

Deletes rows older than `BBB_LOG_RETENTION_DAYS` (default `30`):

```bash
npm run logs:cleanup:remote
```

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
   npm run logs:remote
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
