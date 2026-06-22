/**
 * R59 — map prerendered pathname → Vite lazy route chunk stem (matches App.tsx lazy() imports).
 * Keep aligned with AppPrerender.tsx route table.
 */

/** @param {string} pathname */
export function lazyChunkStemsForRoute(pathname) {
  const p = pathname === '/' ? '/' : pathname.replace(/\/$/, '')

  if (p === '/') return ['HomePortal']
  if (p === '/learn' || p === '/listen' || p === '/watch') return ['ExperienceLpPages']
  if (p === '/songs') return ['CatalogApp']
  if (p.startsWith('/songs/')) return ['SongDetail']
  if (p === '/words') return ['WordsPage']
  if (p === '/about' || p === '/sutras' || p === '/muses' || p === '/quotes') return ['AboutPage']
  if (p.startsWith('/sutras/')) return ['SutraDetailPage']
  if (p === '/manifesto') return ['ManifestoPage']
  if (p === '/privacy') return ['PrivacyPage']
  if (p === '/songbooks') return ['SongbooksPage']
  if (p.startsWith('/songbooks/')) return ['SongbookPage']
  if (p === '/tracks') return ['TracksPage']
  if (p === '/videos') return ['VideosPage']
  if (p === '/style-guide') return ['StyleGuidePage']
  if (p === '/sitemap') return ['SitemapPage']

  return []
}
