import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type RefObject,
} from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { GlobalHeader } from './GlobalHeader'
import { GlobalFooter } from './GlobalFooter'
import { LazySoundCloudEmbed } from './LazySoundCloudEmbed'
import { SoundCloudPassthroughEmbed } from './SoundCloudPassthroughEmbed'
import { YoutubeEmbeddedPlayer } from './YouTubeEmbed'
import { SongDetailAlsoPartOfCard } from './SongDetailAlsoPartOfCard'
import { SongDetailBertrandEntry } from './SongDetailBertrandEntry'
import {
  useExclusiveYoutubeSoundcloudPlayback,
  type ExclusiveYoutubeSoundcloudControls,
} from './useExclusiveYoutubeSoundcloudPlayback'
import { useExclusiveYoutubeEmbedsPlayback } from './useExclusiveYoutubeEmbedsPlayback'
import { pauseAllYoutubeEmbedsExcept, pauseYoutubeEmbed } from './youtubeEmbedControl'
import { CatalogVideoSpotlight, type CatalogVideoSpotlightItem } from './CatalogVideoSpotlight'
import { CatalogVideoSpotlightRailThumb } from './CatalogVideoSpotlightRailThumb'
import { CatalogMediaOutbound } from './CatalogMediaOutbound'
import {
  PLAY_ALL_DESKTOP_MEDIA_QUERY,
  songDetailPlayAllHonestMobileCopy,
  usePlayAllDesktopAvailable,
} from './playAllPlatform'
import {
  findTrackByScUrl,
  trackSongDetailPlayAllStarted,
  trackSongDetailPlayAllStopped,
  trackSongDetailPlayStarted,
  trackSongDetailQueueAdvanced,
  trackSongDetailQueueSkipped,
  type PlaybackIntent,
} from './catalogAnalytics'
import { formatDurationDisplay } from './durationFormat'
import { bindSoundCloudWidgetPlayback } from './soundCloudWidgetPlayback'
import { loadSoundCloudWidgetApi } from './soundcloudWidgetApi'
import type { SoundCloudWidget } from './soundcloudWidgetApi'
import {
  catalogPathSlugFromTitleAndSlug,
  lyricsIdFromSongUrlSlug,
  browseRowHasAudioSection,
  songCatalogLinkTo,
  songCatalogPath,
} from './songPaths'
import { songbookByName } from './songbooks'
import { sutraClassName } from './sutraTheme'
import type { SongCatalogItem, SongDetailNavState, SongDetailRecord, SongDetailTrack, YouTubeCatalogVideo } from './types'
import { sutraHrefFromSongSutraField } from './sutraPageUtils'
import { buildBrowsePathForFacet, CATALOG_BROWSE_PATH } from './urlState'
import { buildSrcset, coverImageUrl } from '../seo/imageUrl'
import { songRecordingJsonLd } from '../seo/jsonLd'
import { PageMeta } from './PageMeta'
import { songOgImageUrl } from './pageMetaConstants'
import { useSyncCatalogHeaderHeight } from './useSyncCatalogHeaderHeight'
import { SongThumbCard } from './SongThumbCard'
import { useSongCatalogAndDetail, loadYoutubeByLyricsId } from './generatedData'
import './CatalogApp.css'
import './CatalogVideoSpotlight.css'
import './SutrasPages.css'
import './SongDetail.css'

type AudioListenTab = 'tracks' | 'ep'

const SONG_VIDEO_SECTION_TITLE = 'Picture the song'

function formatVideoGenreLabel(video: YouTubeCatalogVideo | undefined): string {
  if (!video) return ''
  return [video.genre_primary, video.genre_secondary]
    .map((g) => (g || '').trim())
    .filter(Boolean)
    .join(' · ')
}

function formatEpListenMeta(trackCount: number, durationTotal: string): string {
  const parts: string[] = []
  if (trackCount > 0) {
    parts.push(`${trackCount} track${trackCount === 1 ? '' : 's'}`)
  }
  const duration = durationTotal.trim()
  if (duration) parts.push(duration)
  return parts.join(' · ')
}

function sameGenreToken(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase()
}

function trackMatchesGenre(track: SongDetailTrack, genre: string): boolean {
  if (!genre.trim()) return false
  const all = [track.primary_genre, ...track.secondary_genres, ...track.genres, track.secondary_genre]
  return all.some((token) => sameGenreToken(token, genre))
}

function trackIsInApp(track: SongDetailTrack): boolean {
  return Boolean(track.track_in_app)
}

function firstInAppPlayableTrack(tracks: SongDetailTrack[], preferredGenre?: string): SongDetailTrack | undefined {
  const preferred = (preferredGenre ?? '').trim()
  if (preferred) {
    const matching = tracks.find((t) => t.sc_url.trim() && trackIsInApp(t) && trackMatchesGenre(t, preferred))
    if (matching) return matching
  }
  return tracks.find((t) => t.sc_url.trim() && trackIsInApp(t))
}

function searchCatalogHref(query: string): string {
  const trimmed = query.trim()
  if (!trimmed) return CATALOG_BROWSE_PATH
  return `${CATALOG_BROWSE_PATH}?find=${encodeURIComponent(trimmed)}`
}

/** Matches `_norm_soundcloud_url` in build_artifacts.py — stable lookup for EP duration metadata. */
function normSoundcloudUrl(url: string): string {
  let u = url.trim().replace(/\/+$/, '').toLowerCase()
  if (!u) return ''
  const q = u.indexOf('?')
  if (q >= 0) u = u.slice(0, q)
  return u
}

/** Single-track list-mode chrome (R9); `/sets/` URLs need enough height for multi-track rows in the SC widget. */
const SC_EMBED_HEIGHT_TRACK_LIST = 166
const SC_EMBED_HEIGHT_SET_PLAYLIST = 450

/** Matches `@media (min-width: 900px)` for `.song-detail-split--two-col` — lyrics clamp only there. */
const SONG_DETAIL_TWO_COL_MQ = '(min-width: 900px)'

/** W-055 wireframe §6: cap top-tracks list before expand (balance vs. lyrics column). */
const SONG_DETAIL_TOP_TRACKS_COLLAPSED_COUNT = 3

