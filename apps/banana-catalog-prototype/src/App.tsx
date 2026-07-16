import { Component, Suspense, type ReactNode, useEffect, useLayoutEffect, useState } from 'react'
import { lazyWithRetry } from './lazyWithRetry'
import { HelmetProvider } from 'react-helmet-async'
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { NavigationLoadingBridge } from './NavigationLoadingBridge'
import { CatalogProgressiveLoading } from './catalog/CatalogProgressiveLoading'
import { installRoutePrefetchOnIntent } from './routePrefetch'
import { SearchRedirect } from './catalog/SearchRedirect'
import { useBfCacheEmbedTeardown } from './catalog/useBfCacheEmbedTeardown'
import { useSyncPrintPageUrl } from './catalog/useSyncPrintPageUrl'
import { applyAnalyticsDebugFromSearch } from './lib/analytics'
import { useAnalyticsPageView } from './useAnalyticsPageView'
import { BbbChatWidget } from './bbb/BbbChatWidget'
import { PlayerQueueRoot } from './catalog/playerQueue/PlayerQueueRoot'
import { NotFoundRoute } from './catalog/NotFoundRoute'
import { CatalogRedirectGuard } from './catalog/CatalogRedirectGuard'
import { LegacyAboutSutraDetailRedirect } from './catalog/LegacyAboutSutraDetailRedirect'

const HomePortal = lazyWithRetry(() => import('./catalog/HomePortal').then((m) => ({ default: m.HomePortal })))
const AboutPage = lazyWithRetry(() => import('./catalog/AboutPage').then((m) => ({ default: m.AboutPage })))
const AboutSutrasPage = lazyWithRetry(() => import('./catalog/AboutPage').then((m) => ({ default: m.AboutSutrasPage })))
const AboutMusesPage = lazyWithRetry(() => import('./catalog/AboutPage').then((m) => ({ default: m.AboutMusesPage })))
const AboutQuotesPage = lazyWithRetry(() => import('./catalog/AboutPage').then((m) => ({ default: m.AboutQuotesPage })))
const CatalogApp = lazyWithRetry(() => import('./catalog/CatalogApp').then((m) => ({ default: m.CatalogApp })))
const SongbookPage = lazyWithRetry(() => import('./catalog/SongbookPage').then((m) => ({ default: m.SongbookPage })))
const SongbooksPage = lazyWithRetry(() => import('./catalog/SongbooksPage').then((m) => ({ default: m.SongbooksPage })))
const SongDetail = lazyWithRetry(() => import('./catalog/SongDetail').then((m) => ({ default: m.SongDetail })))
const TracksPage = lazyWithRetry(() => import('./catalog/TracksPage').then((m) => ({ default: m.TracksPage })))
const VideosPage = lazyWithRetry(() => import('./catalog/VideosPage').then((m) => ({ default: m.VideosPage })))
const WordsPage = lazyWithRetry(() => import('./catalog/WordsPage').then((m) => ({ default: m.WordsPage })))
const SutraDetailPage = lazyWithRetry(() => import('./catalog/SutraDetailPage').then((m) => ({ default: m.SutraDetailPage })))
const StyleGuidePage = lazyWithRetry(() => import('./catalog/StyleGuidePage').then((m) => ({ default: m.StyleGuidePage })))
const SitemapPage = lazyWithRetry(() => import('./catalog/SitemapPage').then((m) => ({ default: m.SitemapPage })))
const LearnLpPage = lazyWithRetry(() => import('./catalog/ExperienceLpPages').then((m) => ({ default: m.LearnLpPage })))
const ListenLpPage = lazyWithRetry(() => import('./catalog/ExperienceLpPages').then((m) => ({ default: m.ListenLpPage })))
const WatchLpPage = lazyWithRetry(() => import('./catalog/ExperienceLpPages').then((m) => ({ default: m.WatchLpPage })))
const ManifestoPage = lazyWithRetry(() => import('./catalog/ManifestoPage').then((m) => ({ default: m.ManifestoPage })))
const PrivacyPage = lazyWithRetry(() => import('./catalog/PrivacyPage').then((m) => ({ default: m.PrivacyPage })))
const GITHUB_PROJECT_BASENAME = '/bananasutra-app'
const BBB_CHAT_ENABLED =
  (import.meta.env.VITE_BBB_CHAT_ENABLED?.trim().toLowerCase() ?? (import.meta.env.DEV ? 'true' : 'false')) === 'true'

