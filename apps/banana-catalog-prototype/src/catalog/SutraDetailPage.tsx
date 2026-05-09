import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { GlobalFooter } from './GlobalFooter'
import { GlobalHeader } from './GlobalHeader'
import { SoundCloudEmbed } from './SoundCloudEmbed'
import { allSongbooks, songbookHref } from './songbooks'
import { songCatalogPath } from './songPaths'
import { buildBrowsePathForFacet } from './urlState'
import { ABOUT_SUTRAS_HREF } from './iaPaths'
import { SUTRA_CONTEXT, sutraEntryBySlug, sutraHrefForFamily } from './sutraContext'
import {
  buildSutraStats,
  pickPivotTargetFamily,
  pickRandomQuoteSong,
  primarySutraKeyForSongbook,
  songbooksForSutraDetail,
  sutraFamilyKeyFromSongField,
} from './sutraPageUtils'
import type { SutraFamilyKey } from './sutraContext'
import { SongThumbCard } from './SongThumbCard'
import { usePageMeta } from './usePageMeta'
import { useSyncCatalogHeaderHeight } from './useSyncCatalogHeaderHeight'
import { useSongCatalog } from './generatedData'
import { songOnWordsSurface } from './wordsStory'
import { dedupeYoutubeVideosByVideoId, flattenYoutubeCatalogVideos } from './youtubeCatalogFlat'
import { youtubeAspectRatioFromFormat } from './youtubeAspectRatio'
import { youtubePrivacyEmbedSrc } from './youtubeEmbedUrl'
import { featuredYoutubeSongPageHref } from './featuredYoutubeSongPageHref'
import type { YouTubeCatalogVideo } from './types'
import './CatalogApp.css'
import './SongbooksPage.css'
import './SutrasPages.css'

/** Per-sutra "what's next" copy for the bottom pivot section. */
const WHATS_NEXT: Record<SutraFamilyKey, { label: string; body: string }> = {
  KNOW: {
    label: "What's next",
    body: "You’ve asked Is it true? and grounded yourself in logic. The next step? Do something with it. GROW is where clarity becomes courage, the dare to care out loud.",
  },
  BLOW: {
    label: 'Time to pivot?',
    body: "You’ve named the foul play and spoken your truth. But(t) don’t let the shadows trap you. SHOW is your emergency release valve. Laughter is the antidote when the outrage starts to choke.",
  },
  QUACK: {
    label: 'Time to pivot?',
    body: "You’ve named the ducks and documented the circus. Sharp medicine taken, now pivot before it becomes a permanent address. SHOW lets you laugh at the naked king; BLOW channels the outrage into principled resistance.",
  },
  SHOW: {
    label: "What's next",
    body: "The laughter has done its work and the heaviness has lifted. Now you’ve got enough light to look at the harder questions. GROW is where joy becomes courage, empathy in an apathetic world.",
  },
  GROW: {
    label: "What's next",
    body: "You’ve found your coconuts, the courage to care. Now stop gripping so tight. FLOW is where you learn to trust the rhythm and let the river carry what you’ve built.",
  },
  FLOW: {
    label: "What's next",
    body: "You’ve dropped the baggage and learned to be water. The river that flows long enough starts to shimmer. GLOW is where you notice what’s already here, gratitude as a practice.",
  },
  GLOW: {
    label: "What's next",
    body: "You’ve found the rainbows in the clouds and the poetry of being alive. Gratitude deep enough becomes awe. BOW is where you surrender to the mystery and let grace meet gravity.",
  },
  BOW: {
    label: "What's next",
    body: "You’ve bowed to the mystery and made peace with the stars. And then the cycle starts over, because all we really know is that the unexamined life is not worth living. Back to KNOW, where it all begins again.",
  },
}

/** Replace bare sutra-key mentions (KNOW, BLOW, etc.) in text with Links to their detail pages.
 *  Skips the current sutra to avoid self-linking. */
