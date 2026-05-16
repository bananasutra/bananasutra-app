import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { GlobalFooter } from './GlobalFooter'
import { GlobalHeader } from './GlobalHeader'
import {
  SUTRA_CONTEXT,
  SUTRA_INDEX_CORE_ORDER,
  sutraHrefForFamily,
  type SutraContextEntry,
} from './sutraContext'
import { renderPageMeta } from './usePageMeta'
import { useSyncCatalogHeaderHeight } from './useSyncCatalogHeaderHeight'
import './CatalogApp.css'
import './SitemapPage.css'

const BROWSE_LINKS: { to: string; label: string; pathLabel: string; description: string }[] = [
  {
    to: '/songs',
    label: 'Songs Catalog',
    pathLabel: '/songs',
    description: 'Browse the full song grid — sutra, topic, intention, genre, language, and text search.',
  },
  {
    to: '/tracks',
    label: 'Top Tracks',
    pathLabel: '/tracks',
    description: 'SoundCloud tracks ranked and filtered — tempo, genre, instruments, moods.',
  },
  {
    to: '/videos',
    label: 'Music Videos',
    pathLabel: '/videos',
    description: 'YouTube catalog — filter by sutra, topic, intention, and in-app vs YouTube-only.',
  },
  {
    to: '/words',
    label: 'Lyrics & Words',
    pathLabel: '/words',
    description: 'Lyrics-first surface — writing stages, searchable words, meaning before polish.',
  },
  {
    to: '/songbooks',
    label: 'Songbooks & Playlists',
    pathLabel: '/songbooks',
    description: 'Curated SoundCloud playlists by sutra, genre, language, and editorial collections.',
  },
]

const ABOUT_LINKS: { to: string; label: string; pathLabel: string; description: string }[] = [
  {
    to: '/about',
    label: 'About the Sutras',
    pathLabel: '/about',
    description: 'What BANANASUTRA is — the seven sutras as a compass, plus who’s behind the project.',
  },
  {
    to: '/',
    label: 'Home',
    pathLabel: '/',
    description: 'Discovery search, featured releases, and paths into songs, words, and videos.',
  },
]

function sutraSearchBlurb(entry: SutraContextEntry): string {
  const when = (entry.sutra_when || '').trim()
  if (when) return when
  const essence = (entry.sutra_card_essence || '').trim()
  if (essence) return essence
  return `${entry.question} · ${entry.practice} · ${entry.themes}`
}

export function SitemapPage() {
  const pageRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLElement>(null)

  const pageMeta = renderPageMeta({
    title: 'Sitemap',
    description: 'Full sitemap of BANANASUTRA — all pages, all sutras, all ways to explore.',
    path: '/sitemap',
  })
  useSyncCatalogHeaderHeight(pageRef, headerRef, [])

  return (
    <div ref={pageRef} className="catalog catalog-page catalog-page--shell">
      {pageMeta}
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
            <section className="sitemap-page__section">
              <h2 className="sitemap-page__heading">Browse the catalog</h2>
              <ul className="sitemap-page__list">
                {BROWSE_LINKS.map((item) => (
                  <li key={item.to} className="sitemap-page__item">
                    <div className="sitemap-page__row">
                      <Link to={item.to} className="sitemap-page__link">
                        {item.label}
                      </Link>
                      <span className="sitemap-page__path">{item.pathLabel}</span>
                    </div>
                    <p className="sitemap-page__desc">{item.description}</p>
                  </li>
                ))}
              </ul>
            </section>

            <section className="sitemap-page__section">
              <h2 className="sitemap-page__heading">The sutras</h2>
              <p className="sitemap-page__section-lede">
                Seven core lanes plus QUACK (a BLOW sub-sutra) — same slugs as the About page.
              </p>
              <ul className="sitemap-page__list">
                {SUTRA_INDEX_CORE_ORDER.map((key) => {
                  const entry = SUTRA_CONTEXT[key]
                  const href = sutraHrefForFamily(key)
                  return (
                    <li key={key} className="sitemap-page__item">
                      <div className="sitemap-page__row">
                        <Link to={href} className="sitemap-page__link">
                          {entry.sutra}
                        </Link>
                        <span className="sitemap-page__path">{href}</span>
                      </div>
                      <p className="sitemap-page__desc">{sutraSearchBlurb(entry)}</p>
                    </li>
                  )
                })}
                <li className="sitemap-page__item sitemap-page__item--quack">
                  <div className="sitemap-page__row">
                    <Link to={sutraHrefForFamily('QUACK')} className="sitemap-page__link">
                      {SUTRA_CONTEXT.QUACK.sutra}
                    </Link>
                    <span className="sitemap-page__path">{sutraHrefForFamily('QUACK')}</span>
                  </div>
                  <p className="sitemap-page__desc">{sutraSearchBlurb(SUTRA_CONTEXT.QUACK)}</p>
                </li>
              </ul>
            </section>

            <section className="sitemap-page__section">
              <h2 className="sitemap-page__heading">About</h2>
              <ul className="sitemap-page__list">
                {ABOUT_LINKS.map((item) => (
                  <li key={item.to} className="sitemap-page__item">
                    <div className="sitemap-page__row">
                      <Link to={item.to} className="sitemap-page__link">
                        {item.label}
                      </Link>
                      <span className="sitemap-page__path">{item.pathLabel}</span>
                    </div>
                    <p className="sitemap-page__desc">{item.description}</p>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </article>
      </div>

      <GlobalFooter />
    </div>
  )
}
