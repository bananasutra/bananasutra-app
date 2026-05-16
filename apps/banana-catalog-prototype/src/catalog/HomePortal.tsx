import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useLocation, useSearchParams } from 'react-router-dom'
import homeQuotesJson from '../data/generated/home_quotes.json'
import buildSummaryJson from '../data/generated/_build_summary.json'
import songCatalogBrowseJson from '../data/generated/song_catalog_browse.json'
import songbookCatalogJson from '../data/generated/songbook_catalog.json'
import { GlobalFooter } from './GlobalFooter'
import { GlobalHeader } from './GlobalHeader'
import { LazySoundCloudEmbed } from './LazySoundCloudEmbed'
import {
  resolveHiddenPeelsSongbook,
  songbookFeaturedKickerLabel,
  songbookHrefFromCatalogItem,
} from './homePortalUtils'
import { browseRowHasAudioSection, songCatalogLinkTo } from './songPaths'
import { SongThumbCard } from './SongThumbCard'
import type { SongCatalogItem, SongbookCatalogItem } from './types'
import { browsePathWithQuery, canonicalPathForRoute } from './seoPaths'
import { buildBrowsePathForFacet, CATALOG_BROWSE_PATH, searchHasBrowseParams } from './urlState'
import { ABOUT_SUTRAS_HREF } from './iaPaths'
import { SUTRA_CONTEXT, sutraHrefForFamily } from './sutraContext'
import { PageMeta } from './PageMeta'
import { websiteJsonLd } from '../seo/jsonLd'
import { useSyncCatalogHeaderHeight } from './useSyncCatalogHeaderHeight'
import { hasListenerCatalogMedia } from './listenerCatalog'
import { SongbookPlaylistMetaLine } from './SongbookPlaylistMetaLine'
import { songOnWordsSurface } from './wordsStory'
import './CatalogApp.css'
import './HomePortal.css'

type HomeQuote = {
  quote: string
  muse?: string
  primary_sutra?: string
  secondary_sutras?: string
  core_topic?: string
}

const HOME_QUOTES_FALLBACK: HomeQuote[] = [
  { quote: 'Ask better questions. Keep the signal.' },
  { quote: 'Truth without wonder turns brittle.' },
  { quote: 'Play is serious soul maintenance.' },
  { quote: 'No king. No guru. Stay curious.' },
  { quote: 'Trust the flow, then test the claim.' },
]

const RAW_QUOTES = (homeQuotesJson as HomeQuote[]).filter((item) => item && item.quote && item.quote.trim())

function isFilteredHeroQuote(q: HomeQuote): boolean {
  const m = (q.muse || '').toLowerCase()
  return m.includes('don ducky') || m.includes('ducky')
}

const HOME_QUOTES = RAW_QUOTES.filter((q) => !isFilteredHeroQuote(q))

type ChromeBuildSummary = {
  songbooks?: number
}

const BUILD_SUMMARY = buildSummaryJson as ChromeBuildSummary
const HOME_BROWSE_CATALOG = songCatalogBrowseJson as SongCatalogItem[]
/** Matches `.song-thumb-grid--home`: 6 cols desktop, 3 cols tablet/mobile */
const LATEST_DROPS_LIMIT = 6

function buildSummaryCount(key: string): number {
  const v = (buildSummaryJson as Record<string, unknown>)[key]
  return typeof v === 'number' ? v : 0
}

const SUTRA_GRID_KEYS = ['KNOW', 'BLOW', 'SHOW', 'GROW', 'FLOW', 'GLOW', 'BOW', 'QUACK'] as const

function formatCount(n: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(n)
}

function songHasReleasedListenerAudio(s: SongCatalogItem): boolean {
  return Boolean(s.has_in_app_playback || s.has_sc_catalog_listen || (s.primary_ep_url || '').trim())
}

function songHasReleasedVideo(s: SongCatalogItem): boolean {
  return Boolean(s.has_youtube_video)
}

