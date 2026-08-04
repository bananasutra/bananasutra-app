import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useLocation, useParams } from 'react-router-dom'
import { GlobalFooter } from './GlobalFooter'
import { GlobalHeader } from './GlobalHeader'
import { LazySoundCloudEmbed } from './LazySoundCloudEmbed'
import { allSongbooks, songbookHref } from './songbooks'
import { browsePathWithQuery, canonicalPathForRoute } from './seoPaths'
import { buildBrowsePathForFacet } from './urlState'
import { ABOUT_SUTRAS_HREF } from './iaPaths'
import { SUTRA_CONTEXT, sutraEntryBySlug, sutraHrefForFamily } from './sutraContext'
import {
  buildSutraStats,
  pickPivotTargetFamily,
  pickRandomQuoteSong,
  songbookPoolForSutraPageRotation,
  songbooksForSutraDetail,
  sutraFamilyKeyFromSongField,
} from './sutraPageUtils'
import type { SutraFamilyKey } from './sutraContext'
import { ScrollRail } from './ScrollRail'
import { SongThumbCard } from './SongThumbCard'
import { ListenLpSongbookThumb } from './ListenLpSongbookThumb'
import { browseRowHasAudioSection, songCatalogLinkTo, songCatalogPath, sutraDetailPath } from './songPaths'
import { sutraCreativeWorkJsonLd } from '../seo/jsonLd'
import { renderPageMeta } from './usePageMeta'
import { parseCatalogPublishedAt } from './formatPublishDate'
import { syncCatalogHeaderHeightNow, useSyncCatalogHeaderHeight } from './useSyncCatalogHeaderHeight'
import { useSongCatalog } from './generatedData'
import { songOnWordsSurface } from './wordsStory'
import { dedupeYoutubeVideosByVideoId, flattenYoutubeCatalogVideos } from './youtubeCatalogFlat'
import { youtubeAspectRatioFromFormat } from './youtubeAspectRatio'
import { YoutubeEmbeddedPlayer, YoutubeEmbedOutboundFooter } from './YouTubeEmbed'
import {
  useExclusiveYoutubeSoundcloudPlayback,
  type ExclusiveYoutubeSoundcloudControls,
} from './useExclusiveYoutubeSoundcloudPlayback'
import { usePlayerQueueRegistrar } from './playerQueue/playerQueueRegistrarContext'
import {
  pickRandomSongbookFromPool,
  songbookFeaturedKickerLabel,
  songbookHrefFromCatalogItem,
} from './homePortalUtils'
import { formatDurationDisplay } from './durationFormat'
import { useTypewriterText } from './useTypewriterText'
import { CatalogFeaturedEmbedCopy } from './CatalogFeaturedEmbedCopy'
import { CatalogMediaOutbound } from './CatalogMediaOutbound'
import { formatSongbookScPlaylistMeta } from './songbookPlaylistMeta'
import type { YouTubeCatalogVideo } from './types'
import './CatalogApp.css'
import './SongbooksPage.css'
import './ListenLpPage.css'
import './SutrasPages.css'

const SUTRA_LATEST_DROPS_LIMIT = 6
/** List-mode SC widget heights (no artwork — track list visible on mobile). */
const SC_EMBED_HEIGHT_EP_LIST = 450
const SC_EMBED_HEIGHT_SONGBOOK_LIST = 760

function soundcloudListEmbedHeight(scUrl: string, kind: 'ep' | 'songbook'): number {
  if (kind === 'songbook') return SC_EMBED_HEIGHT_SONGBOOK_LIST
  return scUrl.includes('/sets/') ? SC_EMBED_HEIGHT_EP_LIST : 166
}

