import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { GlobalFooter } from './GlobalFooter'
import { GlobalHeader } from './GlobalHeader'
import { canonicalPathForRoute } from './seoPaths'
import { renderPageMeta } from './usePageMeta'
import { useSyncCatalogHeaderHeight } from './useSyncCatalogHeaderHeight'
import './CatalogApp.css'
import './catalog-page-shell.css'
import './PrivacyPage.css'

const PRIVACY_META = {
  title: 'Privacy',
  description:
    'How BANANASUTRA uses analytics cookies, what Bertrand chat stores, and how to opt out or request deletion.',
}

export function PrivacyPage() {
  const pageRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLElement>(null)

  useSyncCatalogHeaderHeight(pageRef, headerRef, [])

  const pageMeta = renderPageMeta({
    title: PRIVACY_META.title,
    description: PRIVACY_META.description,
    path: canonicalPathForRoute('/privacy'),
  })

  return (
    <div ref={pageRef} className="catalog catalog-page catalog-page--shell privacy-page">
      {pageMeta}
      <GlobalHeader ref={headerRef} />
      <div className="catalog-page__main">
        <main className="catalog-layout-shell privacy-page__main" id="main-content">
          <nav className="catalog-breadcrumbs" aria-label="Breadcrumb">
            <Link className="catalog-breadcrumbs__link" to="/">
              Home
            </Link>
            <span className="catalog-breadcrumbs__sep" aria-hidden>
              /
            </span>
            <span className="catalog-breadcrumbs__current" aria-current="page">
              Privacy
            </span>
          </nav>

          <header className="privacy-page__header">
            <h1 className="privacy-page__title">Privacy</h1>
            <p className="privacy-page__lede">
              Plain language about what this site collects, why, and what you can do about it.
            </p>
          </header>

          <div className="privacy-page__sections">
            <section className="privacy-page__section" aria-labelledby="privacy-collect-heading">
              <h2 id="privacy-collect-heading" className="privacy-page__section-title">
                What we collect
              </h2>
              <p>
                Pages you visit, how you found music, and device type (mobile or desktop). Collected via Google
                Analytics (GA4). No names, no emails, no precise location.
              </p>
            </section>

            <section className="privacy-page__section" aria-labelledby="privacy-why-heading">
              <h2 id="privacy-why-heading" className="privacy-page__section-title">
                Why
              </h2>
              <p>
                To understand which songs and features resonate, so the catalog can improve over time.
              </p>
            </section>

            <section className="privacy-page__section" aria-labelledby="privacy-retention-heading">
              <h2 id="privacy-retention-heading" className="privacy-page__section-title">
                How long
              </h2>
              <p>Analytics data is kept for 14 months, then automatically deleted.</p>
            </section>

            <section className="privacy-page__section" aria-labelledby="privacy-bbb-heading">
              <h2 id="privacy-bbb-heading" className="privacy-page__section-title">
                Bertrand chat
              </h2>
              <p>
                Messages are stored briefly on our server to improve recommendations and fix issues. No account
                required. Chat data is not sold.
              </p>
            </section>

            <section className="privacy-page__section" aria-labelledby="privacy-rights-heading">
              <h2 id="privacy-rights-heading" className="privacy-page__section-title">
                Your rights
              </h2>
              <p>
                To opt out or request deletion, email{' '}
                <a className="privacy-page__link" href="mailto:itsbananasutra@gmail.com">
                  itsbananasutra@gmail.com
                </a>{' '}
                or click &ldquo;No thanks&rdquo; on the cookie banner when it appears.
              </p>
            </section>

            <section className="privacy-page__section" aria-labelledby="privacy-third-party-heading">
              <h2 id="privacy-third-party-heading" className="privacy-page__section-title">
                Third-party links
              </h2>
              <p>
                Analytics is provided by Google. See{' '}
                <a
                  className="privacy-page__link"
                  href="https://policies.google.com/privacy"
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  Google&apos;s privacy policy
                </a>
                .
              </p>
            </section>
          </div>
        </main>
        <GlobalFooter />
      </div>
    </div>
  )
}
