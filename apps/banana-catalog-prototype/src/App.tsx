import { lazy, Suspense, useEffect, useLayoutEffect } from 'react'
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom'
import { NavigationLoadingBridge } from './NavigationLoadingBridge'
import { loadSongCatalogBrowse, loadYoutubeByLyricsId } from './catalog/generatedData'
import { prefetchCatalogRoutesIdle } from './routePrefetch'
import { SearchRedirect } from './catalog/SearchRedirect'

const HomePortal = lazy(() => import('./catalog/HomePortal').then((m) => ({ default: m.HomePortal })))
const AboutPage = lazy(() => import('./catalog/AboutPage').then((m) => ({ default: m.AboutPage })))
const CatalogApp = lazy(() => import('./catalog/CatalogApp').then((m) => ({ default: m.CatalogApp })))
const SongbookPage = lazy(() => import('./catalog/SongbookPage').then((m) => ({ default: m.SongbookPage })))
const SongbooksPage = lazy(() => import('./catalog/SongbooksPage').then((m) => ({ default: m.SongbooksPage })))
const SongDetail = lazy(() => import('./catalog/SongDetail').then((m) => ({ default: m.SongDetail })))
const TracksPage = lazy(() => import('./catalog/TracksPage').then((m) => ({ default: m.TracksPage })))
const VideosPage = lazy(() => import('./catalog/VideosPage').then((m) => ({ default: m.VideosPage })))
const WordsPage = lazy(() => import('./catalog/WordsPage').then((m) => ({ default: m.WordsPage })))
const SutraDetailPage = lazy(() => import('./catalog/SutraDetailPage').then((m) => ({ default: m.SutraDetailPage })))
const StyleGuidePage = lazy(() => import('./catalog/StyleGuidePage').then((m) => ({ default: m.StyleGuidePage })))
const SitemapPage = lazy(() => import('./catalog/SitemapPage').then((m) => ({ default: m.SitemapPage })))
const GITHUB_PROJECT_BASENAME = '/bananasutra-app'

/** Start the main browse payload fetch as soon as the app bundle is evaluated. */
if (typeof window !== 'undefined') {
  void loadSongCatalogBrowse()
}

/** Browse route — `CatalogApp` syncs sort + facet state from `location.search` without remounting
 * so UI state (e.g. filters panel open/closed) survives sort-only URL updates. */
function CatalogBrowseRoute() {
  return <CatalogApp />
}

function AppRouteFallback() {
  return (
    <div className="app-route-fallback" role="status" aria-live="polite" aria-busy="true">
      <span className="app-route-fallback__spinner" aria-hidden />
      <p className="app-route-fallback__label">Loading…</p>
    </div>
  )
}

function BootPrefetch() {
  useEffect(() => {
    // Route chunks can still be warmed aggressively without blocking first paint.
    prefetchCatalogRoutesIdle()
    const conn = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection
    const shouldSkipYoutubeWarm =
      conn?.saveData === true || (conn?.effectiveType?.toLowerCase().includes('2g') ?? false)
    if (shouldSkipYoutubeWarm) return
    const schedule =
      'requestIdleCallback' in window
        ? (cb: IdleRequestCallback) => window.requestIdleCallback(cb, { timeout: 3000 })
        : (cb: () => void) => window.setTimeout(cb, 600)
    schedule(() => {
      void loadYoutubeByLyricsId()
    })
  }, [])
  return null
}

/** SPA default keeps scroll position on navigate; restore document scroll when the path changes. */
function ScrollToTopOnNavigate() {
  const { pathname } = useLocation()
  useLayoutEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

/** Catalog routes — see `_docs/CATALOG-GLOBAL-CHROME.md` and `_docs/CATALOG-IA.md`. */
export default function App() {
  const routerBasename =
    typeof window !== 'undefined' && window.location.hostname.endsWith('.github.io')
      ? GITHUB_PROJECT_BASENAME
      : undefined

  return (
    <>
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <BrowserRouter basename={routerBasename}>
        <BootPrefetch />
        <NavigationLoadingBridge />
        <ScrollToTopOnNavigate />
        <Suspense fallback={<AppRouteFallback />}>
          <Routes>
            <Route path="/" element={<HomePortal />} />
            <Route path="/songs" element={<CatalogBrowseRoute />} />
            <Route path="/words" element={<WordsPage />} />
            <Route path="/search" element={<SearchRedirect />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/about/:slug" element={<SutraDetailPage />} />
            <Route path="/songbooks" element={<SongbooksPage />} />
            <Route path="/songbooks/:slug" element={<SongbookPage />} />
            <Route path="/tracks" element={<TracksPage />} />
            <Route path="/songs/:slug" element={<SongDetail />} />
            <Route path="/videos" element={<VideosPage />} />
            <Route path="/style-guide" element={<StyleGuidePage />} />
            <Route path="/sitemap" element={<SitemapPage />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </>
  )
}