/** Browse route — `CatalogApp` syncs sort + facet state from `location.search` without remounting
 * so UI state (e.g. filters panel open/closed) survives sort-only URL updates. */
function CatalogBrowseRoute() {
  return <CatalogApp />
}

function AppRouteFallback() {
  const [loadPhase, setLoadPhase] = useState<'initial' | 'waiting' | 'slow'>('initial')
  useEffect(() => {
    const waitingId = window.setTimeout(() => setLoadPhase('waiting'), 4500)
    const slowId = window.setTimeout(() => setLoadPhase('slow'), 12000)
    return () => {
      window.clearTimeout(waitingId)
      window.clearTimeout(slowId)
    }
  }, [])
  return (
    <div className="app-route-fallback">
      <CatalogProgressiveLoading
        label="Peeling your banana"
        ariaLabel="Loading page"
        variant="page"
        className="catalog-progressive-loading--centered"
      />
      {loadPhase === 'waiting' ? (
        <p className="app-route-fallback__hint">Still loading this page. Hang tight.</p>
      ) : null}
      {loadPhase === 'slow' ? (
        <p className="app-route-fallback__hint">
          This is taking longer than usual. You can keep waiting or retry this page.
        </p>
      ) : null}
      {loadPhase === 'slow' ? (
        <button type="button" className="app-route-fallback__retry" onClick={() => window.location.reload()}>
          Retry page load
        </button>
      ) : null}
    </div>
  )
}

function RouteLoadErrorFallback({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="app-route-fallback" role="alert" aria-live="assertive" aria-busy="false">
      <p className="app-route-fallback__label">Page load stalled.</p>
      <p className="app-route-fallback__hint">
        This page took too long to finish loading. Retry and we&apos;ll keep your URL.
      </p>
      <div className="app-route-fallback__actions">
        <button type="button" className="app-route-fallback__retry" onClick={onRetry}>
          Retry
        </button>
        <Link to="/" className="app-route-fallback__home-link">
          Back home
        </Link>
      </div>
    </div>
  )
}

class RouteErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; key: number }> {
  state = { hasError: false, key: 0 }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: unknown) {
    // Keep diagnostics in development without crashing the whole app on chunk errors.
    if (import.meta.env.DEV) console.error(error)
  }

  retry = () => {
    this.setState((prev) => ({ hasError: false, key: prev.key + 1 }))
  }

  render() {
    if (this.state.hasError) return <RouteLoadErrorFallback onRetry={this.retry} />
    return <div key={this.state.key}>{this.props.children}</div>
  }
}

function RouteBoundary({ children }: { children: ReactNode }) {
  return (
    <RouteErrorBoundary>
      <Suspense fallback={<AppRouteFallback />}>{children}</Suspense>
    </RouteErrorBoundary>
  )
}

function BootPrefetch() {
  useEffect(() => installRoutePrefetchOnIntent(), [])
  return null
}

/** SPA default keeps scroll position on navigate; restore document scroll when the path changes. */
function ScrollToTopOnNavigate() {
  const { pathname, search } = useLocation()
  useLayoutEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  useEffect(() => {
    applyAnalyticsDebugFromSearch(search)
  }, [search])

  useAnalyticsPageView()
  useSyncPrintPageUrl()
  useBfCacheEmbedTeardown()

  return null
}

