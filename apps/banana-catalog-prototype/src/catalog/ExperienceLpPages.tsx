/**
 * W-051 — prerender gate stub for /watch only.
 * /learn → LearnLpPage.tsx (W-053). /listen → ListenLpPage.tsx (W-052).
 */
import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { GlobalFooter } from './GlobalFooter'
import { GlobalHeader } from './GlobalHeader'
import { canonicalPathForRoute } from './seoPaths'
import { renderPageMeta } from './usePageMeta'
import { useSyncCatalogHeaderHeight } from './useSyncCatalogHeaderHeight'
import './CatalogApp.css'

type ExperienceLpPath = '/learn' | '/listen' | '/watch'

type ExperienceLpConfig = {
  path: ExperienceLpPath
  navLabel: string
  metaTitle: string
  metaDescription: string
  lead: string
  sub: string
}

const WATCH_LP: ExperienceLpConfig = {
  path: '/watch',
  navLabel: 'Watch',
  metaTitle: 'Watch',
  metaDescription:
    'Picture the songs. Same catalog, eyes open. Music videos and YouTube playlists organized by sutra and story.',
  lead: 'Picture the songs. Same catalog, eyes open.',
  sub: 'Start with what\'s new. Browse playlists by story or by sound when you want the long form.',
}

function ExperienceLpPage({ config }: { config: ExperienceLpConfig }) {
  const pageRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLElement>(null)
  const canonicalPath = canonicalPathForRoute(config.path)

  useSyncCatalogHeaderHeight(pageRef, headerRef, [config.path])

  const pageMeta = renderPageMeta({
    title: config.metaTitle,
    description: config.metaDescription,
    path: canonicalPath,
  })

  return (
    <div ref={pageRef} className="catalog catalog-page catalog-page--shell experience-lp-stub">
      {pageMeta}
      <GlobalHeader ref={headerRef} />
      <div className="catalog-page__main">
        <main className="catalog-layout-shell experience-lp-stub__main" id="main-content">
          <nav className="catalog-breadcrumbs" aria-label="Breadcrumb">
            <Link className="catalog-breadcrumbs__link" to="/">
              Home
            </Link>
            <span className="catalog-breadcrumbs__sep" aria-hidden>
              /
            </span>
            <span className="catalog-breadcrumbs__current" aria-current="page">
              {config.navLabel}
            </span>
          </nav>

          <header className="catalog-page-intro">
            <h1 className="catalog-page-intro__title experience-lp-stub__title">{config.lead}</h1>
            <p className="catalog-page-intro__lead">{config.sub}</p>
          </header>
        </main>
      </div>
      <GlobalFooter />
    </div>
  )
}

export { LearnLpPage } from './LearnLpPage'
export { ListenLpPage } from './ListenLpPage'

export function WatchLpPage() {
  return <ExperienceLpPage config={WATCH_LP} />
}
