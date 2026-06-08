/**
 * R24 — SSR tree for static pre-render (eager imports, StaticRouter, no analytics/boot prefetch).
 */
import { StrictMode } from 'react'
import { Route, Routes, StaticRouter, Navigate } from 'react-router-dom'
import { ThemeProvider } from '../catalog/theme'
import { LearnLpPage, ListenLpPage, WatchLpPage } from '../catalog/ExperienceLpPages'
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
import { NotFoundRoute } from '../catalog/NotFoundRoute'

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
              <Route path="/learn" element={<LearnLpPage />} />
              <Route path="/listen" element={<ListenLpPage />} />
              <Route path="/watch" element={<WatchLpPage />} />
              <Route path="/songs" element={<CatalogBrowseRoute />} />
              <Route path="/words" element={<WordsPage />} />
              <Route path="/search" element={<SearchRedirect />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/sutras" element={<AboutSutrasPage />} />
              <Route path="/muses" element={<AboutMusesPage />} />
              <Route path="/quotes" element={<AboutQuotesPage />} />
              <Route path="/about/sutras" element={<Navigate to="/sutras/" replace />} />
              <Route path="/about/muses" element={<Navigate to="/muses/" replace />} />
              <Route path="/about/quotes" element={<Navigate to="/quotes/" replace />} />
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
