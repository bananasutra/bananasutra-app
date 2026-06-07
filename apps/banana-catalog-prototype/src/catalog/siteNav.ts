import { canonicalPathForRoute } from './seoPaths'

/** Match rules for drawer links and legacy catalog nav items. */
export type SiteNavMatch = 'exact' | 'prefix' | 'aboutHub'

export type SiteNavItem = {
  readonly to: string
  readonly label: string
  readonly match: SiteNavMatch
}

/** v3 experience doors — top bar only (NAV-CHROME-SPEC). */
export type ExperienceLp = 'learn' | 'listen' | 'watch'

export const SITE_NAV_EXPERIENCE: readonly { id: ExperienceLp; to: string; label: string }[] = [
  { id: 'learn', to: canonicalPathForRoute('/learn'), label: 'LEARN' },
  { id: 'listen', to: canonicalPathForRoute('/listen'), label: 'LISTEN' },
  { id: 'watch', to: canonicalPathForRoute('/watch'), label: 'WATCH' },
]

export type DrawerNavChild = SiteNavItem

export type DrawerNavItem =
  | { readonly kind: 'link'; readonly to: string; readonly label: string; readonly match: SiteNavMatch; readonly muted?: boolean }
  | {
      readonly kind: 'group'
      readonly to: string
      readonly label: string
      readonly match: SiteNavMatch
      readonly children: readonly DrawerNavChild[]
    }
  | { readonly kind: 'separator' }

/** D-028 drawer tree — mirrors `DRAWER_NAV_TREE` in v3-lp-chrome.js. No LP links here. */
export const SITE_NAV_DRAWER: readonly DrawerNavItem[] = [
  { kind: 'link', to: '/', label: 'Home', match: 'exact' },
  {
    kind: 'group',
    to: canonicalPathForRoute('/about'),
    label: 'About',
    match: 'aboutHub',
    children: [
      { to: canonicalPathForRoute('/about/sutras'), label: 'Sutras', match: 'prefix' },
      { to: canonicalPathForRoute('/about/muses'), label: 'Muses', match: 'prefix' },
      { to: canonicalPathForRoute('/about/quotes'), label: 'Quotes', match: 'prefix' },
      { to: canonicalPathForRoute('/words'), label: 'Words', match: 'exact' },
    ],
  },
  { kind: 'link', to: canonicalPathForRoute('/songbooks'), label: 'Songbooks', match: 'prefix' },
  { kind: 'link', to: canonicalPathForRoute('/songs'), label: 'Songs', match: 'prefix' },
  { kind: 'link', to: canonicalPathForRoute('/tracks'), label: 'Tracks', match: 'exact' },
  { kind: 'link', to: canonicalPathForRoute('/videos'), label: 'Videos', match: 'exact' },
  { kind: 'separator' },
  { kind: 'link', to: canonicalPathForRoute('/sitemap'), label: 'Sitemap', match: 'exact', muted: true },
  {
    kind: 'link',
    to: `${canonicalPathForRoute('/about')}#contact`,
    label: 'Contact',
    match: 'aboutHub',
    muted: true,
  },
]

function normalizeNavPathname(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith('/')) {
    return pathname.slice(0, -1)
  }
  return pathname
}

export function siteNavItemActive(pathname: string, item: SiteNavItem): boolean {
  const norm = normalizeNavPathname(pathname)
  const base = normalizeNavPathname(item.to.split('#')[0] ?? item.to)
  if (item.match === 'exact') return norm === base
  if (item.match === 'aboutHub') return norm === '/about' || norm.startsWith('/about/')
  return norm === base || norm.startsWith(`${base}/`)
}

/** Active LP tab for top bar; song pages count as listen (D-027 / NAV-CHROME-SPEC). */
export function experienceLpActive(pathname: string): ExperienceLp | null {
  const norm = normalizeNavPathname(pathname)
  if (norm === '/learn' || norm.startsWith('/learn/')) return 'learn'
  if (norm === '/listen' || norm.startsWith('/listen/')) return 'listen'
  if (norm === '/watch' || norm.startsWith('/watch/')) return 'watch'
  if (norm.startsWith('/songs/')) return 'listen'
  return null
}
