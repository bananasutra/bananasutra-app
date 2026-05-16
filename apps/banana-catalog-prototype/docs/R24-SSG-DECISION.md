# R24 — static pre-render architecture decision

**Date:** 2026-05-15  
**Status:** Accepted for implementation

## Context

- Stack: React 19, React Router 7.14 (declarative `BrowserRouter`), Vite 8.
- Phase 2 (R19): Cloudflare Worker injects meta for bot UAs; SPA shell 200 for deep links.
- Phase 3 goal: **full-body** static HTML per route (~440 paths) so view-source and non-JS crawlers see real content.

## Options considered

| Option | Verdict |
|--------|---------|
| React Router 7 framework mode + built-in `prerender` | Best long-term; requires migrating off `BrowserRouter` / Vite-only app entry (large refactor). |
| `vite-react-ssg` | Maintainers direct RR7 users to official prerender; compatibility risk with our stack. |
| **Custom `react-dom/server` + `happy-dom` (chosen)** | Stays on Vite + existing routes; reuses React components with build-time cache seeding. |

## Decision

**Option C — custom post-build prerender** via:

- [`src/prerender/runner.tsx`](../src/prerender/runner.tsx) — `renderToString` + `react-helmet-async`
- [`src/prerender/AppPrerender.tsx`](../src/prerender/AppPrerender.tsx) — `StaticRouter`, eager imports (no `lazy`)
- [`src/prerender/seedCatalogCaches.ts`](../src/prerender/seedCatalogCaches.ts) + `seedBuildTimeCatalogCaches()` in `generatedData.ts`
- [`scripts/prerender-routes.mjs`](../scripts/prerender-routes.mjs) — route list aligned with `seo-metadata.json`
- [`scripts/prerender-html.mjs`](../scripts/prerender-html.mjs) — batch `vite-node` render + inject into `dist/**/index.html`
- **React 19 + react-helmet-async 3:** SSR emits `<title>` / `<meta>` in the render stream; [`runner.tsx`](../src/prerender/runner.tsx) peels them into `headHtml` for static injection (Helmet `context` is not populated on R19).

## Worker (R24e)

- **Known routes** with pre-rendered origin HTML: pass through (bots included); no HTMLRewriter.
- **Unknown SPA paths** at origin 404: return **HTTP 404** (`404.html` body), not 200 shell.
- **Unknown non-catalog paths**: still inject meta for bots only (fallback).

## Out of scope (this release)

- Cookie consent / GA4 Consent Mode → **R32**
- React Router framework migration → future if build time or DX forces it