/** Per-sutra "what's next" copy for the bottom pivot section. */
const WHATS_NEXT: Record<SutraFamilyKey, { label: string; body: string }> = {
  KNOW: {
    label: 'Now what?',
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
    label: 'Now what?',
    body: "The laughter has done its work and the heaviness has lifted. Now you’ve got enough light to look at the harder questions. GROW is where joy becomes courage, empathy in an apathetic world.",
  },
  GROW: {
    label: 'Now what?',
    body: "You’ve found your coconuts, the courage to care. Now stop gripping so tight. FLOW is where you learn to trust the rhythm and let the river carry what you’ve built.",
  },
  FLOW: {
    label: 'Now what?',
    body: "You’ve dropped the baggage and learned to be water. The river that flows long enough starts to shimmer. GLOW is where you notice what’s already here, gratitude as a practice.",
  },
  GLOW: {
    label: 'Now what?',
    body: "You’ve found the rainbows in the clouds and the poetry of being alive. Gratitude deep enough becomes awe. BOW is where you surrender to the mystery and let grace meet gravity.",
  },
  BOW: {
    label: 'Now what?',
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
  const n = parseCatalogPublishedAt(raw)
  return Number.isFinite(n) ? n : 0
}

function pickRandomVideo(videos: YouTubeCatalogVideo[]): YouTubeCatalogVideo | null {
  if (videos.length === 0) return null
  const index = Math.floor(Math.random() * videos.length)
  return videos[index] ?? null
}

export function SutraDetailPage() {
  const { slug } = useParams<{ slug: string }>()
  const location = useLocation()
  const { key: routeVisitKey } = location
  const pageRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLElement>(null)
  const youtubeExclusiveRef = useRef<HTMLIFrameElement>(null)
  const soundcloudExclusiveWrapRef = useRef<HTMLDivElement>(null)
  const sutraSpotlightSoundcloudWrapRef = useRef<HTMLDivElement>(null)
  const sutraSoundcloudWrapRefs = useMemo(
    () => [soundcloudExclusiveWrapRef, sutraSpotlightSoundcloudWrapRef] as const,
    [],
  )
  const exclusivePlaybackRef = useRef<ExclusiveYoutubeSoundcloudControls | null>(null)
  const { persistentScEmbedWrapRef, usePersistentPlayback } = usePlayerQueueRegistrar()
  const [youtubeIframeGen, setYoutubeIframeGen] = useState(0)
  const { data: songCatalogRows, error: catalogError, loading: catalogLoading } = useSongCatalog()
  const [youtubeVideos, setYoutubeVideos] = useState<YouTubeCatalogVideo[]>([])

  const resolved = useMemo(() => {
    if (!slug) return null
    return sutraEntryBySlug(slug)
  }, [slug])

  const familyKey = resolved?.key ?? null
  const entry = resolved?.entry ?? null

  const trimmedSlug = (slug || '').trim()
  const pageMeta = renderPageMeta({
    title: entry && familyKey ? `${familyKey} · Sutra` : 'Sutra',
    description:
      entry && familyKey
        ? `Explore the ${familyKey} sutra — songs, featured video, and related songbooks.`
        : 'BANANASUTRA sutra detail.',
    path: entry ? sutraDetailPath(trimmedSlug) : undefined,
    jsonLd:
      entry && familyKey ? sutraCreativeWorkJsonLd(familyKey, trimmedSlug, entry.sutra_when) : undefined,
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
  }, [familyKey, songCatalogRows, routeVisitKey])

  const typedPullQuote = useTypewriterText((quoteSong?.lyrics_extract || '').trim())

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

  const sortedSongbooks = useMemo((): ReturnType<typeof allSongbooks> => {
    if (!familyKey) return []
    return songbooksForSutraDetail(familyKey, allSongbooks()) as ReturnType<typeof allSongbooks>
  }, [familyKey])
  const featuredSongbookFallback = useMemo(() => {
    return sortedSongbooks.find((b) => (b.playlist_url || '').includes('/sets/')) ?? null
  }, [sortedSongbooks])

  const sutraSpotlightSongbook = useMemo(() => {
    if (!familyKey || !entry) return null
    const ep = entry.featured_ep
    const epSlotShowsSoundcloudEmbed = Boolean(ep?.ep_url && ep.ep_url.includes('soundcloud.com'))
    const pool = songbookPoolForSutraPageRotation(sortedSongbooks)
    const exclude =
      !epSlotShowsSoundcloudEmbed && featuredSongbookFallback ? featuredSongbookFallback.songbook : null
    return pickRandomSongbookFromPool(pool, exclude)
  }, [familyKey, entry, sortedSongbooks, featuredSongbookFallback, routeVisitKey])

  const featuredScUrlForExclusive = useMemo(() => {
    const epUrl = (entry?.featured_ep?.ep_url || '').trim()
    if (epUrl.includes('soundcloud.com')) return epUrl
    return (featuredSongbookFallback?.playlist_url || '').trim()
  }, [entry?.featured_ep?.ep_url, featuredSongbookFallback?.playlist_url])

  const latestDrops = useMemo(() => {
    return [...songsInFamily]
      .filter(songHasAudioOrVideo)
      .sort((a, b) => parsePublishedAt(b.published_at) - parsePublishedAt(a.published_at))
      .slice(0, SUTRA_LATEST_DROPS_LIMIT)
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
  const featuredSutraVideo = useMemo(() => pickRandomVideo(featuredSutraVideos), [featuredSutraVideos, routeVisitKey])

  const sutraExclusivePlaybackEnabled = Boolean(
    !catalogLoading &&
      songCatalogRows &&
      featuredSutraVideo &&
      (Boolean((featuredScUrlForExclusive || '').trim()) ||
        Boolean((sutraSpotlightSongbook?.playlist_url || '').trim())),
  )

  useExclusiveYoutubeSoundcloudPlayback({
    youtubeIframeRef: youtubeExclusiveRef,
    soundcloudWrapRefs: sutraSoundcloudWrapRefs,
    persistentScWrapRef: usePersistentPlayback ? persistentScEmbedWrapRef : undefined,
    enabled: sutraExclusivePlaybackEnabled,
    controlsRef: exclusivePlaybackRef,
    syncKey: `${familyKey ?? ''}|${featuredSutraVideo?.video_id ?? ''}|${featuredScUrlForExclusive}|spot:${(sutraSpotlightSongbook?.playlist_url || '').trim()}|yt:${youtubeIframeGen}`,
  })

  useLayoutEffect(() => {
    if (!entry) return
    const anchor = () => {
      syncCatalogHeaderHeightNow(pageRef, headerRef)
      window.scrollTo(0, 0)
    }
    anchor()
    requestAnimationFrame(() => {
      anchor()
      requestAnimationFrame(anchor)
    })
  }, [location.pathname, slug, entry?.sutra])

  const pivotTarget = useMemo(() => {
    if (!familyKey || !entry) return null
    return pickPivotTargetFamily(entry.mental_health_pivot, familyKey)
  }, [familyKey, entry])

  if (!slug || !resolved || !familyKey || !entry) {
    return <Navigate to={ABOUT_SUTRAS_HREF} replace />
  }

  if (!catalogLoading && (catalogError || !songCatalogRows)) {
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

  const stats = catalogLoading ? null : sutraStats.get(familyKey) ?? { songs: 0, tracks: 0 }
  const statCount = (n: number) => (catalogLoading ? '…' : formatCount(n))
  const featuredEp = entry.featured_ep
  const featuredEpUrl = (featuredEp?.ep_url || '').trim()
  const featuredEpDurationSeconds = featuredEpUrl
    ? songsInFamily
        .filter((song) => (song.primary_ep_url || '').trim() === featuredEpUrl)
        .reduce((sum, song) => sum + (Number.isFinite(song.aggregate_duration_sec) ? song.aggregate_duration_sec : 0), 0)
    : 0
  const featuredEpDuration = formatDurationDisplay(featuredEp?.duration_total ?? featuredEpDurationSeconds)
  const featuredEpSongbookTitle = (featuredEp?.ep_songbook_title || '').trim()
  const featuredEpTitleMeta =
    featuredEp?.ep_url && featuredEp.ep_url.includes('soundcloud.com')
      ? [
          featuredEp.ep_total_tracks != null ? `${featuredEp.ep_total_tracks} tracks` : null,
          featuredEpDuration.trim() || null,
        ]
          .filter(Boolean)
          .join(' · ')
      : ''

  const browseHref = buildBrowsePathForFacet('sutra', entry.sutra)
  const tracksHref = browsePathWithQuery('/tracks', `q=${encodeURIComponent(entry.sutra)}`)
  const videosHref = browsePathWithQuery('/videos', `sutra=${encodeURIComponent(entry.sutra)}`)
  const wordsHref = browsePathWithQuery('/words', `sutra=${encodeURIComponent(entry.sutra)}`)

  return (
    <div ref={pageRef} className="catalog catalog-page catalog-page--shell">
      {pageMeta}
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
            <Link className="catalog-breadcrumbs__link" to={canonicalPathForRoute('/about')}>
              About
            </Link>
            <span className="catalog-breadcrumbs__sep" aria-hidden>
              /
            </span>
            <Link className="catalog-breadcrumbs__link" to={canonicalPathForRoute('/sutras')}>
              Sutras
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
              {(entry.sutra_lens || '').trim() ? (
                <p className="sutra-detail__hero-lens">{entry.sutra_lens.trim()}</p>
              ) : null}
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
            <div className="sutra-detail__hero-stats-row">
              <div className="sutra-detail__hero-shortcuts" aria-label={`${entry.sutra} content shortcuts`}>
                <Link className="sutra-detail__hero-shortcut" to={browseHref}>
                  <span className="sutra-detail__hero-shortcut-k">Songs</span>
                  <span className="sutra-detail__hero-shortcut-v">{stats ? statCount(stats.songs) : '…'}</span>
                </Link>
                <Link className="sutra-detail__hero-shortcut" to={tracksHref}>
                  <span className="sutra-detail__hero-shortcut-k">Top tracks</span>
                  <span className="sutra-detail__hero-shortcut-v">{stats ? statCount(stats.tracks) : '…'}</span>
                </Link>
                <Link className="sutra-detail__hero-shortcut" to={videosHref}>
                  <span className="sutra-detail__hero-shortcut-k">Videos</span>
                  <span className="sutra-detail__hero-shortcut-v">{catalogLoading ? '…' : formatCount(videosCount)}</span>
                </Link>
                <Link className="sutra-detail__hero-shortcut" to={wordsHref}>
                  <span className="sutra-detail__hero-shortcut-k">Lyrics only</span>
                  <span className="sutra-detail__hero-shortcut-v">{stats ? statCount(lyricsOnlyCount) : '…'}</span>
                </Link>
              </div>
            </div>
          </section>

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
            <p className="catalog-lp-section-intro">
              Fresh in. Lyrics, meaning, and playback on each song page.
            </p>
            {latestDrops.length ? (
              <ScrollRail className="listen-lp__scroll-rail" variant="fade">
                <ul className="listen-lp__rail-list" aria-label={`Latest ${entry.sutra} drops`}>
                  {latestDrops.map((song) => (
                    <li key={song.lyrics_id} className="listen-lp__rail-cell">
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
              </ScrollRail>
            ) : (
              <p className="sutra-detail__empty">No recent drops with audio or video in this sutra yet.</p>
            )}
            <Link className="catalog-section-cta" to={browseHref}>
              View all {stats ? formatCount(stats.songs) : '…'} {entry.sutra} songs →
            </Link>
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

          <section className="sutra-detail__section" aria-labelledby="sutra-featured-heading">
            <h2 id="sutra-featured-heading" className="catalog-section-title">
              {entry.sutra} video spotlight
            </h2>
            {featuredSutraVideo ? (
              <>
                <div className="catalog-featured-embed-copy sutra-detail__media-block-copy sutra-detail__media-block-copy--above-embed">
                  <p className="catalog-featured-embed-copy__title">
                    {featuredSutraVideo.lyrics_title || featuredSutraVideo.title}
                  </p>
                  {(featuredSutraVideo.lyrics_summary || '').trim() ? (
                    <p className="catalog-featured-embed-copy__desc">{featuredSutraVideo.lyrics_summary?.trim()}</p>
                  ) : null}
                </div>
                <div className="sutra-detail__media-block-embed sutra-detail__media-block-embed--video">
                  <YoutubeEmbeddedPlayer
                    videoId={featuredSutraVideo.video_id}
                    title={
                      featuredSutraVideo.lyrics_title ||
                      featuredSutraVideo.title ||
                      `${entry.sutra} video spotlight`
                    }
                    enableJsApi={sutraExclusivePlaybackEnabled}
                    iframeRef={youtubeExclusiveRef}
                    embedWrapperClassName="sutra-detail__featured-video-aspect"
                    embedWrapperStyle={{ aspectRatio: youtubeAspectRatioFromFormat(featuredSutraVideo.format) }}
                    iframeClassName="sutra-detail__yt-embed"
                    facadeUntilClick
                    showOutboundFooter={false}
                    onBeforePlay={() => exclusivePlaybackRef.current?.pauseAllSoundcloud()}
                    onIframeLoad={() => setYoutubeIframeGen((g) => g + 1)}
                  />
                </div>
                <div className="sutra-detail__media-block-cta">
                  <Link className="sutra-detail__cta" to={videosHref}>
                    View {entry.sutra} videos →
                  </Link>
                  <YoutubeEmbedOutboundFooter videoId={featuredSutraVideo.video_id} />
                </div>
              </>
            ) : (
              <p className="sutra-detail__empty">No featured {entry.sutra} video marked in the catalog yet.</p>
            )}
          </section>

          <section className="sutra-detail__section" aria-labelledby="sutra-featured-ep-heading">
            <h2 id="sutra-featured-ep-heading" className="catalog-section-title">
              {entry.sutra} EP spotlight
            </h2>
            {featuredEp?.ep_url && featuredEp.ep_url.includes('soundcloud.com') ? (
              <>
                <CatalogFeaturedEmbedCopy
                  className="sutra-detail__media-block-copy sutra-detail__media-block-copy--above-embed"
                  title={featuredEp.ep_title}
                  titleMeta={featuredEpTitleMeta || null}
                  description={featuredEp.ep_description}
                />
                <div className="sutra-detail__media-block-embed" ref={soundcloudExclusiveWrapRef}>
                  <LazySoundCloudEmbed
                    scUrl={featuredEp.ep_url}
                    title={featuredEp.ep_title}
                    mode="list"
                    height={soundcloudListEmbedHeight(featuredEp.ep_url, 'ep')}
                  />
                </div>
                <div className="sutra-detail__media-block-cta">
                  {featuredEpSongbookTitle ? (
                    <Link className="sutra-detail__cta" to={songbookHref(featuredEpSongbookTitle)}>
                      View song →
                    </Link>
                  ) : null}
                  <CatalogMediaOutbound href={featuredEp.ep_url} />
                </div>
              </>
            ) : featuredSongbookFallback ? (
              <>
                <CatalogFeaturedEmbedCopy
                  className="sutra-detail__media-block-copy sutra-detail__media-block-copy--above-embed"
                  meta={songbookFeaturedKickerLabel(featuredSongbookFallback)}
                  title={featuredSongbookFallback.songbook}
                  titleMeta={formatSongbookScPlaylistMeta(featuredSongbookFallback)}
                  description={featuredSongbookFallback.description}
                />
                <div className="sutra-detail__media-block-embed" ref={soundcloudExclusiveWrapRef}>
                  {featuredSongbookFallback.playlist_url ? (
                    <LazySoundCloudEmbed
                      scUrl={featuredSongbookFallback.playlist_url}
                      title={featuredSongbookFallback.songbook}
                      mode="list"
                      height={soundcloudListEmbedHeight(featuredSongbookFallback.playlist_url, 'songbook')}
                    />
                  ) : null}
                </div>
                <div className="sutra-detail__media-block-cta">
                  <Link className="sutra-detail__cta" to={songbookHref(featuredSongbookFallback.songbook)}>
                    View songbook →
                  </Link>
                  {featuredSongbookFallback.playlist_url ? (
                    <CatalogMediaOutbound href={featuredSongbookFallback.playlist_url} />
                  ) : null}
                </div>
              </>
            ) : (
              <p className="sutra-detail__empty">No featured EP or songbook embed on file for this sutra yet.</p>
            )}
          </section>

          {sutraSpotlightSongbook ? (
            <section
              className="sutra-detail__section sutra-detail__section--songbook-spotlight"
              aria-labelledby="sutra-spotlight-songbook-heading"
            >
              <h2 id="sutra-spotlight-songbook-heading" className="catalog-section-title">
                {entry.sutra} songbook spotlight
              </h2>
              <CatalogFeaturedEmbedCopy
                className="sutra-detail__media-block-copy sutra-detail__media-block-copy--above-embed"
                title={sutraSpotlightSongbook.songbook}
                titleMeta={formatSongbookScPlaylistMeta(sutraSpotlightSongbook)}
                description={sutraSpotlightSongbook.description}
              />
              <div className="sutra-detail__media-block-embed" ref={sutraSpotlightSoundcloudWrapRef}>
                <LazySoundCloudEmbed
                  scUrl={sutraSpotlightSongbook.playlist_url}
                  title={sutraSpotlightSongbook.songbook}
                  mode="list"
                  height={soundcloudListEmbedHeight(sutraSpotlightSongbook.playlist_url, 'songbook')}
                />
              </div>
              <div className="sutra-detail__media-block-cta">
                <Link className="sutra-detail__cta" to={songbookHrefFromCatalogItem(sutraSpotlightSongbook)}>
                  View songbook →
                </Link>
                {sutraSpotlightSongbook.playlist_url ? (
                  <CatalogMediaOutbound href={sutraSpotlightSongbook.playlist_url} />
                ) : null}
              </div>
            </section>
          ) : null}

          <section className="sutra-detail__section" aria-labelledby="sutra-books-heading">
            <h2 id="sutra-books-heading" className="catalog-section-title">
              All {entry.sutra} songbooks
            </h2>
            {sortedSongbooks.length ? (
              <ul className="listen-lp__songbook-grid sutra-detail__booklist" aria-label={`All ${entry.sutra} songbooks`}>
                {sortedSongbooks.map((b) => (
                  <li key={b.songbook} className="listen-lp__songbook-grid-cell">
                    <ListenLpSongbookThumb book={b} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="sutra-detail__empty">No songbooks grouped under this sutra in the catalog.</p>
            )}
          </section>

          <section className="sutra-detail__section sutra-detail__section--pivot" aria-labelledby="sutra-pivot-heading">
            <h2 id="sutra-pivot-heading" className="catalog-section-title sutra-detail__pivot-title">
              {WHATS_NEXT[familyKey]?.label ?? 'Now what?'}
            </h2>
            <div className="sutra-detail__pivot-block">
              <p className="sutra-detail__pivot-body">{WHATS_NEXT[familyKey]?.body ?? entry.mental_health_pivot}</p>
              <nav className="sutra-detail__pivot-nav" aria-label="Sutra page navigation">
                <Link className="sutra-detail__pivot-cta sutra-detail__pivot-cta--back" to={ABOUT_SUTRAS_HREF}>
                  ← The seven sutras
                </Link>
                {pivotTarget ? (
                  <Link className="sutra-detail__pivot-cta sutra-detail__pivot-cta--next" to={sutraHrefForFamily(pivotTarget)}>
                    Explore {pivotTarget}sutra →
                  </Link>
                ) : (
                  <Link className="sutra-detail__pivot-cta sutra-detail__pivot-cta--next" to={ABOUT_SUTRAS_HREF}>
                    Explore all sutras →
                  </Link>
                )}
              </nav>
            </div>
          </section>
        </article>
      </div>

      <GlobalFooter />
    </div>
  )
}