function linkSutraMentions(text: string, currentKey: SutraFamilyKey): React.ReactNode {
  const keys = Object.keys(SUTRA_CONTEXT) as SutraFamilyKey[]
  // Match sutra keys as whole words, longest first to avoid partial matches
  const pattern = new RegExp(`\\b(${keys.filter((k) => k !== currentKey).sort((a, b) => b.length - a.length).join('|')})\\b`, 'g')
  const parts: React.ReactNode[] = []
  let last = 0
  let match: RegExpExecArray | null
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index))
    const key = match[1] as SutraFamilyKey
    parts.push(
      <Link key={`${key}-${match.index}`} to={sutraHrefForFamily(key)}>
        {match[0]}
      </Link>,
    )
    last = pattern.lastIndex
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts.length > 0 ? parts : text
}

function formatCount(n: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(n)
}

function formatEpDate(raw: string): string {
  const t = (raw || '').trim()
  if (!t) return ''
  return t.slice(0, 10)
}

function songHasReleasedListenerAudio(song: { has_in_app_playback: boolean; has_sc_catalog_listen: boolean; primary_ep_url: string }): boolean {
  return Boolean(song.has_in_app_playback || song.has_sc_catalog_listen || (song.primary_ep_url || '').trim())
}

function songHasReleasedVideo(song: { has_youtube_video: boolean }): boolean {
  return Boolean(song.has_youtube_video)
}

function songHasAudioOrVideo(song: {
  has_in_app_playback: boolean
  has_sc_catalog_listen: boolean
  primary_ep_url: string
  has_youtube_video: boolean
}): boolean {
  return songHasReleasedListenerAudio(song) || songHasReleasedVideo(song)
}

function parsePublishedAt(raw: string): number {
  const n = Date.parse((raw || '').trim())
  return Number.isNaN(n) ? 0 : n
}

function pickRandomVideo(videos: YouTubeCatalogVideo[]): YouTubeCatalogVideo | null {
  if (videos.length === 0) return null
  const index = Math.floor(Math.random() * videos.length)
  return videos[index] ?? null
}

function formatDurationTotal(raw: string | number | null | undefined): string {
  if (raw === null || raw === undefined) return ''
  const text = String(raw).trim()
  if (!text) return ''
  // If already formatted in clock style, pass through.
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(text)) return text
  const secs = Number(text)
  if (!Number.isFinite(secs) || secs <= 0) return ''
  const rounded = Math.round(secs)
  const h = Math.floor(rounded / 3600)
  const m = Math.floor((rounded % 3600) / 60)
  const s = rounded % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