function songHasAudioOrVideo(s: SongCatalogItem): boolean {
  return songHasReleasedListenerAudio(s) || songHasReleasedVideo(s)
}

function parsePublishedAt(raw: string): number {
  const n = Date.parse((raw || '').trim())
  return Number.isNaN(n) ? 0 : n
}

function quoteForVisit(quotes: HomeQuote[]): HomeQuote {
  const pool = quotes.length ? quotes : HOME_QUOTES_FALLBACK
  const idx = Math.floor(Math.random() * pool.length)
  return pool[Math.max(0, Math.min(pool.length - 1, idx))]
}

function sutraToneClass(value: string): string {
  const v = value.trim().toUpperCase()
  if (v.startsWith('KNOW')) return 'home-portal__quote-sutra--know'
  if (v.startsWith('BLOW')) return 'home-portal__quote-sutra--blow'
  if (v.startsWith('SHOW')) return 'home-portal__quote-sutra--show'
  if (v.startsWith('GROW')) return 'home-portal__quote-sutra--grow'
  if (v.startsWith('FLOW')) return 'home-portal__quote-sutra--flow'
  if (v.startsWith('GLOW')) return 'home-portal__quote-sutra--glow'
  if (v.startsWith('BOW')) return 'home-portal__quote-sutra--bow'
  if (v.startsWith('QUACK')) return 'home-portal__quote-sutra--quack'
  return ''
}

function sutraFamilyFromDisplay(value: string): keyof typeof SUTRA_CONTEXT | null {
  const v = value.trim().toUpperCase()
  if (v.startsWith('KNOW')) return 'KNOW'
  if (v.startsWith('BLOW')) return 'BLOW'
  if (v.startsWith('SHOW')) return 'SHOW'
  if (v.startsWith('GROW')) return 'GROW'
  if (v.startsWith('FLOW')) return 'FLOW'
  if (v.startsWith('GLOW')) return 'GLOW'
  if (v.startsWith('BOW')) return 'BOW'
  if (v.startsWith('QUACK')) return 'QUACK'
  return null
}

