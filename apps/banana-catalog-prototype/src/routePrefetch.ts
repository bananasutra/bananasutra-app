/**
 * R70 — prefetch lazy route chunks on link hover/focus only (not idle prefetch-all).
 * R31 disabled idle prefetch because it widened Lighthouse dependency chains; intent-based
 * prefetch warms the chunk the user is about to open without downloading every route.
 */

type RouteLoader = () => Promise<unknown>

function normalizePathname(pathname: string): string {
  if (!pathname || pathname === '/') return '/'
  return pathname.replace(/\/$/, '') || '/'
}

/** Mirrors App.tsx lazy() imports — keep aligned with route-lazy-chunks.mjs stems. */
const ROUTE_LOADERS: Record<string, RouteLoader> = {
  '/': () => import('./catalog/HomePortal'),
  '/learn': () => import('./catalog/ExperienceLpPages'),
  '/listen': () => import('./catalog/ExperienceLpPages'),
  '/watch': () => import('./catalog/ExperienceLpPages'),
  '/songs': () => import('./catalog/CatalogApp'),
  '/words': () => import('./catalog/WordsPage'),
  '/about': () => import('./catalog/AboutPage'),
  '/sutras': () => import('./catalog/AboutPage'),
  '/muses': () => import('./catalog/AboutPage'),
  '/quotes': () => import('./catalog/AboutPage'),
  '/songbooks': () => import('./catalog/SongbooksPage'),
  '/tracks': () => import('./catalog/TracksPage'),
  '/videos': () => import('./catalog/VideosPage'),
  '/style-guide': () => import('./catalog/StyleGuidePage'),
  '/sitemap': () => import('./catalog/SitemapPage'),
  '/manifesto': () => import('./catalog/ManifestoPage'),
  '/privacy': () => import('./catalog/PrivacyPage'),
}

const prefetched = new Set<string>()

export function prefetchRoutePath(pathname: string): void {
  const key = normalizePathname(pathname)
  if (prefetched.has(key)) return

  let loader = ROUTE_LOADERS[key]
  if (!loader) {
    if (key.startsWith('/songs/')) loader = () => import('./catalog/SongDetail')
    else if (key.startsWith('/sutras/')) loader = () => import('./catalog/SutraDetailPage')
    else if (key.startsWith('/songbooks/')) loader = () => import('./catalog/SongbookPage')
  }
  if (!loader) return

  prefetched.add(key)
  void loader().catch(() => {
    prefetched.delete(key)
  })
}

function considerInternalNavLink(target: EventTarget | null): HTMLAnchorElement | null {
  if (!(target instanceof Element)) return null
  const a = target.closest('a[href]')
  if (!(a instanceof HTMLAnchorElement)) return null
  if (a.hasAttribute('download')) return null
  const hrefAttr = a.getAttribute('href')
  if (!hrefAttr || hrefAttr.startsWith('mailto:') || hrefAttr.startsWith('tel:') || hrefAttr.startsWith('#')) {
    return null
  }
  let nextUrl: URL
  try {
    nextUrl = new URL(a.href)
  } catch {
    return null
  }
  if (nextUrl.origin !== window.location.origin) return null
  const cur = new URL(window.location.href)
  if (nextUrl.pathname === cur.pathname && nextUrl.search === cur.search) return null
  return a
}

function prefetchFromLink(target: EventTarget | null): void {
  const a = considerInternalNavLink(target)
  if (!a) return
  try {
    prefetchRoutePath(new URL(a.href).pathname)
  } catch {
    // ignore malformed href
  }
}

/** Wire pointer/focus intent prefetch once at app boot. */
export function installRoutePrefetchOnIntent(): () => void {
  const onPointerOver = (event: PointerEvent) => {
    if (event.pointerType === 'touch') return
    prefetchFromLink(event.target)
  }
  const onFocusIn = (event: FocusEvent) => {
    prefetchFromLink(event.target)
  }

  document.addEventListener('pointerover', onPointerOver, true)
  document.addEventListener('focusin', onFocusIn, true)

  return () => {
    document.removeEventListener('pointerover', onPointerOver, true)
    document.removeEventListener('focusin', onFocusIn, true)
  }
}

/** Boot hook — no idle prefetch (see R31). */
export function prefetchCatalogRoutesIdle(): void {
  return
}
