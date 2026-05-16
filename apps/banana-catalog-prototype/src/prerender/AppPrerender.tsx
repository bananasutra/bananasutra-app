/**
 * R24 — SSR tree for static pre-render (eager imports, StaticRouter, no analytics/boot prefetch).
 */
import { StrictMode } from 'react'
import { Link, Route, Routes, StaticRouter } from 'react-router-dom'
import { ThemeProvider } from '../catalog/theme'
import { HomePortal } from '../catalog/HomePortal'
import { AboutPage, AboutMusesPage, AboutQuotesPage, AboutSutrasPage } from '../catalog/AboutPage'
import { CatalogApp } from '../catalog/CatalogApp'
import { SongbookPage } from '../catalog/SongbookPage'
import { SongbooksPage } from '../catalog/SongbooksPage'
import { SongDetail } from '../catalog/SongDetail'
import { TracksPage } from '../catalog/TracksPage'
import { VideosPage } from '../catalog/VideosPage'
import { WordsPage } from '../catalog/WordsPage'
import { SutraDetailPage } from '../catalog/SutraDetailPage'
import { StyleGuidePage } from '../catalog/StyleGuidePage'
import { SitemapPage } from '../catalog/SitemapPage'
import { SearchRedirect } from '../catalog/SearchRedirect'

function NotFoundRoute() {
  return (
    <div className="catalog catalog-page catalog-page--shell">
      <div className="catalog-page__main">
        <main id="main-content" className="songbooks-page songbooks-page--missing">
          <p className="songbooks-page__missing-title">OOPS — page not found.</p>
          <Link to="/" className="songbooks-page__back-link">
            Peel me back home
          </Link>
        </main>
      </div>
    </div>
  )
}

function CatalogBrowseRoute() {
  return <CatalogApp />
}

export function AppPrerender({ location }: { location: string }) {
  return (
    <StrictMode>
      <ThemeProvider>
        <StaticRouter location={location}>
            <a href="#main-content" className="skip-link">
              Skip to main content
            </a>
            <Routes>
              <Route path="/" element={<HomePortal />} />
              <Route path="/songs" element={<CatalogBrowseRoute />} />
              <Route path="/words" element={<WordsPage />} />
              <Route path="/search" element={<SearchRedirect />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/about/sutras" element={<AboutSutrasPage />} />
              <Route path="/about/muses" element={<AboutMusesPage />} />
              <Route path="/about/quotes" element={<AboutQuotesPage />} />
              <Route path="/about/:slug" element={<SutraDetailPage />} />
              <Route path="/songbooks" element={<SongbooksPage />} />
              <Route path="/songbooks/:slug" element={<SongbookPage />} />
              <Route path="/tracks" element={<TracksPage />} />
              <Route path="/songs/:slug" element={<SongDetail />} />
              <Route path="/videos" element={<VideosPage />} />
              <Route path="/style-guide" element={<StyleGuidePage />} />
              <Route path="/sitemap" element={<SitemapPage />} />
              <Route path="*" element={<NotFoundRoute />} />
            </Routes>
        </StaticRouter>
      </ThemeProvider>
    </StrictMode>
  )
}
