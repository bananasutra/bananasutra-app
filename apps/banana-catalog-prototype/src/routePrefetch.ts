/**
 * After first paint, preload lazy route JS chunks so the first tap on primary nav waits less
 * on module graph fetches. (JSON is warmed by `BootPrefetch` in `App.tsx` — not idle-delayed.)
 */
export function prefetchCatalogRoutesIdle(): void {
  if (typeof window === 'undefined') return
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection
  const netType = (conn?.effectiveType ?? '').toLowerCase()
  const onSlowConnection = netType.includes('2g') || netType.includes('3g')
  if (conn?.saveData || onSlowConnection) return

  const schedule =
    'requestIdleCallback' in window
      ? (cb: IdleRequestCallback) => window.requestIdleCallback(cb, { timeout: 7000 })
      : (cb: () => void) => window.setTimeout(cb, 2400)

  const prefetch = () => schedule(() => {
    void import('./catalog/CatalogApp')
    void import('./catalog/WordsPage')
    void import('./catalog/VideosPage')
    void import('./catalog/TracksPage')
    void import('./catalog/SongbooksPage')
    void import('./catalog/SongbookPage')
    void import('./catalog/AboutPage')
    void import('./catalog/SutraDetailPage')
    void import('./catalog/SongDetail')
  })

  if (document.readyState === 'complete') {
    prefetch()
    return
  }
  window.addEventListener('load', prefetch, { once: true })
}
