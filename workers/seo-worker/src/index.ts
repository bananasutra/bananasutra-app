/**
 * BANANASUTRA SEO Worker.
 *
 * Pipeline (built up across Phase 3 tasks):
 *   - task 13: scaffold (done).
 *   - task 14: bot User-Agent detection (done).
 *   - task 15: origin fetch + HTMLRewriter meta injection (done).
 *   - task 16: seo-metadata.json fetch + in-isolate TTL cache (done).
 *   - task 17: route lookup + unknown-route canonical alignment (done).
 *   - task 18: wrangler.toml zone routes bananasutra.com/* and www.bananasutra.com/* (deploy task 19).
 *   - SPA shell: GET/HEAD on client route prefixes that 404 at GitHub Pages are served
 *     the `/` HTML shell with status 200 (humans + bots); bots still get metadata rewrite.
 *
 * Behavior:
 *   - Deep SPA paths (see `spaShell.ts` / `App.tsx` routes): if origin returns 404, the Worker
 *     fetches `/` and returns that HTML as 200 so document requests are not a 404→client redirect.
 *   - Static assets (`/assets/*`, etc.) and non-SPA paths pass through unchanged.
 *   - Bots (see `botDetection.ts`): `seo-metadata.json` + HTMLRewriter inject title / OG /
 *     Twitter / description / canonical on the response body (shell or origin).
 *
 * Manual curl QA (`npm run dev` in this package, then):
 *   curl -sI http://127.0.0.1:8787/songs/ego
 *   curl -sI http://127.0.0.1:8787/about
 *   curl -A "Twitterbot/1.0" http://127.0.0.1:8787/songs/ego | rg "<title>|og:title|canonical"
 * Optional debug: response header `x-banana-bot-detected: <pattern>` when the bot path ran.
 *
 * Rollout: deploy Worker; purge Cloudflare cache for HTML if a route was previously cached as 404.
 * Verify apex + www. Origin remains GitHub Pages.
 */

import { handleRequest } from "./handleRequest.ts";

const handler: ExportedHandler = {
  fetch(request: Request): Promise<Response> {
    return handleRequest(request);
  },
};

export default handler;