export function SutraDetailPage() {
  const { slug } = useParams<{ slug: string }>()
  const pageRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLElement>(null)
  const pullTypingIntervalRef = useRef<number | undefined>(undefined)
  const { data: songCatalogRows, error: catalogError, loading: catalogLoading } = useSongCatalog()
  const [typedPullQuote, setTypedPullQuote] = useState('')
  const [youtubeVideos, setYoutubeVideos] = useState<YouTubeCatalogVideo[]>([])

  const resolved = useMemo(() => {
    if (!slug) return null
    return sutraEntryBySlug(slug)
  }, [slug])

  const familyKey = resolved?.key ?? null
  const entry = resolved?.entry ?? null

  usePageMeta({
    title: entry && familyKey ? `${familyKey} · Sutra` : 'Sutra',
    description:
      entry && familyKey
        ? `Explore the ${familyKey} sutra — songs, featured video, and related songbooks.`
        : 'BANANASUTRA sutra detail.',
    path: slug && entry ? `/about/${slug.trim()}` : undefined,
  })
  useSyncCatalogHeaderHeight(pageRef, headerRef, [slug])

  const sutraStats = useMemo(() => {
    if (!songCatalogRows) return new Map()
    return buildSutraStats(songCatalogRows)
  }, [songCatalogRows])
  const songsInFamily = useMemo(() => {
    if (!familyKey || !songCatalogRows) return []
    return songCatalogRows.filter((s) => sutraFamilyKeyFromSongField(s.sutra) === familyKey)
  }, [familyKey, songCatalogRows])

  const quoteSong = useMemo(() => {
    if (!familyKey || !songCatalogRows) return null
    return pickRandomQuoteSong(songCatalogRows, familyKey)
  }, [familyKey, songCatalogRows])

  useEffect(() => {
    const full = (quoteSong?.lyrics_extract || '').trim()
    if (pullTypingIntervalRef.current !== undefined) {
      window.clearInterval(pullTypingIntervalRef.current)
      pullTypingIntervalRef.current = undefined
    }
    if (!full) {
      setTypedPullQuote('')
      return
    }
    const reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reducedMotion) {
      setTypedPullQuote(full)
      return
    }
    setTypedPullQuote('')
    let idx = 0
    pullTypingIntervalRef.current = window.setInterval(() => {
      idx += 1
      setTypedPullQuote(full.slice(0, idx))
      if (idx >= full.length && pullTypingIntervalRef.current !== undefined) {
        window.clearInterval(pullTypingIntervalRef.current)
        pullTypingIntervalRef.current = undefined
      }
    }, 20)
    return () => {
      if (pullTypingIntervalRef.current !== undefined) {
        window.clearInterval(pullTypingIntervalRef.current)
        pullTypingIntervalRef.current = undefined
      }
    }
  }, [quoteSong?.lyrics_extract])

  useEffect(() => {
    let cancelled = false
    flattenYoutubeCatalogVideos()
      .then((rows) => {
        if (cancelled) return
        setYoutubeVideos(dedupeYoutubeVideosByVideoId(rows))
      })
      .catch(() => {
        if (cancelled) return
        setYoutubeVideos([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  const sortedSongbooks = useMemo(() => {
    if (!familyKey) return []
    return songbooksForSutraDetail(familyKey, allSongbooks())
  }, [familyKey])

  const featuredSongbookFallback = useMemo(() => {
    return sortedSongbooks.find((b) => (b.playlist_url || '').includes('/sets/')) ?? null
  }, [sortedSongbooks])

  const latestDrops = useMemo(() => {
    return [...songsInFamily]
      .filter(songHasAudioOrVideo)
      .sort((a, b) => parsePublishedAt(b.published_at) - parsePublishedAt(a.published_at))
      .slice(0, 6)
  }, [songsInFamily])

  const lyricsOnlyCount = useMemo(() => songsInFamily.filter(songOnWordsSurface).length, [songsInFamily])

  const videosCount = useMemo(() => {
    const sutra = (entry?.sutra || '').trim().toLowerCase()
    if (!sutra) return 0
    return youtubeVideos.filter((v) => (v.sutra || '').trim().toLowerCase() === sutra).length
  }, [entry?.sutra, youtubeVideos])
  const featuredSutraVideos = useMemo(() => {
    const sutra = (entry?.sutra || '').trim().toLowerCase()
    if (!sutra) return []
    return youtubeVideos.filter(
      (v) => (v.sutra || '').trim().toLowerCase() === sutra && Boolean(v.video_featured) && Boolean(v.can_embed),
    )
  }, [entry?.sutra, youtubeVideos])
  const featuredSutraVideo = useMemo(() => pickRandomVideo(featuredSutraVideos), [featuredSutraVideos])

  const featuredSutraSongPageHref = useMemo(() => {
    if (!featuredSutraVideo || !songCatalogRows) return null
    const id = (featuredSutraVideo.lyrics_id || '').trim()
    const inCatalog = id ? songCatalogRows.some((s) => (s.lyrics_id || '').trim() === id) : false
    return featuredYoutubeSongPageHref(featuredSutraVideo, inCatalog)
  }, [featuredSutraVideo, songCatalogRows])

  const pivotTarget = useMemo(() => {
    if (!familyKey || !entry) return null
    return pickPivotTargetFamily(entry.mental_health_pivot, familyKey)
  }, [familyKey, entry])

  if (!slug || !resolved || !familyKey || !entry) {
    return <Navigate to={ABOUT_SUTRAS_HREF} replace />
  }

  if (catalogLoading) {
    return (
      <div ref={pageRef} className="catalog catalog-page catalog-page--shell">
        <GlobalHeader ref={headerRef} />
        <div className="catalog-page__main">
          <article className="about-page catalog-layout-shell" id="main-content">
            <p className="about-page__p">Loading song catalog…</p>
          </article>
        </div>
        <GlobalFooter />
      </div>
    )
  }

  if (catalogError || !songCatalogRows) {
    return (
      <div ref={pageRef} className="catalog catalog-page catalog-page--shell">
        <GlobalHeader ref={headerRef} />
        <div className="catalog-page__main">
          <article className="about-page catalog-layout-shell" id="main-content">
            <p className="about-page__p">{catalogError ?? 'Could not load song catalog data.'}</p>
          </article>
        </div>
        <GlobalFooter />
      </div>
    )
  }

  const stats = sutraStats.get(familyKey) ?? { songs: 0, tracks: 0 }
  const featuredEp = entry.featured_ep
  const featuredEpUrl = (featuredEp?.ep_url || '').trim()
  const featuredEpDurationSeconds = featuredEpUrl
    ? songsInFamily
        .filter((song) => (song.primary_ep_url || '').trim() === featuredEpUrl)
        .reduce((sum, song) => sum + (Number.isFinite(song.aggregate_duration_sec) ? song.aggregate_duration_sec : 0), 0)
    : 0
  const featuredEpDuration = formatDurationTotal(featuredEp?.duration_total ?? featuredEpDurationSeconds)
  const featuredEpSongbookTitle = (featuredEp?.ep_songbook_title || '').trim()

  const browseHref = buildBrowsePathForFacet('sutra', entry.sutra)
  const tracksHref = `/tracks?q=${encodeURIComponent(entry.sutra)}`
  const videosHref = `/videos?sutra=${encodeURIComponent(entry.sutra)}`
  const wordsHref = `/words?sutra=${encodeURIComponent(entry.sutra)}`

  return (
    <div ref={pageRef} className="catalog catalog-page catalog-page--shell">
      <GlobalHeader ref={headerRef} />

      <div className="catalog-page__main">
        <article
          className={`sutra-detail sutra-detail--${familyKey.toLowerCase()} catalog-layout-shell`.trim()}
          id="main-content"
        >
          <nav className="catalog-breadcrumbs" aria-label="Breadcrumb">
            <Link className="catalog-breadcrumbs__link" to="/">
              Home
            </Link>
            <span className="catalog-breadcrumbs__sep" aria-hidden>
              /
            </span>
            <Link className="catalog-breadcrumbs__link" to={ABOUT_SUTRAS_HREF}>
              About
            </Link>
            <span className="catalog-breadcrumbs__sep" aria-hidden>
              /
            </span>
            <span className="catalog-breadcrumbs__current" aria-current="page">
              {entry.sutra}
            </span>
          </nav>

          <section className="sutra-detail__hero">
            <div className="sutra-detail__hero-identity">
              <h1 className="catalog-page-h1 sutra-detail__hero-title">{entry.sutra}</h1>
              <p className="sutra-detail__hero-question">{entry.question}</p>
              <p className="sutra-detail__hero-subline">
                {entry.practice}
                {entry.themes.split(/[,+]/).map((t) => t.trim()).filter(Boolean).map((theme, i) => (
                  <span key={i}>
                    <span className="sutra-detail__hero-dot" aria-hidden> · </span>
                    {theme}
                  </span>
                ))}
              </p>
            </div>
            <div className="sutra-detail__hero-description">
              {entry.sutra_essence ? (
                (() => {
                  const parts = entry.sutra_essence.split(/(?=Reach for )/i)
                  if (parts.length >= 2) {
                    const reachText = parts.slice(1).join('').trim()
                    const reachLeadMatch = reachText.match(/^(Reach for \S+ when)\s*/i)
                    return (
                      <>
                        <p className="sutra-detail__hero-essence">{parts[0].trim()}</p>
                        <p className="sutra-detail__hero-essence sutra-detail__hero-essence--reach">
                          {reachLeadMatch ? (
                            <><strong>{reachLeadMatch[1]}</strong> {linkSutraMentions(reachText.slice(reachLeadMatch[0].length), familyKey)}</>
                          ) : (
                            linkSutraMentions(reachText, familyKey)
                          )}
                        </p>
                      </>
                    )
                  }
                  return <p className="sutra-detail__hero-essence">{entry.sutra_essence}</p>
                })()
              ) : null}
            </div>
          </section>

          {quoteSong ? (
            <section className="sutra-detail__section sutra-detail__pull" aria-labelledby="sutra-pull-heading">
              <h2 id="sutra-pull-heading" className="visually-hidden">
                Lyric pull
              </h2>
              <blockquote className="sutra-detail__pull-quote" aria-label="Lyric pull quote">
                <span className="sutra-detail__pull-quote-text">{typedPullQuote}</span>
                <span className="sutra-detail__pull-quote-caret" aria-hidden />
              </blockquote>
              <p className="sutra-detail__pull-src">
                ↳ From{' '}
                <Link className="sutra-detail__pull-link" to={songCatalogPath(quoteSong.lyrics_title, quoteSong.url_slug)}>
                  &ldquo;{quoteSong.lyrics_title}&rdquo;
                </Link>{' '}
                · {quoteSong.sutra}
              </p>
            </section>
          ) : null}

          <div className="sutra-detail__hero-stats-row">
            <div className="sutra-detail__hero-shortcuts" aria-label={`${entry.sutra} content shortcuts`}>
              <Link className="sutra-detail__hero-shortcut" to={browseHref}>
                <span className="sutra-detail__hero-shortcut-k">Songs</span>
                <span className="sutra-detail__hero-shortcut-v">{formatCount(stats.songs)}</span>
              </Link>
              <Link className="sutra-detail__hero-shortcut" to={tracksHref}>
                <span className="sutra-detail__hero-shortcut-k">Top tracks</span>
                <span className="sutra-detail__hero-shortcut-v">{formatCount(stats.tracks)}</span>
              </Link>
              <Link className="sutra-detail__hero-shortcut" to={videosHref}>
                <span className="sutra-detail__hero-shortcut-k">Videos</span>
                <span className="sutra-detail__hero-shortcut-v">{formatCount(videosCount)}</span>
              </Link>
              <Link className="sutra-detail__hero-shortcut" to={wordsHref}>
                <span className="sutra-detail__hero-shortcut-k">Lyrics only</span>
                <span className="sutra-detail__hero-shortcut-v">{formatCount(lyricsOnlyCount)}</span>
              </Link>
            </div>
          </div>

          {familyKey === 'BLOW' ? (
            <section className="sutra-detail__section" aria-labelledby="sutra-quack-heading">
              <h2 id="sutra-quack-heading" className="catalog-section-title">
                Sub-sutra
              </h2>
              <div className="sutra-detail__quack-row">
                <div className="sutra-detail__quack-name">QUACK</div>
                <p className="sutra-detail__quack-desc">
                  {SUTRA_CONTEXT.QUACK.sutra_when} {SUTRA_CONTEXT.QUACK.sutra_card_essence}
                </p>
                <Link className="catalog-section-cta" to={sutraHrefForFamily('QUACK')}>
                  Open QUACK →
                </Link>
              </div>
            </section>
          ) : null}

          <section className="sutra-detail__section" aria-labelledby="sutra-browse-heading">
            <h2 id="sutra-browse-heading" className="catalog-section-title">
              Latest {entry.sutra} drops
            </h2>
            {latestDrops.length ? (
              <ul className="song-thumb-grid song-thumb-grid--home sutra-detail__song-grid" aria-label={`Latest ${entry.sutra} drops`}>
                {latestDrops.map((s) => (
                  <li key={s.lyrics_id} className="song-thumb-grid__cell">
                    <SongThumbCard
                      to={songCatalogPath(s.lyrics_title, s.url_slug)}
                      coverUrl={s.cover_image_url}
                      title={s.lyrics_title}
                      metaLabel={s.sutra}
                    />
                  </li>
                ))}
              </ul>
            ) : null}
            <Link className="catalog-section-cta" to={browseHref}>
              View all {formatCount(stats.songs)} {entry.sutra} songs →
            </Link>
          </section>

          <section className="sutra-detail__section" aria-labelledby="sutra-featured-heading">
            <h2 id="sutra-featured-heading" className="catalog-section-title">
              Featured {entry.sutra} Video
            </h2>
            {featuredSutraVideo ? (
              <>
                <div
                  className="sutra-detail__featured-video-embed"
                  style={{ aspectRatio: youtubeAspectRatioFromFormat(featuredSutraVideo.format) }}
                >
                  <iframe
                    className="sutra-detail__yt-embed"
                    src={youtubePrivacyEmbedSrc(featuredSutraVideo.video_id)}
                    title={featuredSutraVideo.lyrics_title || featuredSutraVideo.title || `${entry.sutra} featured video`}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    loading="lazy"
                  />
                </div>
                <div className="sutra-detail__featured-video-copy">
                  <h3 className="sutra-detail__feat-title">{featuredSutraVideo.lyrics_title || featuredSutraVideo.title}</h3>
                  {(featuredSutraVideo.lyrics_summary || '').trim() ? (
                    <p className="sutra-detail__feat-desc">{featuredSutraVideo.lyrics_summary?.trim()}</p>
                  ) : null}
                  {featuredSutraSongPageHref ? (
                    <div className="catalog-featured-video-song-row">
                      <Link className="catalog-song-page-cta" to={featuredSutraSongPageHref}>
                        Song page
                      </Link>
                    </div>
                  ) : null}
                </div>
              </>
            ) : (
              <p className="sutra-detail__empty">No featured {entry.sutra} video marked in the catalog yet.</p>
            )}
          </section>

          <section className="sutra-detail__section" aria-labelledby="sutra-featured-ep-heading">
            <h2 id="sutra-featured-ep-heading" className="catalog-section-title">
              Featured {entry.sutra} EP
            </h2>
            {featuredEp?.ep_url && featuredEp.ep_url.includes('soundcloud.com') ? (
              <div className="sutra-detail__feat">
                <div className="sutra-detail__feat-embed">
                  <SoundCloudEmbed
                    scUrl={featuredEp.ep_url}
                    title={featuredEp.ep_title}
                    height={280}
                  />
                </div>
                <div className="sutra-detail__feat-copy">
                  <h3 className="sutra-detail__feat-title">{featuredEp.ep_title}</h3>
                  <p className="sutra-detail__feat-meta">
                    EP×{featuredEp.ep_total_tracks || '—'}
                    {featuredEpDuration ? ` · ${featuredEpDuration}` : ''} · {formatCount(featuredEp.total_plays)} plays ·{' '}
                    {formatEpDate(featuredEp.created_at)}
                  </p>
                  {featuredEp.ep_description ? (
                    <p className="sutra-detail__feat-desc">{featuredEp.ep_description}</p>
                  ) : null}
                  {featuredEpSongbookTitle ? (
                    <Link className="sutra-detail__cta" to={songbookHref(featuredEpSongbookTitle)}>
                      View {featuredEpSongbookTitle} →
                    </Link>
                  ) : null}
                </div>
              </div>
            ) : featuredSongbookFallback ? (
              <div className="sutra-detail__feat">
                <div className="sutra-detail__feat-embed">
                  {featuredSongbookFallback.playlist_url ? (
                    <SoundCloudEmbed
                      scUrl={featuredSongbookFallback.playlist_url}
                      title={featuredSongbookFallback.songbook}
                      height={280}
                    />
                  ) : null}
                </div>
                <div className="sutra-detail__feat-copy">
                  <h3 className="sutra-detail__feat-title">{featuredSongbookFallback.songbook}</h3>
                  {featuredSongbookFallback.description ? (
                    <p className="sutra-detail__feat-desc">{featuredSongbookFallback.description}</p>
                  ) : null}
                  <Link className="sutra-detail__cta" to={songbookHref(featuredSongbookFallback.songbook)}>
                    Open songbook →
                  </Link>
                </div>
              </div>
            ) : (
              <p className="sutra-detail__empty">No featured EP or songbook embed on file for this sutra yet.</p>
            )}
          </section>

          <section className="sutra-detail__section" aria-labelledby="sutra-books-heading">
            <h2 id="sutra-books-heading" className="catalog-section-title">
              All {entry.sutra} songbooks
            </h2>
            {sortedSongbooks.length ? (
              <div className="songbooks-page__grid songbooks-page__grid--sutra sutra-detail__booklist">
                {sortedSongbooks.map((b) => (
                  <Link key={b.songbook} className="songbooks-page__card" to={songbookHref(b.songbook)}>
                    <div className="songbooks-page__media">
                      {b.playlist_artwork_url ? (
                        <img
                          className="songbooks-page__art"
                          src={b.playlist_artwork_url}
                          alt=""
                          width={280}
                          height={280}
                          loading="lazy"
                        />
                      ) : (
                        <div className="songbooks-page__art songbooks-page__art--fallback" aria-hidden>
                          🍌
                        </div>
                      )}
                    </div>
                    <div className="songbooks-page__body">
                      <div className="sutra-detail__book-kicker">SUTRA · {primarySutraKeyForSongbook(b)}</div>
                      <h3 className="songbooks-page__title">{b.songbook}</h3>
                      {b.description ? <p className="songbooks-page__desc">{b.description}</p> : null}
                      <p className="songbooks-page__desc sutra-detail__songbook-meta">
                        {formatCount(b.playlist_total_plays)} plays · {b.song_count} songs
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="sutra-detail__empty">No songbooks grouped under this sutra in the catalog.</p>
            )}
          </section>

          <section className="sutra-detail__section sutra-detail__section--pivot" aria-labelledby="sutra-pivot-heading">
            <h2 id="sutra-pivot-heading" className="catalog-section-title sutra-detail__pivot-title">
              {WHATS_NEXT[familyKey]?.label ?? "What's next"}
            </h2>
            <div className="sutra-detail__pivot-block">
              <p className="sutra-detail__pivot-body">{WHATS_NEXT[familyKey]?.body ?? entry.mental_health_pivot}</p>
            </div>
          </section>

          <nav className="sutra-detail__bottom-nav" aria-label="Sutra page navigation">
            <Link className="sutra-detail__bottom-cta sutra-detail__bottom-cta--left" to={ABOUT_SUTRAS_HREF}>
              ← The seven sutras
            </Link>
            {pivotTarget ? (
              <Link className="sutra-detail__bottom-cta sutra-detail__bottom-cta--right" to={sutraHrefForFamily(pivotTarget)}>
                Explore {pivotTarget}sutra →
              </Link>
            ) : (
              <Link className="sutra-detail__bottom-cta sutra-detail__bottom-cta--right" to="/about#sutras">
                Explore all sutras →
              </Link>
            )}
          </nav>
        </article>
      </div>

      <GlobalFooter />
    </div>
  )
}
