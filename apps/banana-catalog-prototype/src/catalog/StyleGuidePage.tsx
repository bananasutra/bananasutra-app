import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { CatalogPageJumpNav } from './CatalogPageJumpNav'
import { GlobalFooter } from './GlobalFooter'
import { GlobalHeader } from './GlobalHeader'
import { renderPageMeta } from './usePageMeta'
import { useSyncCatalogHeaderHeight } from './useSyncCatalogHeaderHeight'
import './CatalogApp.css'
import './HomePortal.css'
import './StyleGuidePage.css'

const JUMP_ITEMS = [
  { id: 'sg-labels', label: 'Section labels' },
  { id: 'sg-jump-band', label: 'Jump nav band' },
  { id: 'sg-ctas', label: 'CTAs & links' },
  { id: 'sg-breadcrumb', label: 'Breadcrumb' },
  { id: 'sg-page-title', label: 'Page title + lede' },
  { id: 'sg-measure', label: 'Measure cap' },
  { id: 'sg-body', label: 'Body sections' },
] as const

export function StyleGuidePage() {
  const pageRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLElement>(null)

  const pageMeta = renderPageMeta({
    title: 'Style guide · Shell',
    description:
      'Internal shell reference for the BANANASUTRA catalog: breadcrumbs, page titles, jump nav, and CTAs.',
    path: '/style-guide',
  })
  useSyncCatalogHeaderHeight(pageRef, headerRef, [])

  return (
    <div ref={pageRef} className="catalog catalog-page catalog-page--shell">
      {pageMeta}
      <GlobalHeader ref={headerRef} />

      <div className="catalog-page__main">
        <main id="main-content" className="style-guide-page catalog-layout-shell">
          <nav className="catalog-breadcrumbs" aria-label="Breadcrumb">
            <Link className="catalog-breadcrumbs__link" to="/">
              Home
            </Link>
            <span className="catalog-breadcrumbs__sep" aria-hidden>
              /
            </span>
            <span className="catalog-breadcrumbs__current" aria-current="page">
              Style guide
            </span>
          </nav>

          <header className="catalog-page-intro" id="style-guide-top">
            <h1 className="catalog-page-h1">Catalog shell · visual reference</h1>
            <p className="catalog-page-sub">
              Live stack above: breadcrumb → title → lede → jump band (same structure as About / Songbooks). Below: isolated
              demos. Tokens: <code className="style-guide-page__code">--catalog-shell-*</code>,{' '}
              <code className="style-guide-page__code">--catalog-breadcrumb-*</code>,{' '}
              <code className="style-guide-page__code">--catalog-page-title-*</code>.
            </p>
          </header>

          <div className="catalog-page-shell__jump-region">
            <CatalogPageJumpNav ariaLabel="On this style guide" items={[...JUMP_ITEMS]} />
          </div>

          <div className="style-guide-page__body">
            <section className="catalog-page-shell__section" aria-labelledby="sg-labels">
              <h2 id="sg-labels" className="style-guide-page__h2 style-guide-page__anchor-target">
                Section labels (small caps)
              </h2>
              <p className="style-guide-page__p">
                Homepage quote kicker ( <code className="style-guide-page__code">.home-portal__hero-label</code> ) now uses the
                same tokens as the preferred shell kicker. Legacy dense grids may keep{' '}
                <code className="style-guide-page__code">.catalog-section-title</code> (lighter).
              </p>

              <div className="style-guide-page__demo style-guide-page__demo--labels">
                <p className="style-guide-page__demo-title">Visual comparison</p>
                <div className="style-guide-page__compare style-guide-page__compare--triple">
                  <div className="style-guide-page__demo-col">
                    <p className="home-portal__hero-label">Home kicker class</p>
                    <p className="style-guide-page__sample-meta">
                      <code className="style-guide-page__code">.home-portal__hero-label</code>
                      <br />
                      Uses <code className="style-guide-page__code">--catalog-shell-section-label-*</code>
                    </p>
                  </div>
                  <div className="style-guide-page__demo-col">
                    <p className="catalog-section-title">Section h2 (universal)</p>
                    <p className="style-guide-page__sample-meta">
                      <code className="style-guide-page__code">.catalog-section-title</code>
                      <br />
                      Sora bold uppercase, the universal section heading class.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <section className="catalog-page-shell__section" aria-labelledby="sg-jump-band">
              <h2 id="sg-jump-band" className="style-guide-page__h2 style-guide-page__anchor-target">
                Jump nav band
              </h2>
              <p className="style-guide-page__p">
                Wrap <code className="style-guide-page__code">CatalogPageJumpNav</code> in{' '}
                <code className="style-guide-page__code">.catalog-page-shell__jump-region</code>. The wrapper draws both rules
                and sets <code className="style-guide-page__code">--catalog-shell-jump-band-pad-y</code> above and below the
                links; the intro or About hero uses the same token for padding below the lede so gaps stay even.
              </p>

              <div className="style-guide-page__demo">
                <p className="style-guide-page__demo-title">Miniature band (same CSS)</p>
                <div className="style-guide-page__demo-jump-host">
                  <p className="style-guide-page__demo-fake-lede">Fake lede line, spacing to top rule matches token.</p>
                  <div className="catalog-page-shell__jump-region">
                    <nav className="catalog-page-jump-nav" aria-label="Demo jump nav">
                      <ul className="catalog-page-jump-nav__list">
                        <li className="catalog-page-jump-nav__item">
                          <a href="#sg-jump-band" className="catalog-page-jump-nav__link">
                            ↓ Sample link
                          </a>
                        </li>
                        <li className="catalog-page-jump-nav__item">
                          <a href="#sg-jump-band" className="catalog-page-jump-nav__link">
                            ↓ Another
                          </a>
                        </li>
                      </ul>
                    </nav>
                  </div>
                  <p className="style-guide-page__demo-after">Content after band. Margin from bottom rule uses page rhythm.</p>
                </div>
              </div>
            </section>

            <section className="catalog-page-shell__section" aria-labelledby="sg-ctas">
              <h2 id="sg-ctas" className="style-guide-page__h2 style-guide-page__anchor-target">
                CTAs and inline links
              </h2>
              <p className="style-guide-page__p">
                Section CTAs sit at the bottom of their section, right-aligned, uppercase. Use{' '}
                <code className="style-guide-page__code">.catalog-section-cta</code> for all cross-links.
              </p>

              <div className="style-guide-page__demo">
                <p className="style-guide-page__demo-title">Section foot · right-aligned CTA (universal pattern)</p>
                <h3 className="catalog-section-title">Example section</h3>
                <p className="style-guide-page__demo-body">Section content goes here...</p>
                <a className="catalog-section-cta" href="#sg-ctas">
                  Explore more →
                </a>
                <p className="style-guide-page__demo-body">
                  <code className="style-guide-page__code">.catalog-section-cta</code>
                </p>
              </div>

              <div className="style-guide-page__demo">
                <p className="style-guide-page__demo-title">End of section · uppercase link, trailing edge</p>
                <p className="style-guide-page__demo-body">Body copy ends, then exit affordance.</p>
                <p className="style-guide-page__cta-row-end">
                  <a href="#style-guide-top" className="style-guide-page__cta-row-end-link">
                    ↑ Back to top
                  </a>
                </p>
                <p className="style-guide-page__sample-meta">
                  Same treatment as <code className="style-guide-page__code">songbooks-page__section-back</code> / Songbooks
                  "back to top".
                </p>
              </div>

              <div className="style-guide-page__demo">
                <p className="style-guide-page__demo-title">Inline / start-aligned · sentence or list context</p>
                <p className="style-guide-page__demo-body">
                  Use default text links in prose:{' '}
                  <a href="#sg-ctas" className="style-guide-page__demo-inline-link">
                    example link in a sentence
                  </a>
                  . For a lone tertiary action under a block, left-align with body.
                </p>
                <p className="style-guide-page__cta-row-start">
                  <a href="#sg-ctas" className="style-guide-page__demo-tertiary-link">
                    More on this →
                  </a>
                </p>
              </div>
            </section>

            <section className="catalog-page-shell__section" aria-labelledby="sg-breadcrumb">
              <h2 id="sg-breadcrumb" className="style-guide-page__h2 style-guide-page__anchor-target">
                Breadcrumb
              </h2>
              <p className="style-guide-page__p">
                Left-aligned under the fixed header; tokens only ( <code className="style-guide-page__code">--catalog-breadcrumb-*</code> ).
              </p>
              <div className="style-guide-page__demo">
                <nav className="catalog-breadcrumbs" aria-label="Breadcrumb demo">
                  <Link className="catalog-breadcrumbs__link" to="/">
                    Home
                  </Link>
                  <span className="catalog-breadcrumbs__sep" aria-hidden>
                    /
                  </span>
                  <span className="catalog-breadcrumbs__current" aria-current="page">
                    Current page
                  </span>
                </nav>
              </div>
            </section>

            <section className="catalog-page-shell__section" aria-labelledby="sg-page-title">
              <h2 id="sg-page-title" className="style-guide-page__h2 style-guide-page__anchor-target">
                Page title + lede
              </h2>
              <p className="style-guide-page__p">
                <code className="style-guide-page__code">.catalog-page-intro</code>, <code className="style-guide-page__code">.catalog-page-h1</code>,{' '}
                <code className="style-guide-page__code">.catalog-page-sub</code>, or About’s hero classes mapped to the same
                title/lede tokens.
              </p>
              <div className="style-guide-page__demo">
                <header className="catalog-page-intro style-guide-page__demo-reset-intro-pad">
                  <h1 className="catalog-page-h1">Sample page title</h1>
                  <p className="catalog-page-sub">Sample lede: one or two lines using --catalog-page-lede-* tokens.</p>
                </header>
              </div>
            </section>

            <section className="catalog-page-shell__section" aria-labelledby="sg-measure">
              <h2 id="sg-measure" className="style-guide-page__h2 style-guide-page__anchor-target">
                Measure cap (optional)
              </h2>
              <p className="style-guide-page__p">
                <code className="style-guide-page__code">--catalog-shell-lede-measure</code> +{' '}
                <code className="style-guide-page__code">.catalog-page-shell__measure</code> on the paragraph that should stay
                narrow; keep the layout column full width.
              </p>
              <div className="style-guide-page__demo">
                <p className="catalog-page-sub catalog-page-shell__measure">
                  Narrow measure demo: this paragraph is capped so long lines wrap earlier than the demo card edge.
                </p>
              </div>
            </section>

            <section className="catalog-page-shell__section" aria-labelledby="sg-body">
              <h2 id="sg-body" className="style-guide-page__h2 style-guide-page__anchor-target">
                Body sections
              </h2>
              <p className="style-guide-page__p">
                <code className="style-guide-page__code">.catalog-page-shell__section</code>: padding{' '}
                <code className="style-guide-page__code">--catalog-shell-section-pad-y</code>, bottom rule per block (last
                section drops the rule).
              </p>
              <p className="style-guide-page__back">
                <a href="#style-guide-top" className="style-guide-page__back-link">
                  ↑ Back to top
                </a>
              </p>
            </section>
          </div>
        </main>
      </div>

      <GlobalFooter />
    </div>
  )
}
