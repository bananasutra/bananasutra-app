import { useRef } from 'react'
import { Link } from 'react-router-dom'
import songCatalogBrowseJson from '../data/generated/song_catalog_browse.json'
import songbookCatalogJson from '../data/generated/songbook_catalog.json'
import { GlobalFooter } from './GlobalFooter'
import { GlobalHeader } from './GlobalHeader'
import { songCatalogPath, songbookCatalogPath } from './songPaths'
import {
  SUTRA_CONTEXT,
  SUTRA_INDEX_CORE_ORDER,
  sutraHrefForFamily,
  type SutraContextEntry,
} from './sutraContext'
import type { SongCatalogItem, SongbookCatalogItem } from './types'
import { canonicalPathForRoute } from './seoPaths'
import { renderPageMeta } from './usePageMeta'
import { useSyncCatalogHeaderHeight } from './useSyncCatalogHeaderHeight'
import './CatalogApp.css'
import './SitemapPage.css'

const CORE_LINKS: { to: string; label: string; pathLabel: string; description: string }[] = [
  {
    to: '/',
    label: 'Home',
    pathLabel: '/',
    description: 'Discovery search, featured releases, and paths into songs, words, and videos.',
  },
  {
    to: canonicalPathForRoute('/about'),
    label: 'About',
    pathLabel: canonicalPathForRoute('/about'),
    description: 'What BANANASUTRA is, why the project exists, and who is behind it.',
  },
  {
    to: canonicalPathForRoute('/songbooks'),
    label: 'Songbooks & Playlists',
    pathLabel: canonicalPathForRoute('/songbooks'),
    description: 'Curated SoundCloud playlists by sutra, genre, language, and editorial collections.',
  },
  {
    to: canonicalPathForRoute('/songs'),
    label: 'Songs Catalog',
    pathLabel: canonicalPathForRoute('/songs'),
    description: 'Browse the full song grid — sutra, topic, intention, genre, language, and text search.',
  },
  {
    to: canonicalPathForRoute('/tracks'),
    label: 'Top Tracks',
    pathLabel: canonicalPathForRoute('/tracks'),
    description: 'SoundCloud tracks ranked and filtered — tempo, genre, instruments, moods.',
  },
  {
    to: canonicalPathForRoute('/videos'),
    label: 'Music Videos',
    pathLabel: canonicalPathForRoute('/videos'),
    description: 'YouTube catalog — filter by sutra, topic, intention, and in-app vs YouTube-only.',
  },
  {
    to: canonicalPathForRoute('/words'),
    label: 'Lyrics & Words',
    pathLabel: canonicalPathForRoute('/words'),
    description: 'Lyrics-first surface — writing stages, searchable words, meaning before polish.',
  },
  {
    to: canonicalPathForRoute('/sitemap'),
    label: 'Sitemap (HTML)',
    pathLabel: canonicalPathForRoute('/sitemap'),
    description: 'Human-readable site index with section-by-section links.',
  },
]

const ABOUT_HUB_LINKS: { to: string; label: string; pathLabel: string; description: string }[] = [
  {
    to: canonicalPathForRoute('/about/sutras'),
    label: 'About / Sutras',
    pathLabel: canonicalPathForRoute('/about/sutras'),
    description: 'Overview of the seven sutras and how they frame the catalog.',
  },
  {
    to: canonicalPathForRoute('/about/muses'),
    label: 'About / Muses',
    pathLabel: canonicalPathForRoute('/about/muses'),
    description: 'The people, references, and influences behind the songs.',
  },
  {
    to: canonicalPathForRoute('/about/quotes'),
    label: 'About / Quotes',
    pathLabel: canonicalPathForRoute('/about/quotes'),
    description: 'Quote wall with links into related songs and themes.',
  },
]

const songbookCatalog = songbookCatalogJson as SongbookCatalogItem[]
const songCatalogBrowse = songCatalogBrowseJson as SongCatalogItem[]

const SONGBOOK_LINKS: { to: string; label: string; pathLabel: string; description: string }[] = (() => {
  const seen = new Set<string>()
  const list: { to: string; label: string; pathLabel: string; description: string }[] = []
  for (const row of songbookCatalog) {
    const slug = (row.url_slug_songbook || '').trim()
    if (!slug || seen.has(slug)) continue
    seen.add(slug)
    const to = songbookCatalogPath(slug)
    list.push({
      to,
      label: row.songbook,
      pathLabel: to,
      description: row.description || 'Songbook detail page.',
    })
  }
  return list.sort((a, b) => a.label.localeCompare(b.label))
})()

const SONG_LINKS: { to: string; label: string; pathLabel: string; description: string }[] = (() => {
  const seenLyricsIds = new Set<string>()
  const list: { to: string; label: string; pathLabel: string; description: string }[] = []
  for (const row of songCatalogBrowse) {
    const lyricsId = (row.lyrics_id || '').trim()
    if (!lyricsId || seenLyricsIds.has(lyricsId)) continue
    seenLyricsIds.add(lyricsId)
    const to = songCatalogPath(row.lyrics_title, row.url_slug)
    list.push({
      to,
      label: row.lyrics_title || lyricsId,
      pathLabel: to,
      description: row.summary_short || row.lyrics_extract || 'Song detail page.',
    })
  }
  return list.sort((a, b) => a.label.localeCompare(b.label))
})()

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
    path: canonicalPathForRoute('/sitemap'),
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
              <h2 className="sitemap-page__heading">Core pages</h2>
              <ul className="sitemap-page__list">
                {CORE_LINKS.map((item) => (
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
              <h2 className="sitemap-page__heading">About hubs</h2>
              <ul className="sitemap-page__list">
                {ABOUT_HUB_LINKS.map((item) => (
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
              <h2 className="sitemap-page__heading">Sutra pages</h2>
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
              <h2 className="sitemap-page__heading">Songbook pages ({SONGBOOK_LINKS.length})</h2>
              <ul className="sitemap-page__list">
                {SONGBOOK_LINKS.map((item) => (
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
              <h2 className="sitemap-page__heading">Song pages ({SONG_LINKS.length})</h2>
              <ul className="sitemap-page__list">
                {SONG_LINKS.map((item) => (
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
              <h2 className="sitemap-page__heading">SEO files</h2>
              <ul className="sitemap-page__list">
                <li className="sitemap-page__item">
                  <div className="sitemap-page__row">
                    <a href="/sitemap.xml" className="sitemap-page__link">
                      XML Sitemap
                    </a>
                    <span className="sitemap-page__path">/sitemap.xml</span>
                  </div>
                  <p className="sitemap-page__desc">Machine-readable sitemap used by search engines and Search Console.</p>
                </li>
                <li className="sitemap-page__item">
                  <div className="sitemap-page__row">
                    <a href="/robots.txt" className="sitemap-page__link">
                      Robots
                    </a>
                    <span className="sitemap-page__path">/robots.txt</span>
                  </div>
                  <p className="sitemap-page__desc">Crawl directives and XML sitemap reference.</p>
                </li>
              </ul>
            </section>
          </div>
        </article>
      </div>

      <GlobalFooter />
    </div>
  )
}
