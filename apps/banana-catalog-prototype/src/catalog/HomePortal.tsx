import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useLocation, useSearchParams } from 'react-router-dom'
import homeQuotesJson from '../data/generated/home_quotes.json'
import buildSummaryJson from '../data/generated/_build_summary.json'
import songCatalogBrowseJson from '../data/generated/song_catalog_browse.json'
import songbookCatalogJson from '../data/generated/songbook_catalog.json'
import { GlobalFooter } from './GlobalFooter'
import { GlobalHeader } from './GlobalHeader'
import { LazySoundCloudEmbed } from './LazySoundCloudEmbed'
import { FeaturedSongbookSpotlight } from './FeaturedSongbookSpotlight'
import {
  resolveHiddenPeelsSongbook,
  songbookHrefFromCatalogItem,
} from './homePortalUtils'
import { coverImageUrl } from '../seo/imageUrl'
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
import './CatalogApp.css'
import './FeaturedSongbookSpotlight.css'
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

const SUTRA_GRID_KEYS = ['KNOW', 'BLOW', 'SHOW', 'GROW', 'FLOW', 'GLOW', 'BOW', 'QUACK'] as const

function hashString(input: string): number {
  let hash = 0
  for (let idx = 0; idx < input.length; idx += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(idx)
    hash |= 0
  }
  return Math.abs(hash)
}

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

  const coverWallSeed = useMemo(
    () => hashString(`${location.key}|${Math.random()}`),
    [location.key],
  )
  const [coverWallColumns, setCoverWallColumns] = useState(8)

  useEffect(() => {
    const measure = () => {
      const width = window.innerWidth
      const cell = width < 480 ? 52 : width < 720 ? 64 : 72
      setCoverWallColumns(Math.max(4, Math.floor(width / cell)))
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  const coverWallSongs = useMemo(() => {
    const withCovers = HOME_BROWSE_CATALOG.filter((s) => (s.cover_image_url || '').trim())
    const shuffled = [...withCovers].sort(
      (a, b) =>
        hashString(`${coverWallSeed}|${a.lyrics_id}`) - hashString(`${coverWallSeed}|${b.lyrics_id}`) ||
        a.lyrics_title.localeCompare(b.lyrics_title),
    )
    const remainder = shuffled.length % coverWallColumns
    if (remainder === 0 || shuffled.length <= coverWallColumns) return shuffled
    return shuffled.slice(0, shuffled.length - remainder)
  }, [coverWallColumns, coverWallSeed])

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
                        <Link className="home-portal__quote-muse-link" to={`/muses?muse=${encodeURIComponent(muse)}`}>
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
            <div className="home-portal__hero-why" aria-label="Quote actions">
              <div className="home-portal__hero-why-inner">
                {primarySutraDisplay ? (
                  <Link
                    className="catalog-section-cta home-portal__hero-cta"
                    to={buildBrowsePathForFacet('sutra', primarySutraDisplay)}
                  >
                    Explore all {primarySutraDisplay} songs →
                  </Link>
                ) : (
                  <Link className="catalog-section-cta home-portal__hero-cta" to={CATALOG_BROWSE_PATH}>
                    Explore all sutra songs →
                  </Link>
                )}
              </div>
            </div>
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

          {coverWallSongs.length > 0 ? (
            <section
              className="home-portal__section home-portal__section--cover-wall"
              aria-labelledby="home-cover-wall-heading"
            >
              <h2 id="home-cover-wall-heading" className="catalog-section-title">
                Pick a cover
              </h2>
              <p className="home-portal__cover-wall-intro">
                Think of it as a matrix or a bingo game, whatever stirs your soul, and see where the tile takes you.
              </p>
              <div className="home-portal__cover-wall-bleed">
                <ul className="home-portal__cover-wall" aria-label="Song covers">
                  {coverWallSongs.map((song) => {
                    const cover = (song.cover_image_url || '').trim()
                    const title = song.lyrics_title
                    return (
                      <li key={song.lyrics_id} className="home-portal__cover-wall-cell">
                        <Link
                          className="home-portal__cover-wall-tile"
                          to={songCatalogLinkTo(song.lyrics_title, song.url_slug)}
                          aria-label={title}
                          title={title}
                        >
                          <img
                            className="home-portal__cover-wall-art"
                            src={coverImageUrl(cover, { width: 120 })}
                            alt=""
                            width={120}
                            height={120}
                            loading="lazy"
                            decoding="async"
                          />
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </div>
            </section>
          ) : null}

          {homePlaylistSongbook ? (
            <section className="home-portal__section" aria-labelledby="home-hidden-peels-heading">
              <h2 id="home-hidden-peels-heading" className="catalog-section-title">
                Hidden Peels
              </h2>
              <FeaturedSongbookSpotlight
                book={homePlaylistSongbook}
                className="home-portal__featured-spotlight"
                ctaTo={songbookHrefFromCatalogItem(homePlaylistSongbook)}
                embed={
                  <LazySoundCloudEmbed scUrl={homePlaylistSongbook.playlist_url} title={homePlaylistSongbook.songbook} />
                }
              />
              <Link className="catalog-section-cta" to={canonicalPathForRoute('/songbooks')}>
                All {formatCount(songbooksCount)} songbooks →
              </Link>
            </section>
          ) : null}

          <section className="home-portal__section home-portal__section--last" aria-labelledby="home-drops-heading">
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
        </main>
      </div>

      <GlobalFooter />
    </div>
  )
}
