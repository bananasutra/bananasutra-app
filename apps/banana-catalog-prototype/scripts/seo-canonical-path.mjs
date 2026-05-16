/**
 * Canonical pathname rules for GitHub Pages SSG (`<route>/index.html`).
 * Keep in sync with `src/catalog/seoPaths.ts`.
 */

const ABOUT_STATIC_HUBS = new Set(['/about/sutras', '/about/muses', '/about/quotes'])

/** Listing / hub routes emitted as `dist/<route>/index.html` (R26). */
export const STATIC_SSG_INDEX_PATHS = new Set([
  '/songs',
  '/songbooks',
  '/tracks',
  '/videos',
  '/words',
  '/about',
  '/about/sutras',
  '/about/muses',
  '/about/quotes',
  '/sitemap',
])

/** Path for canonical, sitemap `<loc>`, and internal links (trailing slash where GH Pages serves a directory). */
export function canonicalPathForRoute(pathname) {
  if (pathname === '/') return pathname
  if (STATIC_SSG_INDEX_PATHS.has(pathname)) return `${pathname}/`
  if (/^\/songs\/[^/]+$/.test(pathname)) return `${pathname}/`
  if (/^\/songbooks\/[^/]+$/.test(pathname)) return `${pathname}/`
  if (/^\/about\/[^/]+$/.test(pathname) && !ABOUT_STATIC_HUBS.has(pathname)) {
    return `${pathname}/`
  }
  return pathname
}
