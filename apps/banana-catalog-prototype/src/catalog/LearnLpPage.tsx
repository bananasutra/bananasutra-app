import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { GlobalFooter } from './GlobalFooter'
import { GlobalHeader } from './GlobalHeader'
import { LearnLpBertrandTail } from './LearnLpBertrandTail'
import { LearnLpFaq } from './LearnLpFaq'
import { LearnLpHub } from './LearnLpHub'
import { LearnLpMoodEntry } from './LearnLpMoodEntry'
import { LearnLpWaysToExplore } from './LearnLpWaysToExplore'
import { LEARN_LP_META } from './learnLpData'
import { useSongCatalogBrowse } from './generatedData'
import { canonicalPathForRoute } from './seoPaths'
import { renderPageMeta } from './usePageMeta'
import { useSyncCatalogHeaderHeight } from './useSyncCatalogHeaderHeight'
import './CatalogApp.css'
import './catalog-page-shell.css'
import './LearnLpPage.css'
import './LearnLpWaysToExplore.css'
import './WordsPage.css'

export function LearnLpPage() {
  const pageRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLElement>(null)
  const { data: songCatalogRows } = useSongCatalogBrowse()

  useSyncCatalogHeaderHeight(pageRef, headerRef, [songCatalogRows?.length ?? -1])

  const pageMeta = renderPageMeta({
    title: LEARN_LP_META.title,
    description: LEARN_LP_META.description,
    path: canonicalPathForRoute('/learn'),
  })

  return (
    <div ref={pageRef} className="catalog catalog-page catalog-page--shell learn-lp">
      {pageMeta}
      <GlobalHeader ref={headerRef} />
      <div className="catalog-page__main">
        <main className="catalog-layout-shell learn-lp__main" id="main-content">
          <nav className="catalog-breadcrumbs" aria-label="Breadcrumb">
            <Link className="catalog-breadcrumbs__link" to="/">
              Home
            </Link>
            <span className="catalog-breadcrumbs__sep" aria-hidden>
              /
            </span>
            <span className="catalog-breadcrumbs__current" aria-current="page">
              Learn
            </span>
          </nav>

          <header className="catalog-page-intro learn-lp__intro">
            <h1 className="catalog-page-h1">{LEARN_LP_META.lead}</h1>
            <p className="catalog-page-sub">{LEARN_LP_META.sub}</p>
          </header>

          <LearnLpHub songCatalog={songCatalogRows} />
          <LearnLpWaysToExplore />
          <LearnLpFaq />
          <LearnLpMoodEntry songCatalog={songCatalogRows} />
          <LearnLpBertrandTail />
        </main>
      </div>
      <GlobalFooter />
    </div>
  )
}
