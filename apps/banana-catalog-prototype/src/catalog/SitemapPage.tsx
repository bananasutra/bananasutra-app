import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { GlobalFooter } from './GlobalFooter'
import { GlobalHeader } from './GlobalHeader'
import { useDocumentTitle } from './useDocumentTitle'
import { useSyncCatalogHeaderHeight } from './useSyncCatalogHeaderHeight'
import './CatalogApp.css'
import './SitemapPage.css'

const SITEMAP_SECTIONS = [
  {
    heading: 'Explore',
    links: [
      { to: '/', label: 'Home' },
      { to: '/songs', label: 'Songs — browse & filter the catalog' },
      { to: '/tracks', label: 'Tracks — audio player view' },
      { to: '/videos', label: 'Videos — YouTube catalog' },
      { to: '/words', label: 'Words — lyrics & writing' },
    ],
  },
  {
    heading: 'Discover',
    links: [
      { to: '/songbooks', label: 'Songbooks — thematic collections' },
      { to: '/about', label: 'About — what is Bananasutra' },
      { to: '/about#sutras', label: 'The seven sutras' },
    ],
  },
] as const

export function SitemapPage() {
  const pageRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLElement>(null)

  useDocumentTitle('Sitemap')
  useSyncCatalogHeaderHeight(pageRef, headerRef, [])

  return (
    <div ref={pageRef} className="catalog catalog-page catalog-page--shell">
      <GlobalHeader ref={headerRef} />

      <div className="catalog-page__main">
        <article className="sitemap-page catalog-layout-shell" id="main-content">
          <nav className="catalog-breadcrumbs" aria-label="Breadcrumb">
            <Link className="catalog-breadcrumbs__link" to="/">
              Home
            </Link>
            <span className="catalog-breadcrumbs__sep" aria-hidden>
              /
            </span>
            <span className="catalog-breadcrumbs__current" aria-current="page">
              Sitemap
            </span>
          </nav>

          <header className="catalog-page-intro">
            <h1 className="catalog-page-h1">Sitemap</h1>
          </header>

          <div className="sitemap-page__body">
            {SITEMAP_SECTIONS.map((section) => (
              <section key={section.heading} className="sitemap-page__section">
                <h2 className="sitemap-page__heading">{section.heading}</h2>
                <ul className="sitemap-page__list">
                  {section.links.map((link) => (
                    <li key={link.to} className="sitemap-page__item">
                      <Link to={link.to} className="sitemap-page__link">
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </article>
      </div>

      <GlobalFooter />
    </div>
  )
}
