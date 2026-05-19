import { Component, lazy, Suspense, type ReactNode, useEffect, useLayoutEffect, useState } from 'react'
import { HelmetProvider } from 'react-helmet-async'
import { BrowserRouter, Link, Route, Routes, useLocation } from 'react-router-dom'
import { NavigationLoadingBridge } from './NavigationLoadingBridge'
import { prefetchCatalogRoutesIdle } from './routePrefetch'
import { SearchRedirect } from './catalog/SearchRedirect'
import { useAnalyticsPageView } from './useAnalyticsPageView'

const HomePortal = lazy(() => import('./catalog/HomePortal').then((m) => ({ default: m.HomePortal })))
const AboutPage = lazy(() => import('./catalog/AboutPage').then((m) => ({ default: m.AboutPage })))
const AboutSutrasPage = lazy(() => import('./catalog/AboutPage').then((m) => ({ default: m.AboutSutrasPage })))
const AboutMusesPage = lazy(() => import('./catalog/AboutPage').then((m) => ({ default: m.AboutMusesPage })))
const AboutQuotesPage = lazy(() => import('./catalog/AboutPage').then((m) => ({ default: m.AboutQuotesPage })))
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

/** Browse route — `CatalogApp` syncs sort + facet state from `location.search` without remounting
 * so UI state (e.g. filters panel open/closed) survives sort-only URL updates. */
function CatalogBrowseRoute() {
  return <CatalogApp />
}

function AppRouteFallback() {
  const [showSlowFallback, setShowSlowFallback] = useState(false)
  useEffect(() => {
    const id = window.setTimeout(() => setShowSlowFallback(true), 12000)
    return () => window.clearTimeout(id)
  }, [])
  return (
    <div className="app-route-fallback" role="status" aria-live="polite" aria-busy="true">
      <span className="app-route-fallback__spinner" aria-hidden />
      <p className="app-route-fallback__label">Loading…</p>
      {showSlowFallback ? (
        <p className="app-route-fallback__hint">
          This is taking longer than usual. If needed, you can retry this page.
        </p>
      ) : null}
      {showSlowFallback ? (
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
      <p className="app-route-fallback__label">Couldn&apos;t load this page yet.</p>
      <p className="app-route-fallback__hint">
        Your connection may have dropped for a moment. Retry and we&apos;ll keep your URL.
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

function NotFoundRoute() {
  return (
    <div className="catalog catalog-page catalog-page--shell">
      <div className="catalog-page__main">
        <main id="main-content" className="songbooks-page songbooks-page--missing">
          <p className="songbooks-page__missing-title">OOPS — page not found.</p>
          <p className="songbooks-page__missing-sub">
            The route does not exist in this build. Use Home to keep exploring.
          </p>
          <Link to="/" className="songbooks-page__back-link">
            Peel me back home
          </Link>
        </main>
      </div>
    </div>
  )
}

function BootPrefetch() {
  useEffect(() => {
    // Route prefetch policy is centralized in routePrefetch.ts.
    prefetchCatalogRoutesIdle()
  }, [])
  return null
}

/** SPA default keeps scroll position on navigate; restore document scroll when the path changes. */
function ScrollToTopOnNavigate() {
  const { pathname } = useLocation()
  useLayoutEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  useAnalyticsPageView()

  return null
}

/** Catalog routes — see `_docs/CATALOG-GLOBAL-CHROME.md` and `_docs/CATALOG-IA.md`. */
export default function App() {
  const routerBasename =
    typeof window !== 'undefined' && window.location.hostname.endsWith('.github.io')
      ? GITHUB_PROJECT_BASENAME
      : undefined

  return (
    <HelmetProvider>
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <BrowserRouter basename={routerBasename}>
        <BootPrefetch />
        <NavigationLoadingBridge />
        <ScrollToTopOnNavigate />
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
            path="/about/sutras"
            element={
              <RouteBoundary>
                <AboutSutrasPage />
              </RouteBoundary>
            }
          />
          <Route
            path="/about/muses"
            element={
              <RouteBoundary>
                <AboutMusesPage />
              </RouteBoundary>
            }
          />
          <Route
            path="/about/quotes"
            element={
              <RouteBoundary>
                <AboutQuotesPage />
              </RouteBoundary>
            }
          />
          <Route
            path="/about/:slug"
            element={
              <RouteBoundary>
                <SutraDetailPage />
              </RouteBoundary>
            }
          />
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
          <Route path="*" element={<NotFoundRoute />} />
        </Routes>
      </BrowserRouter>
    </HelmetProvider>
  )
}
