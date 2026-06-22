/**
 * Canonical pathname rules for GitHub Pages SSG (`<route>/index.html`).
 * Keep in sync with `scripts/seo-canonical-path.mjs`.
 */

/** Listing / hub routes emitted as `dist/<route>/index.html` (R26). W-051: /learn, /listen, /watch (v3 experience LPs). W-074: flat About hubs. */
export const STATIC_SSG_INDEX_PATHS = [
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
] as const

/** Path for PageMeta canonical, `<Link to>`, and navigate targets. */
export function canonicalPathForRoute(pathname: string): string {
  if (pathname === '/') return pathname
  if ((STATIC_SSG_INDEX_PATHS as readonly string[]).includes(pathname)) return `${pathname}/`
  if (/^\/songs\/[^/]+$/.test(pathname)) return `${pathname}/`
  if (/^\/songbooks\/[^/]+$/.test(pathname)) return `${pathname}/`
  if (/^\/sutras\/[^/]+$/.test(pathname)) return `${pathname}/`
  return pathname
}

/** Browse path with optional query string (base is a listing route, e.g. `/tracks`). */
export function browsePathWithQuery(base: string, queryString: string): string {
  const path = canonicalPathForRoute(base)
  const qs = queryString.replace(/^\?/, '')
  return qs ? `${path}?${qs}` : path
}
