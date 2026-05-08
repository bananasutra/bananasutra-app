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
  { to: '/about', label: 'ABOUT', match: 'aboutHub' },
  { to: '/songbooks', label: 'SONGBOOKS', match: 'prefix' },
  { to: '/songs', label: 'SONGS', match: 'prefix' },
  { to: '/tracks', label: 'TRACKS', match: 'exact' },
  { to: '/videos', label: 'VIDEOS', match: 'exact' },
  { to: '/words', label: 'WORDS', match: 'exact' },
]

export function siteNavItemActive(pathname: string, item: SiteNavItem): boolean {
  if (item.match === 'exact') return pathname === item.to
  if (item.match === 'aboutHub') return pathname === '/about' || pathname.startsWith('/about/')
  return pathname === item.to || pathname.startsWith(`${item.to}/`)
}
