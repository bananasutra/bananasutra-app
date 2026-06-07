/**
 * W-051 — prerender gate stubs for /learn, /listen, /watch.
 * Full LP implementation lands in W-052–W-054; copy here matches approved prototypes.
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

const LEARN_LP: ExperienceLpConfig = {
  path: '/learn',
  navLabel: 'Learn',
  metaTitle: 'Learn',
  metaDescription:
    'What is bananasutra? Start here. The songs make more sense once you know the sutras. Orientation hub for sutras, muses, quotes, and words.',
  lead: 'What is bananasutra? Start here. The songs make more sense once you know the sutras.',
  sub:
    'An audio testament. True stories organized by the seven questions I navigate by. Open a door; see what\'s inside before you commit.',
}

const LISTEN_LP: ExperienceLpConfig = {
  path: '/listen',
  navLabel: 'Listen',
  metaTitle: 'Listen',
  metaDescription:
    'Press play. The catalog is already sorted into stories. Top tracks for a quick hit. Songbooks when you want a longer ride. Full lyrics on song pages.',
  lead: 'Press play. The catalog is already sorted into stories.',
  sub: 'Top tracks for a quick hit. Songbooks when you want a longer ride. Full lyrics on song pages.',
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

export function LearnLpPage() {
  return <ExperienceLpPage config={LEARN_LP} />
}

export function ListenLpPage() {
  return <ExperienceLpPage config={LISTEN_LP} />
}

export function WatchLpPage() {
  return <ExperienceLpPage config={WATCH_LP} />
}