/** Catalog routes — see `_docs/CATALOG-GLOBAL-CHROME.md` and `_docs/CATALOG-IA.md`. */
export default function App() {
  const routerBasename =
    typeof window !== 'undefined' && window.location.hostname.endsWith('.github.io')
      ? GITHUB_PROJECT_BASENAME
      : undefined

  useLayoutEffect(() => {
    // Production: inline boot script removes splash after stylesheets load; keep fallback for dev.
    document.getElementById('app-boot-splash')?.remove()
  }, [])

  return (
    <HelmetProvider>
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <BrowserRouter basename={routerBasename}>
        <PlayerQueueRoot>
        <BootPrefetch />
        <NavigationLoadingBridge />
        <ScrollToTopOnNavigate />
        <CatalogRedirectGuard>
        <Routes>
          <Route
            path="/"
            element={
              <RouteBoundary>
                <HomePortal />
              </RouteBoundary>
            }
          />
          <Route
            path="/learn"
            element={
              <RouteBoundary>
                <LearnLpPage />
              </RouteBoundary>
            }
          />
          <Route
            path="/listen"
            element={
              <RouteBoundary>
                <ListenLpPage />
              </RouteBoundary>
            }
          />
          <Route
            path="/watch"
            element={
              <RouteBoundary>
                <WatchLpPage />
              </RouteBoundary>
            }
          />
          <Route
            path="/songs"
            element={
              <RouteBoundary>
                <CatalogBrowseRoute />
              </RouteBoundary>
            }
          />
          <Route
            path="/words"
            element={
              <RouteBoundary>
                <WordsPage />
              </RouteBoundary>
            }
          />
          <Route path="/search" element={<SearchRedirect />} />
          <Route
            path="/about"
            element={
              <RouteBoundary>
                <AboutPage />
              </RouteBoundary>
            }
          />
          <Route
            path="/sutras"
            element={
              <RouteBoundary>
                <AboutSutrasPage />
              </RouteBoundary>
            }
          />
          <Route
            path="/muses"
            element={
              <RouteBoundary>
                <AboutMusesPage />
              </RouteBoundary>
            }
          />
          <Route
            path="/quotes"
            element={
              <RouteBoundary>
                <AboutQuotesPage />
              </RouteBoundary>
            }
          />
          <Route
            path="/manifesto"
            element={
              <RouteBoundary>
                <ManifestoPage />
              </RouteBoundary>
            }
          />
          <Route
            path="/sutras/:slug"
            element={
              <RouteBoundary>
                <SutraDetailPage />
              </RouteBoundary>
            }
          />
          <Route path="/about/sutras" element={<Navigate to="/sutras/" replace />} />
          <Route path="/about/muses" element={<Navigate to="/muses/" replace />} />
          <Route path="/about/quotes" element={<Navigate to="/quotes/" replace />} />
          <Route path="/about/:slug" element={<LegacyAboutSutraDetailRedirect />} />
          <Route
            path="/songbooks"
            element={
              <RouteBoundary>
                <SongbooksPage />
              </RouteBoundary>
            }
          />
          <Route
            path="/songbooks/:slug"
            element={
              <RouteBoundary>
                <SongbookPage />
              </RouteBoundary>
            }
          />
          <Route
            path="/tracks"
            element={
              <RouteBoundary>
                <TracksPage />
              </RouteBoundary>
            }
          />
          <Route
            path="/songs/:slug"
            element={
              <RouteBoundary>
                <SongDetail />
              </RouteBoundary>
            }
          />
          <Route
            path="/videos"
            element={
              <RouteBoundary>
                <VideosPage />
              </RouteBoundary>
            }
          />
          <Route
            path="/style-guide"
            element={
              <RouteBoundary>
                <StyleGuidePage />
              </RouteBoundary>
            }
          />
          <Route
            path="/sitemap"
            element={
              <RouteBoundary>
                <SitemapPage />
              </RouteBoundary>
            }
          />
          <Route
            path="/privacy"
            element={
              <RouteBoundary>
                <PrivacyPage />
              </RouteBoundary>
            }
          />
          <Route path="*" element={<NotFoundRoute />} />
        </Routes>
        </CatalogRedirectGuard>
        {BBB_CHAT_ENABLED ? <BbbChatWidget /> : null}
        </PlayerQueueRoot>
      </BrowserRouter>
    </HelmetProvider>
  )
}
