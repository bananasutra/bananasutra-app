import { canonicalPathForRoute } from './seoPaths'

/**
 * Primary IA destinations — single source for header + footer nav.
 * Order: About → Songbooks → Songs → Tracks → Videos → Words.
 * Sutra overview lives on About (`#sutras`); per-sutra pages live at `/about/:slug`.
 */
export type SiteNavMatch = 'exact' | 'prefix' | 'aboutHub'

export type SiteNavItem = {
  readonly to: string
  readonly label: string
  readonly match: SiteNavMatch
}

export const SITE_NAV_PRIMARY: readonly SiteNavItem[] = [
  { to: canonicalPathForRoute('/about'), label: 'ABOUT', match: 'aboutHub' },
  { to: canonicalPathForRoute('/songbooks'), label: 'SONGBOOKS', match: 'prefix' },
  { to: canonicalPathForRoute('/songs'), label: 'SONGS', match: 'prefix' },
  { to: canonicalPathForRoute('/tracks'), label: 'TRACKS', match: 'exact' },
  { to: canonicalPathForRoute('/videos'), label: 'VIDEOS', match: 'exact' },
  { to: canonicalPathForRoute('/words'), label: 'WORDS', match: 'exact' },
]

function normalizeNavPathname(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith('/')) {
    return pathname.slice(0, -1)
  }
  return pathname
}

export function siteNavItemActive(pathname: string, item: SiteNavItem): boolean {
  const norm = normalizeNavPathname(pathname)
  const base = normalizeNavPathname(item.to)
  if (item.match === 'exact') return norm === base
  if (item.match === 'aboutHub') return norm === '/about' || norm.startsWith('/about/')
  return norm === base || norm.startsWith(`${base}/`)
}