export function HomePortal() {
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const pageRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLElement>(null)
  const legacyRedirect = location.pathname === '/' && searchHasBrowseParams(location.search)
  const fullSearch = searchParams.toString()

  const featuredQuote = useMemo(() => quoteForVisit(HOME_QUOTES), [location.key])
  const [typedQuote, setTypedQuote] = useState('')
  const typingIntervalRef = useRef<number | undefined>(undefined)
  const muse = (featuredQuote.muse || '').trim()
  const primarySutraDisplay = (featuredQuote.primary_sutra || '').trim()
  const quoteMetaParts = [muse, primarySutraDisplay].filter(Boolean)

  const homePlaylistSongbook = useMemo(
    () => resolveHiddenPeelsSongbook((songbookCatalogJson as SongbookCatalogItem[]) ?? []),
    [],
  )

  const latestDrops = useMemo(
    () =>
      [...HOME_BROWSE_CATALOG]
        .filter((s) => songHasAudioOrVideo(s) && parsePublishedAt(s.published_at) > 0)
        .sort((a, b) => parsePublishedAt(b.published_at) - parsePublishedAt(a.published_at))
        .slice(0, LATEST_DROPS_LIMIT),
    [],
  )

  const wordsSurfaceCount = useMemo(
    () => HOME_BROWSE_CATALOG.filter(songOnWordsSurface).length,
    [],
  )

  /** Same inclusion rule as `/songs` browse grid (`CatalogApp` → `hasListenerCatalogMedia`). */
  const songsBrowseGridCount = useMemo(
    () => HOME_BROWSE_CATALOG.filter(hasListenerCatalogMedia).length,
    [],
  )

  /** Matches searchable catalog rows (same pool as `/words` + rest of catalog). */
  const searchDiscoverRowCount = HOME_BROWSE_CATALOG.length

  const songbooksCount = BUILD_SUMMARY.songbooks ?? 0

  useEffect(() => {
    let cancelled = false
    const scheduleIdle = (fn: () => void) => {
      const ric = globalThis.requestIdleCallback as ((cb: IdleRequestCallback, opts?: IdleRequestOptions) => number) | undefined
      if (typeof ric === 'function') {
        const id = ric(
          () => {
            if (!cancelled) fn()
          },
          { timeout: 1200 },
        )
        return () => globalThis.cancelIdleCallback?.(id)
      }
      const tid = window.setTimeout(() => {
        if (!cancelled) fn()
      }, 0)
      return () => window.clearTimeout(tid)
    }

    const cleanupIdle = scheduleIdle(() => {
      if (cancelled) return
      if (typingIntervalRef.current !== undefined) {
        window.clearInterval(typingIntervalRef.current)
        typingIntervalRef.current = undefined
      }
      const full = featuredQuote.quote || ''
      if (!full) {
        setTypedQuote('')
        return
      }
      const reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
      if (reducedMotion) {
        setTypedQuote(full)
        return
      }
      setTypedQuote('')
      let idx = 0
      typingIntervalRef.current = window.setInterval(() => {
        idx += 1
        setTypedQuote(full.slice(0, idx))
        if (idx >= full.length && typingIntervalRef.current !== undefined) {
          window.clearInterval(typingIntervalRef.current)
          typingIntervalRef.current = undefined
        }
      }, 22)
    })

    return () => {
      cancelled = true
      cleanupIdle()
      if (typingIntervalRef.current !== undefined) {
        window.clearInterval(typingIntervalRef.current)
        typingIntervalRef.current = undefined
      }
    }
  }, [featuredQuote.quote])

  useSyncCatalogHeaderHeight(pageRef, headerRef, [fullSearch])

  if (legacyRedirect) {
    return <Navigate to={{ pathname: CATALOG_BROWSE_PATH, search: location.search }} replace />
  }

  return (
    <div ref={pageRef} className="catalog catalog-page catalog-page--shell home-portal">
      <PageMeta
        title="Songs for a World Gone Bananas"
        description="Explore the BANANASUTRA catalog — songs organized by sutra, topic, intention, and sound. Browse songbooks, read lyrics, watch videos, and listen to tracks."
        path="/"
        jsonLd={websiteJsonLd()}
      />
      <GlobalHeader ref={headerRef} />

      <div className="catalog-page__main">
        <main id="main-content" className="home-portal__main catalog-layout-shell">
          <h1 className="visually-hidden">BANANASUTRA</h1>

          <section className="home-portal__hero" aria-labelledby="home-hero-quote-label">
            <p id="home-hero-quote-label" className="home-portal__hero-label home-portal__hero-label--about-lede">
              Ideas you can feel.
            </p>
            <p className="home-portal__quote" aria-label="Featured quote">
              <span className="home-portal__quote-text">{typedQuote}</span>
              <span className="home-portal__quote-caret" aria-hidden />
            </p>
            {quoteMetaParts.length ? (
              <p className="home-portal__quote-meta">
                {quoteMetaParts.map((part, idx) => {
                  const isPrimarySutra = Boolean(primarySutraDisplay) && part === primarySutraDisplay
                  const toneClass = isPrimarySutra ? sutraToneClass(part) : ''
                  const family = isPrimarySutra ? sutraFamilyFromDisplay(part) : null
                  const sutraHref = family ? sutraHrefForFamily(family) : buildBrowsePathForFacet('sutra', part.trim())
                  return (
                    <span key={`${part}-${idx}`}>
                      {idx > 0 ? <span className="home-portal__quote-meta-sep" aria-hidden>{' · '}</span> : null}
                      {isPrimarySutra ? (
                        <Link
                          className={`home-portal__quote-sutra home-portal__quote-sutra-link ${toneClass}`.trim()}
                          to={sutraHref}
                        >
                          {part}
                        </Link>
                      ) : muse && part === muse ? (
                        <Link className="home-portal__quote-muse-link" to={`/about/muses?muse=${encodeURIComponent(muse)}`}>
                          {part}
                        </Link>
                      ) : (
                        part
                      )}
                    </span>
                  )
                })}
              </p>
            ) : null}
            <p className="home-portal__hero-why">
              <span className="home-portal__hero-why-inner">
                <Link to={ABOUT_SUTRAS_HREF}>About sutras</Link>
                {primarySutraDisplay ? (
                  <>
                    <span className="home-portal__hero-why-sep" aria-hidden>
                      {' · '}
                    </span>
                    <Link to={buildBrowsePathForFacet('sutra', primarySutraDisplay)}>
                      All {primarySutraDisplay} songs
                    </Link>
                  </>
                ) : null}
              </span>
            </p>
          </section>

          <section className="home-portal__section" aria-labelledby="home-sutra-grid-heading">
            <h2 id="home-sutra-grid-heading" className="catalog-section-title">
              The seven sutras
            </h2>
            <p className="home-portal__sutra-section-sub">
              Seven questions for a world gone bananas. Each one a guiding principle, a north star.
            </p>
            <div className="home-portal__sutra-grid">
              {SUTRA_GRID_KEYS.map((key) => {
                const ctx = SUTRA_CONTEXT[key]
                return (
                  <Link
                    key={key}
                    className={`home-portal__sutra-tile home-portal__sutra-tile--${key.toLowerCase()}`.trim()}
                    to={sutraHrefForFamily(key)}
                  >
                    <div className="home-portal__sutra-tile-top">
                      <span className="home-portal__sutra-tile-name">{ctx.sutra}</span>
                      <span className="home-portal__sutra-tile-question">{ctx.question}</span>
                      <span className="home-portal__sutra-tile-practice">
                        {key === 'QUACK' ? 'Sub of BLOW' : ctx.practice}
                      </span>
                    </div>
                  </Link>
                )
              })}
            </div>
            <Link className="catalog-section-cta" to={ABOUT_SUTRAS_HREF}>
              Learn more about the sutras →
            </Link>
          </section>

          {homePlaylistSongbook ? (
            <section className="home-portal__section" aria-labelledby="home-hidden-peels-heading">
              <h2 id="home-hidden-peels-heading" className="catalog-section-title">
                Hidden Peels
              </h2>
              <div className="home-portal__featured">
                <LazySoundCloudEmbed scUrl={homePlaylistSongbook.playlist_url} title={homePlaylistSongbook.songbook} />
                <div className="home-portal__featured-copy">
                  <p className="home-portal__featured-kicker">{songbookFeaturedKickerLabel(homePlaylistSongbook)}</p>
                  <h3 className="home-portal__featured-title">{homePlaylistSongbook.songbook}</h3>
                  {homePlaylistSongbook.description ? (
                    <p className="home-portal__featured-desc">{homePlaylistSongbook.description}</p>
                  ) : null}
                  <SongbookPlaylistMetaLine book={homePlaylistSongbook} />
                  <Link className="home-portal__featured-cta" to={songbookHrefFromCatalogItem(homePlaylistSongbook)}>
                    Open songbook →
                  </Link>
                </div>
              </div>
              <Link className="catalog-section-cta" to={canonicalPathForRoute('/songbooks')}>
                All {formatCount(songbooksCount)} songbooks →
              </Link>
            </section>
          ) : null}

          <section className="home-portal__section" aria-labelledby="home-drops-heading">
            <h2 id="home-drops-heading" className="catalog-section-title">
              Latest drops
            </h2>
            <ul className="song-thumb-grid song-thumb-grid--home">
              {latestDrops.map((song) => (
                <li key={song.lyrics_id} className="song-thumb-grid__cell">
                  <SongThumbCard
                    to={songCatalogLinkTo(song.lyrics_title, song.url_slug, {
                      section: browseRowHasAudioSection(song) ? 'audio' : undefined,
                    })}
                    coverUrl={song.cover_image_url}
                    title={song.lyrics_title}
                    metaLabel={song.sutra}
                    publishedAt={song.published_at}
                  />
                </li>
              ))}
            </ul>
            <Link className="catalog-section-cta" to={browsePathWithQuery('/songs', 'sort=newest')}>
              Browse newest →
            </Link>
          </section>

          <section className="home-portal__section home-portal__section--last" aria-labelledby="home-explore-heading">
            <h2 id="home-explore-heading" className="catalog-section-title">
              Ways to Explore
            </h2>
            <ul className="about-page__how-grid">
              <li className="about-page__how-cell">
                <Link className="about-page__how-card" to={`${CATALOG_BROWSE_PATH}#catalog-songs-find-input`}>
                  <span className="about-page__how-label">Search &amp; Discover →</span>
                  <span className="about-page__how-stat">
                    {`${formatCount(searchDiscoverRowCount)} songs & lyrics · find + filters`}
                  </span>
                  <span className="about-page__how-desc">
                    Find any song by title, sutra, muse, topic, or vibe. Start typing, start finding.
                  </span>
                </Link>
              </li>
              <li className="about-page__how-cell">
                <Link className="about-page__how-card" to={canonicalPathForRoute('/songbooks')}>
                  <span className="about-page__how-label">Browse Songbooks →</span>
                  <span className="about-page__how-stat">{formatCount(buildSummaryCount('songbooks'))} curated collections</span>
                  <span className="about-page__how-desc">
                    Best-of SoundCloud playlists that tell a story. By topic, by genres, and by language.
                  </span>
                </Link>
              </li>
              <li className="about-page__how-cell">
                <Link className="about-page__how-card" to={CATALOG_BROWSE_PATH}>
                  <span className="about-page__how-label">Explore the fool catalog →</span>
                  <span className="about-page__how-stat">
                    {`${formatCount(songsBrowseGridCount)} songs · meaning-first`}
                  </span>
                  <span className="about-page__how-desc">
                    Every song in one place—filter, wander, or let something find you.
                  </span>
                </Link>
              </li>
              <li className="about-page__how-cell">
                <Link className="about-page__how-card" to={canonicalPathForRoute('/tracks')}>
                  <span className="about-page__how-label">Listen to Top Tracks →</span>
                  <span className="about-page__how-stat">
                    {formatCount(buildSummaryCount('track_catalog_rows'))} tracks · sound-first
                  </span>
                  <span className="about-page__how-desc">
                    The best tracks, ranked and filterable by tempo, genres, instruments, and moods.
                  </span>
                </Link>
              </li>
              <li className="about-page__how-cell">
                <Link className="about-page__how-card" to={canonicalPathForRoute('/videos')}>
                  <span className="about-page__how-label">Watch Music Videos →</span>
                  <span className="about-page__how-stat">
                    {formatCount(buildSummaryCount('youtube_video_rows'))} videos · eyes first
                  </span>
                  <span className="about-page__how-desc">
                    The visual YouTube wall. Same songs, eye candy style.
                  </span>
                </Link>
              </li>
              <li className="about-page__how-cell">
                <Link className="about-page__how-card" to={canonicalPathForRoute('/words')}>
                  <span className="about-page__how-label">Read the Words →</span>
                  <span className="about-page__how-stat">
                    {formatCount(wordsSurfaceCount)} lyrics-first songs
                  </span>
                  <span className="about-page__how-desc">
                    Lyrics without music. Pieces still brewing, or that live as text alone.
                  </span>
                </Link>
              </li>
            </ul>
            <Link className="catalog-section-cta" to={canonicalPathForRoute('/about')}>
              About Bananasutra →
            </Link>
          </section>
        </main>
      </div>

      <GlobalFooter />
    </div>
  )
}
