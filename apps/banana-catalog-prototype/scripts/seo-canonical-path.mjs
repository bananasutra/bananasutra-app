/**
 * Canonical pathname rules for GitHub Pages SSG (`<route>/index.html`).
 * Keep in sync with `src/catalog/seoPaths.ts`.
 */

/** Listing / hub routes emitted as `dist/<route>/index.html` (R26). W-074: flat About hubs. */
export const STATIC_SSG_INDEX_PATHS = new Set([
  '/learn',
  '/listen',
  '/watch',
  '/songs',
  '/songbooks',
  '/tracks',
  '/videos',
  '/words',
  '/about',
  '/sutras',
  '/muses',
  '/quotes',
  '/manifesto',
  '/sitemap',
  '/privacy',
])

/** Path for canonical, sitemap `<loc>`, and internal links (trailing slash where GH Pages serves a directory). */
export function canonicalPathForRoute(pathname) {
  if (pathname === '/') return pathname
  if (STATIC_SSG_INDEX_PATHS.has(pathname)) return `${pathname}/`
  if (/^\/songs\/[^/]+$/.test(pathname)) return `${pathname}/`
  if (/^\/songbooks\/[^/]+$/.test(pathname)) return `${pathname}/`
  if (/^\/sutras\/[^/]+$/.test(pathname)) return `${pathname}/`
  return pathname
}