function useSongDetailLyricsClampViewport(): boolean {
  const subscribe = useCallback((onStoreChange: () => void) => {
    const mq = window.matchMedia(SONG_DETAIL_TWO_COL_MQ)
    mq.addEventListener('change', onStoreChange)
    return () => mq.removeEventListener('change', onStoreChange)
  }, [])
  const getSnapshot = useCallback(() => window.matchMedia(SONG_DETAIL_TWO_COL_MQ).matches, [])
  const getServerSnapshot = useCallback(() => false, [])
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

function lyricsPreOverflowsClippedBox(pre: HTMLPreElement): boolean {
  return pre.scrollHeight > pre.clientHeight + 2
}

export function SongDetail() {
  const { slug = '' } = useParams()
  const trimmed = slug.trim()
  if (!trimmed || trimmed === 'null' || trimmed === 'undefined') {
    return <SongDetailInvalidSlug urlSlug={trimmed} />
  }
  const lyricsId = lyricsIdFromSongUrlSlug(trimmed)
  if (!lyricsId) {
    return <SongDetailInvalidSlug urlSlug={trimmed} />
  }
  return <SongDetailInner key={lyricsId} lyricsId={lyricsId} urlSlug={trimmed} />
}

function SongDetailInvalidSlug({ urlSlug }: { urlSlug: string }) {
  return (
    <div className="catalog catalog-page catalog-page--shell">
      <PageMeta title="Song not found" path={urlSlug ? songCatalogPath('', urlSlug) : undefined} />
      <div className="catalog-page__main">
        <main id="main-content" className="song-detail song-detail--missing catalog-layout-shell">
          <p className="song-detail-missing-title">No song for this link.</p>
          <p className="song-detail-missing-hint">The link may be outdated or not in the current snapshot.</p>
          <Link to={CATALOG_BROWSE_PATH} className="song-detail-back">
            ← Back to Songs
          </Link>
        </main>
      </div>
    </div>
  )
}

/** Shell: canonical slug redirect, missing-song UI, and chrome sync — no hooks after `if (!detail)`. */
function SongDetailInner({ lyricsId, urlSlug }: { lyricsId: string; urlSlug: string }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const { catalog: songCatalogRows, detailMap, error: dataError, loading: dataLoading } = useSongCatalogAndDetail()

  const detail = useMemo(() => {
    if (!lyricsId.trim() || !detailMap) return undefined
    return detailMap[lyricsId]
  }, [lyricsId, detailMap])

  const songCatalogByLyricsId = useMemo(() => {
    if (!songCatalogRows) return new Map<string, SongCatalogItem>()
    return new Map(songCatalogRows.map((s) => [s.lyrics_id, s]))
  }, [songCatalogRows])
  const fullSearch = searchParams.toString()
  const catalogSearch = useMemo(() => {
    const p = new URLSearchParams(fullSearch)
    p.delete('section')
    return p.toString()
  }, [fullSearch])
  const catalogPath = catalogSearch ? `${CATALOG_BROWSE_PATH}?${catalogSearch}` : CATALOG_BROWSE_PATH

  const wordsListReturn = (location.state as SongDetailNavState | null)?.wordsListReturn
  const listBreadcrumbHref =
    typeof wordsListReturn === 'string' && wordsListReturn.length > 0 ? wordsListReturn : catalogPath
  const listBreadcrumbLabel =
    typeof wordsListReturn === 'string' && wordsListReturn.length > 0 ? 'Words' : 'Songs'

  const pageRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLElement>(null)

  const canonicalSlug = useMemo(
    () => (detail ? catalogPathSlugFromTitleAndSlug(detail.lyrics_title, detail.url_slug) : ''),
    [detail],
  )

  /** In-app navigations (e.g. /videos → /songs/…) should start at the hero, not a restored mid-page scroll or a jump from scroll anchoring when embeds load. */
  useLayoutEffect(() => {
    if (!location.pathname.startsWith('/songs/')) return
    window.scrollTo(0, 0)
  }, [location.pathname])

  useLayoutEffect(() => {
    if (!detail || !canonicalSlug) return
    if (urlSlug === canonicalSlug) return
    const tail = fullSearch ? `?${fullSearch}` : ''
    navigate(`${songCatalogPath(detail.lyrics_title, canonicalSlug)}${tail}`, { replace: true, state: location.state })
  }, [detail, urlSlug, canonicalSlug, fullSearch, navigate, location.state])

  const pageMeta = (
    <PageMeta
      title={detail ? `${detail.lyrics_title} · Song` : dataLoading ? 'Song' : 'Song not found'}
      description={
        detail
          ? (detail.lyrics_summary || '').trim() ||
            (detail.lyrics_extract || '').trim().split(/\r?\n/).filter(Boolean)[0] ||
            `Listen to ${detail.lyrics_title} on BANANASUTRA.`
          : undefined
      }
      image={detail && canonicalSlug ? songOgImageUrl(canonicalSlug) : undefined}
      path={detail && canonicalSlug ? songCatalogPath(detail.lyrics_title, canonicalSlug) : undefined}
      publishedAt={songCatalogByLyricsId.get(lyricsId)?.published_at || detail?.tracks?.[0]?.created_at}
      jsonLd={
        detail && canonicalSlug ? songRecordingJsonLd(detail, canonicalSlug, { songbookTitle: detail.songbook }) : undefined
      }
    />
  )

  useSyncCatalogHeaderHeight(pageRef, headerRef, [detail?.lyrics_id, detail?.lyrics_title, catalogSearch])

  if (dataLoading) {
    return (
      <div ref={pageRef} className="catalog catalog-page catalog-page--shell">
        {pageMeta}
        <GlobalHeader ref={headerRef} />
        <div className="catalog-page__main">
          <main id="main-content" className="song-detail catalog-layout-shell">
            <p className="song-detail-missing-title">Loading song…</p>
          </main>
        </div>
        <GlobalFooter />
      </div>
    )
  }

  if (dataError || !detailMap || !songCatalogRows) {
    return (
      <div ref={pageRef} className="catalog catalog-page catalog-page--shell">
        {pageMeta}
        <GlobalHeader ref={headerRef} />
        <div className="catalog-page__main">
          <main id="main-content" className="song-detail song-detail--missing catalog-layout-shell">
            <p className="song-detail-missing-title">{dataError ?? 'Could not load song data.'}</p>
            <p className="song-detail-missing-hint">Try refreshing the page.</p>
            <Link to={listBreadcrumbHref} className="song-detail-back">
              ← Back to {listBreadcrumbLabel}
            </Link>
          </main>
        </div>
        <GlobalFooter />
      </div>
    )
  }

  if (!detail) {
    return (
      <div ref={pageRef} className="catalog catalog-page catalog-page--shell">
        {pageMeta}
        <GlobalHeader ref={headerRef} />
        <div className="catalog-page__main">
          <main id="main-content" className="song-detail song-detail--missing catalog-layout-shell">
            <p className="song-detail-missing-title">No song for this link.</p>
            <p className="song-detail-missing-hint">The link may be outdated or not in the current snapshot.</p>
            <Link to={listBreadcrumbHref} className="song-detail-back">
              ← Back to {listBreadcrumbLabel}
            </Link>
          </main>
        </div>
        <GlobalFooter />
      </div>
    )
  }

  return (
    <>
      {pageMeta}
      <SongDetailLoaded
        detail={detail}
        lyricsId={lyricsId}
        pageRef={pageRef}
        headerRef={headerRef}
        listBreadcrumbHref={listBreadcrumbHref}
        listBreadcrumbLabel={listBreadcrumbLabel}
        songCatalogByLyricsId={songCatalogByLyricsId}
        detailByLyricsId={detailMap}
      />
    </>
  )
}

type SongDetailLoadedProps = {
  detail: SongDetailRecord
  lyricsId: string
  pageRef: RefObject<HTMLDivElement | null>
  headerRef: RefObject<HTMLElement | null>
  listBreadcrumbHref: string
  listBreadcrumbLabel: string
  songCatalogByLyricsId: Map<string, SongCatalogItem>
  detailByLyricsId: Record<string, SongDetailRecord>
}

function SongDetailLoaded({
  detail,
  lyricsId,
  pageRef,
  headerRef,
  listBreadcrumbHref,
  listBreadcrumbLabel,
  songCatalogByLyricsId,
  detailByLyricsId,
}: SongDetailLoadedProps) {
  const [searchParams] = useSearchParams()
  const activeTrackGenre = searchParams.get('tg')?.trim() ?? ''
  const requestedSection = (searchParams.get('section') ?? '').trim().toLowerCase()

  const [youtubeVideos, setYoutubeVideos] = useState<YouTubeCatalogVideo[]>([])
  const [youtubeVideosLoaded, setYoutubeVideosLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    queueMicrotask(() => {
      if (!cancelled) setYoutubeVideosLoaded(false)
    })
    loadYoutubeByLyricsId()
      .then((o) => {
        if (!cancelled) {
          setYoutubeVideos(o[lyricsId] ?? [])
          setYoutubeVideosLoaded(true)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setYoutubeVideos([])
          setYoutubeVideosLoaded(true)
        }
      })
    return () => {
      cancelled = true
    }
  }, [lyricsId])

  const orderedTracks = useMemo(() => {
    const byLikesThenPlays = (a: SongDetailTrack, b: SongDetailTrack) => {
      const ld = b.like_count - a.like_count
      if (ld !== 0) return ld
      return b.play_count - a.play_count
    }
    if (!activeTrackGenre) return [...detail.tracks].sort(byLikesThenPlays)
    return [...detail.tracks].sort((a, b) => {
      const aMatch = trackMatchesGenre(a, activeTrackGenre) ? 1 : 0
      const bMatch = trackMatchesGenre(b, activeTrackGenre) ? 1 : 0
      if (bMatch !== aMatch) return bMatch - aMatch
      return byLikesThenPlays(a, b)
    })
  }, [detail, activeTrackGenre])

  const orderedRelatedSongs = useMemo(() => {
    const hasAnySoundCloudSignal = (
      songRow: SongCatalogItem | undefined,
      detailRow: SongDetailRecord | undefined,
      relatedRow: SongDetailRecord['related_songs'][number],
    ): boolean => {
      if (songRow && browseRowHasAudioSection(songRow)) return true
      if (relatedRow.has_in_app_playback || relatedRow.has_sc_catalog_listen) return true
      if (detailRow) {
        if ((detailRow.primary_ep_url || '').trim()) return true
        if ((detailRow.fallback_sc_url || '').trim()) return true
        if ((detailRow.sc_catalog_listen_url || '').trim()) return true
        if (detailRow.tracks.some((t) => (t.sc_url || '').trim())) return true
      }
      return false
    }
    const mediaTier = (
      songRow: SongCatalogItem | undefined,
      detailRow: SongDetailRecord | undefined,
      relatedRow: SongDetailRecord['related_songs'][number],
    ): number => {
      const inAppAudio = Boolean(
        songRow?.has_in_app_playback ||
          songRow?.has_sc_catalog_listen ||
          relatedRow.has_in_app_playback ||
          relatedRow.has_sc_catalog_listen,
      )
      if (inAppAudio) return 0
      const hasAnyMedia = hasAnySoundCloudSignal(songRow, detailRow, relatedRow) || Boolean(songRow?.has_youtube_video || relatedRow.has_youtube_video)
      if (hasAnyMedia) return 1
      return 2
    }
    const related = [...detail.related_songs]
    related.sort((a, b) => {
      const aRow = songCatalogByLyricsId.get(a.lyrics_id)
      const bRow = songCatalogByLyricsId.get(b.lyrics_id)
      const aDetail = detailByLyricsId[a.lyrics_id]
      const bDetail = detailByLyricsId[b.lyrics_id]
      const aTier = mediaTier(aRow, aDetail, a)
      const bTier = mediaTier(bRow, bDetail, b)
      if (aTier !== bTier) return aTier - bTier

      const aLikes = aRow?.aggregate_like_count ?? 0
      const bLikes = bRow?.aggregate_like_count ?? 0
      if (bLikes !== aLikes) return bLikes - aLikes

      const aPlays = aRow?.aggregate_play_count ?? 0
      const bPlays = bRow?.aggregate_play_count ?? 0
      if (bPlays !== aPlays) return bPlays - aPlays

      return a.lyrics_title.localeCompare(b.lyrics_title, undefined, { sensitivity: 'base' })
    })
    return related
  }, [detail.related_songs, songCatalogByLyricsId, detailByLyricsId])

  const defaultTrack = useMemo(
    () => firstInAppPlayableTrack(orderedTracks, activeTrackGenre),
    [orderedTracks, activeTrackGenre],
  )

  const defaultYoutubeVideo = useMemo(() => youtubeVideos.find((v) => v.can_embed) ?? youtubeVideos[0], [youtubeVideos])

  const [selectedYoutubeVideoId, setSelectedYoutubeVideoId] = useState<string | null>(null)

  const effectiveYoutubeVideoId = useMemo(() => {
    const chosen = (selectedYoutubeVideoId ?? '').trim()
    if (chosen && youtubeVideos.some((v) => v.video_id === chosen)) return chosen
    return (defaultYoutubeVideo?.video_id ?? '').trim()
  }, [selectedYoutubeVideoId, youtubeVideos, defaultYoutubeVideo])

  const focusedYoutubeVideo = useMemo(
    () => youtubeVideos.find((v) => v.video_id === effectiveYoutubeVideoId),
    [youtubeVideos, effectiveYoutubeVideoId],
  )

  const useSongVideoSpotlight = youtubeVideos.length > 1 && youtubeVideos.some((v) => v.can_embed)

  const songVideoSpotlightFeatured = useMemo((): CatalogVideoSpotlightItem | null => {
    if (!focusedYoutubeVideo?.can_embed) return null
    const title = (focusedYoutubeVideo.title || focusedYoutubeVideo.lyrics_title || detail.lyrics_title).trim()
    return {
      videoId: focusedYoutubeVideo.video_id,
      title,
      sutra: (detail.sutra || focusedYoutubeVideo.sutra || '').trim() || undefined,
      duration: formatDurationDisplay(focusedYoutubeVideo.duration) || undefined,
      inApp: true,
    }
  }, [focusedYoutubeVideo, detail.lyrics_title, detail.sutra])

  const songVideoSpotlightRail = useMemo((): CatalogVideoSpotlightItem[] => {
    return youtubeVideos
      .filter((v) => v.can_embed && v.video_id !== effectiveYoutubeVideoId)
      .map((v) => ({
        videoId: v.video_id,
        title: (v.title || v.lyrics_title || detail.lyrics_title).trim(),
        sutra: (detail.sutra || v.sutra || '').trim() || undefined,
        duration: formatDurationDisplay(v.duration) || undefined,
        inApp: true,
      }))
  }, [youtubeVideos, effectiveYoutubeVideoId, detail.lyrics_title, detail.sutra])

  const renderSongVideoRailCell = useCallback(
    (video: CatalogVideoSpotlightItem, isActive: boolean, onSelect: () => void) => {
      const source = youtubeVideos.find((v) => v.video_id === video.videoId)
      const genreLabel = formatVideoGenreLabel(source)
      const ariaLabel = genreLabel ? `Play video · ${genreLabel}` : `Play video ${video.videoId}`
      return (
        <CatalogVideoSpotlightRailThumb
          thumbnailUrl={source?.thumbnail_url}
          caption={genreLabel || null}
          isActive={isActive}
          onSelect={onSelect}
          ariaLabel={ariaLabel}
        />
      )
    },
    [youtubeVideos],
  )

  const [selectedUrl, setSelectedUrl] = useState<string | null>(null)
  const [soundcloudReloadKey, setSoundcloudReloadKey] = useState(0)
  const [lyricsExpanded, setLyricsExpanded] = useState(false)
  const [lyricsTall, setLyricsTall] = useState(false)
  const [mediaColumnHeightPx, setMediaColumnHeightPx] = useState<number | null>(null)
  const [videoInView, setVideoInView] = useState(false)
  const lyricsPreRef = useRef<HTMLPreElement>(null)
  const epEmbedWrapRef = useRef<HTMLDivElement>(null)
  const youtubeExclusiveRef = useRef<HTMLIFrameElement>(null)
  const exclusivePlaybackRef = useRef<ExclusiveYoutubeSoundcloudControls | null>(null)
  const videoSectionRef = useRef<HTMLElement>(null)
  const mediaColumnRef = useRef<HTMLDivElement>(null)

  const songbookRecord = useMemo(
    () => (detail.songbook ? songbookByName(detail.songbook) : undefined),
    [detail.songbook],
  )

  const fallbackScUrl = (detail.fallback_sc_url ?? '').trim()
  const catalogListenUrl = (detail.sc_catalog_listen_url ?? '').trim()
  const primaryEpUrl = (detail.primary_ep_url ?? '').trim()
  const primaryEpTitle = (detail.primary_ep_title ?? '').trim()
  const epUrlNorm = normSoundcloudUrl(primaryEpUrl)
  const songbookPlaylistUrl = (songbookRecord?.playlist_url ?? '').trim()
  const songbookUrlNorm = normSoundcloudUrl(songbookPlaylistUrl)
  const showEpEmbed = Boolean(primaryEpUrl.includes('/sets/') && epUrlNorm && epUrlNorm !== songbookUrlNorm)

  const primaryEpListenMeta = useMemo(() => {
    if (!showEpEmbed) return ''
    const epTrack = detail.tracks.find((t) => normSoundcloudUrl(t.ep_url) === epUrlNorm)
    const trackCount = epTrack?.ep_total_tracks ?? 0
    const duration =
      detail.sc_ep_set_duration_totals?.[primaryEpUrl] ??
      detail.sc_ep_set_duration_totals?.[epUrlNorm] ??
      ''
    return formatEpListenMeta(trackCount, duration)
  }, [detail, epUrlNorm, primaryEpUrl, showEpEmbed])

  const lyricsExtract = useMemo(() => (detail.lyrics_extract || '').trim(), [detail.lyrics_extract])

  const playingUrl = (
    selectedUrl?.trim() ||
    defaultTrack?.sc_url?.trim() ||
    fallbackScUrl ||
    catalogListenUrl ||
    ''
  ).trim()
  const inAppPlayableTracks = orderedTracks.filter((t) => trackIsInApp(t) && t.sc_url.trim())
  const playAllDesktopAvailable = usePlayAllDesktopAvailable()

  const [audioListenTab, setAudioListenTab] = useState<AudioListenTab>('tracks')
  const [topTracksExpanded, setTopTracksExpanded] = useState(false)
  const [playAllTopTracksActive, setPlayAllTopTracksActive] = useState(false)
  const [isScPlaying, setIsScPlaying] = useState(false)
  const playAllTopTracksActiveRef = useRef(false)
  const isScPlayingRef = useRef(false)
  const playerWrapRef = useRef<HTMLDivElement | null>(null)
  const scWidgetRef = useRef<SoundCloudWidget | null>(null)
  const inAppPlayableTracksRef = useRef<SongDetailTrack[]>(inAppPlayableTracks)
  const playingUrlRef = useRef<string>(playingUrl)
  const advanceToNextInQueueRef = useRef<() => void>(() => {})
  const playbackIntentRef = useRef<PlaybackIntent>('user_pick')
  const queueIndex = useMemo(
    () => inAppPlayableTracks.findIndex((t) => t.sc_url.trim() === playingUrl.trim()),
    [inAppPlayableTracks, playingUrl],
  )
  const canGoPrevious = queueIndex > 0
  const canGoNext = queueIndex >= 0 && queueIndex < inAppPlayableTracks.length - 1

  useEffect(() => {
    playAllTopTracksActiveRef.current = playAllTopTracksActive
  }, [playAllTopTracksActive])

  useEffect(() => {
    isScPlayingRef.current = isScPlaying
  }, [isScPlaying])

  useEffect(() => {
    inAppPlayableTracksRef.current = inAppPlayableTracks
  }, [inAppPlayableTracks])

  useEffect(() => {
    playingUrlRef.current = playingUrl
  }, [playingUrl])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset playing indicator when embed track changes
    setIsScPlaying(false)
  }, [playingUrl])

  const soundcloudMainEmbedHeight =
    playingUrl.includes('/sets/') ? SC_EMBED_HEIGHT_SET_PLAYLIST : SC_EMBED_HEIGHT_TRACK_LIST

  const requestSoundcloudPlayback = useCallback((url: string) => {
    setSelectedUrl(url)
    setSoundcloudReloadKey((k) => k + 1)
  }, [])

  const pausePlayback = useCallback(() => {
    try {
      scWidgetRef.current?.pause()
    } catch {
      // Keep controls responsive even if widget API is unavailable.
    }
    setIsScPlaying(false)
  }, [])

  const resumePlayback = useCallback(() => {
    try {
      scWidgetRef.current?.play()
    } catch {
      // Ignore widget play failures.
    }
  }, [])

  const pickTopTrack = useCallback(
    (url: string, { keepPlayAll = false }: { keepPlayAll?: boolean } = {}) => {
      const trimmedUrl = url.trim()
      if (trimmedUrl && trimmedUrl === playingUrlRef.current.trim() && scWidgetRef.current) {
        if (isScPlayingRef.current) {
          pausePlayback()
          return
        }
        resumePlayback()
        return
      }

      const queue = inAppPlayableTracksRef.current
      const track = findTrackByScUrl(queue, url)
      if (!keepPlayAll && playAllTopTracksActiveRef.current) {
        const idx = queue.findIndex((t) => t.sc_url.trim() === playingUrlRef.current.trim())
        trackSongDetailPlayAllStopped(idx >= 0 ? idx + 1 : 0, queue.length, 'replaced_by_new_queue')
        playAllTopTracksActiveRef.current = false
        setPlayAllTopTracksActive(false)
      }
      if (track) {
        trackSongDetailPlayStarted(track, playbackIntentRef.current)
      }
      playbackIntentRef.current = 'user_pick'
      requestSoundcloudPlayback(url)
    },
    [pausePlayback, requestSoundcloudPlayback, resumePlayback],
  )

  const stopCurrentPlayback = useCallback(() => {
    pausePlayback()
  }, [pausePlayback])

  const stopPlayAllTopTracks = useCallback(() => {
    const queue = inAppPlayableTracksRef.current
    const idx = queue.findIndex((t) => t.sc_url.trim() === playingUrlRef.current.trim())
    trackSongDetailPlayAllStopped(idx >= 0 ? idx + 1 : 0, queue.length, 'user_stop')
    playAllTopTracksActiveRef.current = false
    setPlayAllTopTracksActive(false)
    stopCurrentPlayback()
  }, [stopCurrentPlayback])

  const pausePlayAllTopTracks = useCallback(() => {
    pausePlayback()
  }, [pausePlayback])

  const resumePlayAllTopTracks = useCallback(() => {
    resumePlayback()
  }, [resumePlayback])

  const startPlayAllTopTracks = useCallback(() => {
    if (!window.matchMedia(PLAY_ALL_DESKTOP_MEDIA_QUERY).matches) return
    const queue = inAppPlayableTracksRef.current
    const firstUrl = queue[0]?.sc_url.trim()
    if (!firstUrl) return
    trackSongDetailPlayAllStarted(queue.length)
    playbackIntentRef.current = 'play_all_start'
    playAllTopTracksActiveRef.current = true
    setPlayAllTopTracksActive(true)
    pickTopTrack(firstUrl, { keepPlayAll: true })
  }, [pickTopTrack])

  const jumpInQueue = useCallback(
    (delta: -1 | 1) => {
      const queue = inAppPlayableTracksRef.current
      const current = playingUrlRef.current.trim()
      if (!queue.length || !current) return
      const idx = queue.findIndex((t) => t.sc_url.trim() === current)
      if (idx < 0) return
      const nextIdx = idx + delta
      if (nextIdx < 0 || nextIdx >= queue.length) return
      const nextUrl = queue[nextIdx]?.sc_url.trim()
      if (!nextUrl) return
      const currentTrack = findTrackByScUrl(queue, current)
      const nextTrack = findTrackByScUrl(queue, nextUrl)
      if (currentTrack && nextTrack) {
        trackSongDetailQueueSkipped({
          from: currentTrack,
          to: nextTrack,
          direction: delta === 1 ? 'next' : 'previous',
        })
      }
      playbackIntentRef.current = 'queue_skip'
      pickTopTrack(nextUrl, { keepPlayAll: playAllTopTracksActiveRef.current })
    },
    [pickTopTrack],
  )

  const advanceToNextInQueue = useCallback(() => {
    const queue = inAppPlayableTracksRef.current
    const current = playingUrlRef.current.trim()

    if (!queue.length || !current) {
      stopPlayAllTopTracks()
      return
    }

    const idx = queue.findIndex((t) => t.sc_url.trim() === current)
    if (idx < 0) {
      stopPlayAllTopTracks()
      return
    }

    const next = queue[idx + 1]
    if (!next) {
      trackSongDetailPlayAllStopped(queue.length, queue.length, 'queue_exhausted')
      stopPlayAllTopTracks()
      return
    }

    const nextUrl = next.sc_url.trim()
    if (!nextUrl) {
      stopPlayAllTopTracks()
      return
    }

    const currentTrack = findTrackByScUrl(queue, current)
    if (currentTrack) {
      trackSongDetailQueueAdvanced({
        from: currentTrack,
        to: next,
        position: idx + 2,
        total: queue.length,
      })
    }
    playbackIntentRef.current = 'queue_advance'
    pickTopTrack(nextUrl, { keepPlayAll: true })
  }, [pickTopTrack, stopPlayAllTopTracks])

  useEffect(() => {
    advanceToNextInQueueRef.current = advanceToNextInQueue
  }, [advanceToNextInQueue])

  const handlePlayerLoad = useCallback(() => {
    const wrap = playerWrapRef.current
    if (!wrap) return
    const iframe = wrap.querySelector<HTMLIFrameElement>('iframe.sc-embed-frame')
    if (!iframe) return

    void loadSoundCloudWidgetApi()
      .then((SC) => {
        const widget = SC.Widget(iframe)
        scWidgetRef.current = widget
        bindSoundCloudWidgetPlayback(widget, SC, {
          onPlayingChange: setIsScPlaying,
          onFinish: () => {
            if (!playAllTopTracksActiveRef.current) return
            advanceToNextInQueueRef.current()
          },
        })
      })
      .catch(() => {
        // Widget API failed to load; Play All becomes effectively manual.
      })
  }, [])

  const writtenYear = (detail.written_year ?? '').trim()
  const museName = (detail.muse ?? '').trim()
  const hasHeroFacetMeta =
    Boolean(detail.topic) ||
    Boolean(detail.intention) ||
    Boolean(detail.light_shadow) ||
    Boolean(detail.lang) ||
    Boolean(writtenYear)
  const hasYoutubeVideos = youtubeVideos.length > 0
  const hasLyrics = Boolean((detail.lyrics_text || '').trim())
  const hasPlayableTrack = Boolean(playingUrl)
  const hasEpFallback = Boolean(primaryEpUrl)
  const hasAnyTrackUrls = detail.tracks.some((t) => t.sc_url.trim())
  const shouldShowTracksList = orderedTracks.length > 1 || Boolean(activeTrackGenre)
  const hasScCatalogListen = Boolean(catalogListenUrl)
  const defaultingToCatalogExport =
    hasScCatalogListen && !defaultTrack && !fallbackScUrl && !(selectedUrl?.trim())
  const hasAudioContent =
    hasPlayableTrack || hasEpFallback || hasAnyTrackUrls || shouldShowTracksList || hasScCatalogListen
  const hasScAudio = hasAudioContent
  const hasTopTracksPanel = Boolean(
    hasPlayableTrack || hasScCatalogListen || shouldShowTracksList || (hasEpFallback && !showEpEmbed),
  )
  const hasAudioSourceTabs = Boolean(showEpEmbed && hasTopTracksPanel)
  const showTracksPanel = hasTopTracksPanel && (!hasAudioSourceTabs || audioListenTab === 'tracks')
  const showEpPanel = Boolean(showEpEmbed && (!hasTopTracksPanel || (hasAudioSourceTabs && audioListenTab === 'ep')))
  const showVideoInColumn = hasYoutubeVideos && !hasScAudio
  const showVideoBelow = hasYoutubeVideos && hasScAudio
  const showAudioSection = hasAudioContent
  const showVideoSection = showVideoInColumn
  const hasMediaColumnForSplit = showAudioSection || showVideoInColumn
  /** No hero art / fallback column: lyrics-first rows with no listener media (e.g. pipeline-only songs). */
  const isLyricsOnlyNoCoverHero =
    !(detail.cover_image_url || '').trim() && !hasAudioContent && !hasYoutubeVideos
  const useLyricsMediaSplit = hasLyrics && hasMediaColumnForSplit
  const hasListenTabNav = hasAudioSourceTabs && useLyricsMediaSplit
  const tracksTabLabel = inAppPlayableTracks.length <= 1 ? 'Listen' : 'Top tracks'
  const topTracksHasOverflow = orderedTracks.length > SONG_DETAIL_TOP_TRACKS_COLLAPSED_COUNT
  const topTracksListExpanded = topTracksExpanded || !topTracksHasOverflow
  const displayedTopTracks = topTracksListExpanded
    ? orderedTracks
    : orderedTracks.slice(0, SONG_DETAIL_TOP_TRACKS_COLLAPSED_COUNT)
  const playAllHonestMobileCopy = songDetailPlayAllHonestMobileCopy({
    hasFullEpListen: showEpEmbed,
    hasFullEpTab: hasListenTabNav,
    hasSongbookPlaylist: Boolean(songbookPlaylistUrl),
  })

  const songExclusivePlaybackEnabled = Boolean(showEpPanel || hasPlayableTrack || hasYoutubeVideos)
  const embeddableYoutubeCount = useMemo(
    () => youtubeVideos.filter((v) => v.can_embed).length,
    [youtubeVideos],
  )
  const songYtYtExclusivityEnabled = embeddableYoutubeCount >= 2

  useExclusiveYoutubeSoundcloudPlayback({
    youtubeIframeRef: youtubeExclusiveRef,
    soundcloudWrapRefs: [epEmbedWrapRef, playerWrapRef],
    enabled: songExclusivePlaybackEnabled,
    controlsRef: exclusivePlaybackRef,
    syncKey: `${lyricsId}|ep:${primaryEpUrl}|tr:${playingUrl}|tab:${audioListenTab}|yt:${effectiveYoutubeVideoId}`,
  })

  useExclusiveYoutubeEmbedsPlayback(songYtYtExclusivityEnabled)

  const pauseSoundcloudForVideo = useCallback(() => {
    exclusivePlaybackRef.current?.pauseAllSoundcloud()
  }, [])

  const onBeforeYoutubePlay = useCallback(() => {
    pauseSoundcloudForVideo()
    pauseAllYoutubeEmbedsExcept(youtubeExclusiveRef.current)
  }, [pauseSoundcloudForVideo])

  const selectYoutubeVideo = useCallback(
    (videoId: string) => {
      pauseSoundcloudForVideo()
      pauseYoutubeEmbed(youtubeExclusiveRef.current)
      setSelectedYoutubeVideoId(videoId)
    },
    [pauseSoundcloudForVideo],
  )
  const requestedMode = (searchParams.get('mode') ?? '').trim().toLowerCase()
  const isSongDetailTwoColDesktop = useSongDetailLyricsClampViewport()
  /** Collapse long lyrics only on desktop two-column layout — tablet/mobile and lyrics-only pages show full text. */
  const lyricsClampEnabled = useLyricsMediaSplit && isSongDetailTwoColDesktop

  const measureLyricsClamp = useCallback(() => {
    const pre = lyricsPreRef.current
    if (!lyricsClampEnabled || !pre || lyricsExpanded) return
    setLyricsTall(lyricsPreOverflowsClippedBox(pre))
  }, [lyricsClampEnabled, lyricsExpanded])

  const scheduleLyricsClampMeasure = useCallback(() => {
    measureLyricsClamp()
    requestAnimationFrame(() => {
      measureLyricsClamp()
      requestAnimationFrame(measureLyricsClamp)
    })
  }, [measureLyricsClamp])

  useLayoutEffect(() => {
    if (!lyricsClampEnabled) {
      setLyricsTall(false)
      return
    }
    scheduleLyricsClampMeasure()
  }, [
    detail.lyrics_text,
    lyricsClampEnabled,
    lyricsExpanded,
    scheduleLyricsClampMeasure,
    topTracksExpanded,
    audioListenTab,
    hasListenTabNav,
    inAppPlayableTracks.length,
    orderedTracks.length,
  ])

  useEffect(() => {
    queueMicrotask(() => {
      setLyricsExpanded(false)
      setAudioListenTab('tracks')
      setTopTracksExpanded(false)
    })
  }, [detail.lyrics_id])

  useEffect(() => {
    if (!topTracksHasOverflow || topTracksExpanded) return
    const activeIdx = orderedTracks.findIndex((t) => t.sc_url.trim() === playingUrl.trim())
    if (activeIdx >= SONG_DETAIL_TOP_TRACKS_COLLAPSED_COUNT) {
      setTopTracksExpanded(true)
    }
  }, [orderedTracks, playingUrl, topTracksHasOverflow, topTracksExpanded])

  useEffect(() => {
    if (!lyricsClampEnabled) {
      queueMicrotask(() => setMediaColumnHeightPx(null))
      return
    }
    const mediaCol = mediaColumnRef.current
    if (!mediaCol || typeof ResizeObserver === 'undefined') return

    const syncMediaColumnHeight = () => {
      setMediaColumnHeightPx(mediaCol.offsetHeight)
      scheduleLyricsClampMeasure()
    }

    syncMediaColumnHeight()
    const observer = new ResizeObserver(syncMediaColumnHeight)
    observer.observe(mediaCol)
    window.addEventListener('resize', syncMediaColumnHeight)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', syncMediaColumnHeight)
    }
  }, [
    lyricsClampEnabled,
    scheduleLyricsClampMeasure,
    detail.lyrics_id,
    topTracksExpanded,
    audioListenTab,
    hasListenTabNav,
    inAppPlayableTracks.length,
    orderedTracks.length,
  ])

  useEffect(() => {
    if (!youtubeVideosLoaded) return
    const shouldScrollVideo =
      (requestedSection === 'video' && hasYoutubeVideos) || (requestedMode === 'watch' && hasYoutubeVideos)
    if (!shouldScrollVideo) return
    const node = videoSectionRef.current
    if (!node) return
    const timer = window.setTimeout(() => {
      node.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 120)
    return () => window.clearTimeout(timer)
  }, [requestedSection, requestedMode, hasYoutubeVideos, youtubeVideosLoaded, detail.lyrics_id])

  useEffect(() => {
    const node = videoSectionRef.current
    if (!node || !hasYoutubeVideos) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setVideoInView(true)
      },
      { rootMargin: '200px 0px', threshold: 0.01 },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [hasYoutubeVideos, detail.lyrics_id])

  return (
    <div ref={pageRef} className="catalog catalog-page catalog-page--shell">
      <GlobalHeader ref={headerRef} />

      <div className="catalog-page__main">
        <main id="main-content" className="song-detail catalog-layout-shell">
          <nav className="catalog-breadcrumbs" aria-label="Breadcrumb">
            <Link to="/" className="catalog-breadcrumbs__link">
              Home
            </Link>
            <span className="catalog-breadcrumbs__sep" aria-hidden>
              /
            </span>
            <Link to={listBreadcrumbHref} className="catalog-breadcrumbs__link">
              {listBreadcrumbLabel}
            </Link>
            <span className="catalog-breadcrumbs__sep" aria-hidden>
              /
            </span>
            <span className="catalog-breadcrumbs__current" aria-current="page">{detail.lyrics_title}</span>
          </nav>

          <header className={`song-detail-hero${isLyricsOnlyNoCoverHero ? ' song-detail-hero--lyrics-only' : ''}`}>
            {!isLyricsOnlyNoCoverHero ? (
              <div className="song-detail-cover">
                {detail.cover_image_url ? (
                  <picture>
                    <source
                      srcSet={buildSrcset(detail.cover_image_url)}
                      sizes="(max-width: 640px) 400px, 640px"
                    />
                    <img
                      src={coverImageUrl(detail.cover_image_url, { width: 400 })}
                      alt=""
                      width={280}
                      height={280}
                      loading="eager"
                      fetchPriority="high"
                      decoding="sync"
                    />
                  </picture>
                ) : (
                  <div className="song-detail-cover-fallback" aria-hidden>
                    🍌
                  </div>
                )}
              </div>
            ) : null}
            <div className="song-detail-hero-text">
              <h1 className="song-detail-title song-title">{detail.lyrics_title}</h1>
              {detail.lyrics_summary ? <p className="song-detail-summary">{detail.lyrics_summary}</p> : null}
              {detail.sutra ? (
                <ul className="song-detail-secondary-meta song-detail-secondary-meta--sutra" aria-label="Sutra">
                  <li className="song-detail-secondary-meta-item">
                    <Link
                      className="song-detail-secondary-link"
                      to={sutraHrefFromSongSutraField(detail.sutra) ?? buildBrowsePathForFacet('sutra', detail.sutra)}
                    >
                      <span className={`catalog-facet-sutra-name ${sutraClassName(detail.sutra)}`}>{detail.sutra}</span>
                    </Link>
                  </li>
                </ul>
              ) : null}
              {hasHeroFacetMeta ? (
                <>
                  <ul className="song-detail-secondary-meta" aria-label="Song metadata">
                      {detail.topic ? (
                        <li className="song-detail-secondary-meta-item">
                          <Link className="song-detail-secondary-link" to={buildBrowsePathForFacet('topic', detail.topic)}>
                            {detail.topic}
                          </Link>
                        </li>
                      ) : null}
                      {detail.intention ? (
                        <li className="song-detail-secondary-meta-item">
                          <Link className="song-detail-secondary-link" to={buildBrowsePathForFacet('intention', detail.intention)}>
                            {detail.intention}
                          </Link>
                        </li>
                      ) : null}
                      {detail.light_shadow ? (
                        <li className="song-detail-secondary-meta-item">
                          <Link className="song-detail-secondary-link" to={buildBrowsePathForFacet('light_shadow', detail.light_shadow)}>
                            {detail.light_shadow}
                          </Link>
                        </li>
                      ) : null}
                      {detail.lang ? (
                        <li className="song-detail-secondary-meta-item">
                          <Link className="song-detail-secondary-link" to={buildBrowsePathForFacet('lang', detail.lang)}>
                            {detail.lang}
                          </Link>
                        </li>
                      ) : null}
                      {writtenYear ? (
                        <li className="song-detail-secondary-meta-item">
                          <Link className="song-detail-secondary-link" to={buildBrowsePathForFacet('written_year', writtenYear)}>
                            {writtenYear}
                          </Link>
                        </li>
                      ) : null}
                    </ul>
                </>
              ) : null}
              {museName ? (
                <ul className="song-detail-secondary-meta song-detail-secondary-meta--muse" aria-label="Muse">
                  <li className="song-detail-secondary-meta-item">
                    <Link className="song-detail-secondary-link" to={searchCatalogHref(museName)}>
                      {museName}
                    </Link>
                  </li>
                </ul>
              ) : null}
            </div>
          </header>

          {lyricsExtract ? (
            <section className="sutra-detail__section sutra-detail__pull song-detail-extract" aria-label="Lyric extract">
              <blockquote className="sutra-detail__pull-quote">
                <span className="sutra-detail__pull-quote-text">{lyricsExtract}</span>
                <span className="sutra-detail__pull-quote-caret" aria-hidden />
              </blockquote>
            </section>
          ) : null}

          {(() => {
            const splitClassName =
              'song-detail-split' +
              (useLyricsMediaSplit ? ' song-detail-split--two-col' : '') +
              (hasListenTabNav ? ' song-detail-split--tabbed' : '') +
              (!hasLyrics && hasMediaColumnForSplit ? ' song-detail-split--media-only' : '') +
              (hasLyrics && !hasMediaColumnForSplit ? ' song-detail-split--lyrics-only' : '')

            const splitBody = (
              <div className={splitClassName}>
                {hasMediaColumnForSplit ? (
                  <div ref={mediaColumnRef} className="song-detail-split__media">
                    {hasListenTabNav ? (
                      <div className="song-detail-tabs" role="tablist" aria-label="Listen options">
                        <button
                          type="button"
                          role="tab"
                          id="song-tab-tracks"
                          aria-selected={audioListenTab === 'tracks'}
                          aria-controls="song-panel-tracks"
                          className={`song-detail-tab${audioListenTab === 'tracks' ? ' is-active' : ''}`}
                          onClick={() => setAudioListenTab('tracks')}
                        >
                          {tracksTabLabel}
                        </button>
                        <button
                          type="button"
                          role="tab"
                          id="song-tab-ep"
                          aria-selected={audioListenTab === 'ep'}
                          aria-controls="song-panel-ep"
                          className={`song-detail-tab${audioListenTab === 'ep' ? ' is-active' : ''}`}
                          onClick={() => setAudioListenTab('ep')}
                        >
                          Full EP
                        </button>
                      </div>
                    ) : null}

                    {showEpPanel ? (
                      <section
                        className="song-detail-listen-block"
                        aria-labelledby={hasListenTabNav ? 'song-tab-ep' : 'song-ep-heading'}
                        role={hasListenTabNav ? 'tabpanel' : undefined}
                        id={hasListenTabNav ? 'song-panel-ep' : undefined}
                      >
                        {!hasListenTabNav ? (
                          <h2 id="song-ep-heading" className="catalog-section-title">
                            Full EP
                          </h2>
                        ) : null}
                        <SoundCloudPassthroughEmbed
                          ref={epEmbedWrapRef}
                          scUrl={primaryEpUrl}
                          title={primaryEpTitle ? `SoundCloud: ${primaryEpTitle}` : `SoundCloud EP · ${detail.lyrics_title}`}
                          mode="list"
                          height={SC_EMBED_HEIGHT_SET_PLAYLIST}
                          loading={hasListenTabNav ? 'lazy' : 'eager'}
                        />
                        {primaryEpListenMeta || primaryEpTitle ? (
                          <div className="song-detail-listen-block__footer">
                            {primaryEpListenMeta ? (
                              <p className="song-detail-listen-block__meta song-detail-listen-block__meta--stats">
                                {primaryEpListenMeta}
                              </p>
                            ) : null}
                            {primaryEpTitle ? (
                              <p className="song-detail-listen-block__title">{primaryEpTitle}</p>
                            ) : null}
                          </div>
                        ) : null}
                      </section>
                    ) : null}

                    {showAudioSection && showTracksPanel ? (
                      <section
                        className="song-detail-media"
                        aria-label="Track playback"
                        role={hasListenTabNav ? 'tabpanel' : undefined}
                        id={hasListenTabNav ? 'song-panel-tracks' : undefined}
                        aria-labelledby={hasListenTabNav ? 'song-tab-tracks' : undefined}
                      >
                        <section className="song-detail-player" aria-label="SoundCloud player">
                {hasPlayableTrack ? (
                  <>
                    {defaultingToCatalogExport ? (
                      <p className="song-detail-ep-only-intro">
                        Here&apos;s the SoundCloud version for this song.
                      </p>
                    ) : null}
                    <div ref={playerWrapRef}>
                      <LazySoundCloudEmbed
                        scUrl={playingUrl}
                        title={`SoundCloud: ${detail.lyrics_title}`}
                        mode="list"
                        height={soundcloudMainEmbedHeight}
                        autoPlay={Boolean((selectedUrl ?? '').trim())}
                        reloadKey={soundcloudReloadKey}
                        onLoad={handlePlayerLoad}
                      />
                    </div>
                  </>
                ) : hasEpFallback && !showEpEmbed ? (
                  <>
                    <p className="song-detail-ep-only-intro">This one lives inside a full EP.</p>
                    <p className="song-detail-ep-only-footer">
                      <a className="song-detail-ep-link" href={primaryEpUrl} target="_blank" rel="noreferrer">
                        Open EP on SoundCloud
                      </a>
                    </p>
                  </>
                ) : hasAnyTrackUrls ? (
                  <p className="song-detail-no-audio">
                    SoundCloud tracks exist for this song, but none are currently set for in-app playback.
                  </p>
                ) : (
                  <p className="song-detail-no-audio">No SoundCloud URLs on file for this song yet.</p>
                )}
              </section>

              {shouldShowTracksList ? (
                <section className="song-detail-tracks" aria-labelledby="song-tracks-heading">
                  <h2 id="song-tracks-heading" className="catalog-section-title">
                    {inAppPlayableTracks.length > 1 ? 'Top tracks' : 'Track picks'}
                  </h2>
                  {inAppPlayableTracks.length > 1 ? (
                    <div
                      className="song-detail-audio-playall"
                      aria-label={playAllDesktopAvailable ? 'Play all top tracks' : undefined}
                    >
                      {playAllDesktopAvailable || playAllTopTracksActive ? (
                        <div className="song-detail-audio-playall-row">
                          {playAllTopTracksActive ? (
                            <>
                              {isScPlaying ? (
                                <button
                                  type="button"
                                  className="song-detail-audio-action-btn song-detail-audio-action-btn--primary"
                                  onClick={pausePlayAllTopTracks}
                                >
                                  Pause
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  className="song-detail-audio-action-btn song-detail-audio-action-btn--primary"
                                  onClick={resumePlayAllTopTracks}
                                >
                                  Resume
                                </button>
                              )}
                              <button
                                type="button"
                                className="song-detail-audio-action-btn song-detail-audio-action-btn--stop"
                                onClick={stopPlayAllTopTracks}
                              >
                                Stop playing all
                              </button>
                            </>
                          ) : playAllDesktopAvailable ? (
                            <button
                              type="button"
                              className="song-detail-audio-action-btn song-detail-audio-action-btn--primary"
                              onClick={startPlayAllTopTracks}
                            >
                              {`Play all ${inAppPlayableTracks.length} top track${inAppPlayableTracks.length === 1 ? '' : 's'}`}
                            </button>
                          ) : null}
                          {playAllDesktopAvailable || playAllTopTracksActive ? (
                            <>
                              <div className="song-detail-audio-controls" role="group" aria-label="Track queue navigation">
                                <button
                                  type="button"
                                  className="song-detail-audio-action-btn song-detail-audio-action-btn--queue"
                                  onClick={() => jumpInQueue(-1)}
                                  disabled={!canGoPrevious}
                                >
                                  Previous
                                </button>
                                <button
                                  type="button"
                                  className="song-detail-audio-action-btn song-detail-audio-action-btn--queue"
                                  onClick={() => jumpInQueue(1)}
                                  disabled={!canGoNext}
                                >
                                  Next
                                </button>
                              </div>
                              <span className="song-detail-audio-status" aria-live="polite">
                                {queueIndex >= 0
                                  ? `Track ${queueIndex + 1} of ${inAppPlayableTracks.length}`
                                  : `Track 0 of ${inAppPlayableTracks.length}`}
                              </span>
                            </>
                          ) : null}
                        </div>
                      ) : null}
                      {!playAllDesktopAvailable ? (
                        <p className="song-detail-audio-hint song-detail-audio-hint--honest">
                          {playAllHonestMobileCopy}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                  {activeTrackGenre ? (
                    <p className="song-detail-track-context">
                      Browsing genre: <strong>{activeTrackGenre}</strong>
                    </p>
                  ) : null}
                  <ul className="song-detail-track-list" id="song-top-tracks-list">
                    {displayedTopTracks.map((t) => {
                      const url = t.sc_url.trim()
                      const active = Boolean(url && playingUrl && url === playingUrl)
                      const hidden = !trackIsInApp(t)
                      return (
                        <li key={t.track_id} className="song-detail-track-row">
                          <button
                            type="button"
                            className={`song-detail-track${active ? ' is-active' : ''}${hidden ? ' is-hidden' : ''}`}
                            disabled={!url || hidden}
                          onClick={() => {
                            if (!url || hidden) return
                            pickTopTrack(url)
                          }}
                          >
                            <span className="song-detail-track-main">
                              <span className="song-detail-track-title">{t.track_title}</span>
                              {t.fav_track ? <span className="song-detail-fav">★ pick</span> : null}
                              {hidden ? <span className="song-detail-off">out of app</span> : null}
                            </span>
                            <span className="song-detail-track-meta">
                              <span>{formatDurationDisplay(t.duration_raw) || '—'}</span>
                              <span>{t.play_count.toLocaleString()} plays</span>
                              <span>{t.like_count.toLocaleString()} likes</span>
                            </span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                  {topTracksHasOverflow ? (
                    <button
                      type="button"
                      className="song-detail-panel-expand"
                      aria-expanded={topTracksExpanded}
                      aria-controls="song-top-tracks-list"
                      onClick={() => setTopTracksExpanded((v) => !v)}
                    >
                      <span className="song-detail-panel-expand__label">
                        {topTracksExpanded
                          ? 'Show less'
                          : `Show all ${orderedTracks.length} top tracks`}
                      </span>
                      <span
                        className={`song-detail-panel-expand__chevron${topTracksExpanded ? ' is-open' : ''}`}
                        aria-hidden
                      />
                    </button>
                  ) : null}
                </section>
              ) : null}
                      </section>
                    ) : null}

                    {showVideoSection ? (
                      <section
                        ref={videoSectionRef}
                        className="song-detail-media song-detail-media--video"
                        id="song-video-section"
                        aria-labelledby="song-video-heading"
                      >
                        <h2 id="song-video-heading" className="catalog-section-title">
                          {SONG_VIDEO_SECTION_TITLE}
                        </h2>
                        <section className="song-detail-youtube" aria-label="YouTube player">
                          {useSongVideoSpotlight && songVideoSpotlightFeatured && videoInView ? (
                            <CatalogVideoSpotlight
                              className="song-detail-youtube-spotlight catalog-video-spotlight--borderless catalog-video-spotlight--compact-rail"
                              featured={songVideoSpotlightFeatured}
                              rail={songVideoSpotlightRail}
                              activeVideoId={effectiveYoutubeVideoId}
                              onSelectVideo={selectYoutubeVideo}
                              railEyebrow="More for this song"
                              renderRailCell={renderSongVideoRailCell}
                              iframeRef={youtubeExclusiveRef}
                              onBeforePlay={onBeforeYoutubePlay}
                            />
                          ) : focusedYoutubeVideo?.can_embed && videoInView ? (
                            <YoutubeEmbeddedPlayer
                              videoId={focusedYoutubeVideo.video_id}
                              title={`YouTube: ${focusedYoutubeVideo.title || detail.lyrics_title}`}
                              iframeRef={youtubeExclusiveRef}
                              enableJsApi={songExclusivePlaybackEnabled}
                              loading="lazy"
                              facadeUntilClick
                              onBeforePlay={onBeforeYoutubePlay}
                            />
                          ) : focusedYoutubeVideo ? (
                            <div className="song-detail-youtube-no-embed" role="region" aria-label="Selected video not embeddable">
                              <p className="song-detail-youtube-no-embed-lead">
                                YouTube marks this upload as not embeddable on other sites—that&apos;s their rule, not a
                                bug on this site.
                              </p>
                              {focusedYoutubeVideo.yt_url ? (
                                <CatalogMediaOutbound href={focusedYoutubeVideo.yt_url} />
                              ) : null}
                            </div>
                          ) : (
                            <p className="song-detail-youtube-no-embed">
                              No embeddable public video is available for in-app playback.
                            </p>
                          )}
                        </section>
                      </section>
                    ) : null}
                  </div>
                ) : null}

                {hasLyrics ? (
                  <section
                    className={
                      'song-detail-split__lyrics-col song-detail-lyrics' +
                      (lyricsClampEnabled && !lyricsExpanded ? ' song-detail-lyrics-col--clamped' : '')
                    }
                    style={
                      lyricsClampEnabled && !lyricsExpanded && mediaColumnHeightPx != null
                        ? { maxHeight: mediaColumnHeightPx }
                        : undefined
                    }
                    aria-labelledby="song-lyrics-heading"
                  >
                    <h2 id="song-lyrics-heading" className="catalog-section-title">
                      Lyrics
                    </h2>
                    <div
                      className={
                        'song-detail-lyrics-frame' +
                        (lyricsClampEnabled && !lyricsExpanded ? ' song-detail-lyrics-frame--collapsed' : '') +
                        (lyricsClampEnabled && !lyricsExpanded && lyricsTall
                          ? ' song-detail-lyrics-frame--clipped'
                          : '')
                      }
                    >
                      <pre ref={lyricsPreRef} className="song-detail-lyrics-pre" id="song-lyrics-body">
                        {detail.lyrics_text}
                      </pre>
                      {lyricsClampEnabled && (lyricsTall || lyricsExpanded) ? (
                        <button
                          type="button"
                          className="song-detail-panel-expand"
                          aria-expanded={lyricsExpanded}
                          aria-controls="song-lyrics-body"
                          onClick={() => setLyricsExpanded((v) => !v)}
                        >
                          <span className="song-detail-panel-expand__label">
                            {lyricsExpanded ? 'Show less' : 'Show full lyrics'}
                          </span>
                          <span
                            className={`song-detail-panel-expand__chevron${lyricsExpanded ? ' is-open' : ''}`}
                            aria-hidden
                          />
                        </button>
                      ) : null}
                    </div>
                  </section>
                ) : null}
              </div>
            )

            return useLyricsMediaSplit ? <div className="song-detail-breakout">{splitBody}</div> : splitBody
          })()}

          {showVideoBelow ? (
            <section
              ref={videoSectionRef}
              className={
                'song-detail-media song-detail-media--video song-detail-video-below song-detail-shell-section' +
                (useLyricsMediaSplit ? ' song-detail-shell-section--breakout' : '')
              }
              id="song-video-section"
              aria-labelledby="song-video-below-heading"
            >
              <h2 id="song-video-below-heading" className="catalog-section-title">
                {SONG_VIDEO_SECTION_TITLE}
              </h2>
              <section className="song-detail-youtube" aria-label="YouTube player">
                {useSongVideoSpotlight && songVideoSpotlightFeatured && videoInView ? (
                  <CatalogVideoSpotlight
                    className="song-detail-youtube-spotlight catalog-video-spotlight--borderless catalog-video-spotlight--compact-rail"
                    featured={songVideoSpotlightFeatured}
                    rail={songVideoSpotlightRail}
                    activeVideoId={effectiveYoutubeVideoId}
                    onSelectVideo={selectYoutubeVideo}
                    railEyebrow="More for this song"
                    renderRailCell={renderSongVideoRailCell}
                    iframeRef={youtubeExclusiveRef}
                    onBeforePlay={onBeforeYoutubePlay}
                  />
                ) : focusedYoutubeVideo?.can_embed && videoInView ? (
                  <YoutubeEmbeddedPlayer
                    videoId={focusedYoutubeVideo.video_id}
                    title={`YouTube: ${focusedYoutubeVideo.title || detail.lyrics_title}`}
                    iframeRef={youtubeExclusiveRef}
                    enableJsApi={songExclusivePlaybackEnabled}
                    loading="lazy"
                    facadeUntilClick
                    onBeforePlay={onBeforeYoutubePlay}
                  />
                ) : focusedYoutubeVideo ? (
                  <div className="song-detail-youtube-no-embed" role="region" aria-label="Selected video not embeddable">
                    <p className="song-detail-youtube-no-embed-lead">
                      YouTube marks this upload as not embeddable on other sites—that&apos;s their rule, not a bug on
                      this site.
                    </p>
                    {focusedYoutubeVideo.yt_url ? (
                      <CatalogMediaOutbound href={focusedYoutubeVideo.yt_url} />
                    ) : null}
                  </div>
                ) : (
                  <p className="song-detail-youtube-no-embed">
                    No embeddable public video is available for in-app playback.
                  </p>
                )}
              </section>
            </section>
          ) : null}

          {songbookRecord && detail.songbook ? (
            <section className="song-detail-shell-section">
              <SongDetailAlsoPartOfCard
                book={songbookRecord}
                lyricsId={detail.lyrics_id}
                isLyricsOnly={!hasAudioContent && !hasYoutubeVideos}
              />
            </section>
          ) : null}

          {orderedRelatedSongs.length ? (
            <section
              className="song-detail-shell-section song-detail-related"
              aria-labelledby="song-related-heading"
            >
                <h2 id="song-related-heading" className="catalog-section-title">
                  Explore sister songs
                </h2>
                <ul className="song-thumb-grid song-thumb-grid--section song-detail-sister-grid">
                  {orderedRelatedSongs.slice(0, 8).map((related) => {
                    const sutra = songCatalogByLyricsId.get(related.lyrics_id)?.sutra?.trim() ?? ''
                    return (
                      <li key={related.lyrics_id} className="song-thumb-grid__cell">
                        <SongThumbCard
                          to={songCatalogLinkTo(related.lyrics_title, related.url_slug)}
                          coverUrl={related.cover_image_url}
                          title={related.lyrics_title}
                          metaLabel={sutra || undefined}
                        />
                      </li>
                    )
                  })}
                </ul>
            </section>
          ) : null}

          <SongDetailBertrandEntry sutra={detail.sutra} />
        </main>
      </div>

      <GlobalFooter />
    </div>
  )
}
