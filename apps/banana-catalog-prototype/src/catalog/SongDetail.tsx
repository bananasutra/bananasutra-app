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
import { SongDetailPlayAllHonestHint } from './SongDetailPlayAllHonestHint'
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
  SONG_DETAIL_TWO_COL_MEDIA_QUERY,
  usePlayAllDesktopAvailable,
} from './playAllPlatform'
import { persistentBarOwnsQueueChrome } from './playerQueue/pageQueueChrome'
import { formatDurationDisplay } from './durationFormat'
import { useTypewriterText } from './useTypewriterText'
import {
  queueSessionActive,
  queueSessionOwnsPage,
  selectedTrackId,
  songDetailTrackToPlayable,
  usePlayerQueue,
  usePlayerQueueInternals,
  usePlayerQueuePageBridge,
  useSongDetailTopTracksQueue,
} from './playerQueue'
import { usePlayerQueueRegistrar } from './playerQueue/playerQueueRegistrarContext'
import {
  catalogPathSlugFromTitleAndSlug,
  lyricsIdFromSongUrlSlug,
  browseRowHasAudioSection,
  songCatalogLinkTo,
  songCatalogPath,
} from './songPaths'
import { songbookByName, songbookHref } from './songbooks'
import { splitMuseList } from './museFiltersCore'
import { sutraClassName } from './sutraTheme'
import type { SongCatalogItem, SongDetailNavState, SongDetailRecord, SongDetailTrack, SongEpVolume, YouTubeCatalogVideo } from './types'
import { sutraHrefFromSongSutraField } from './sutraPageUtils'
import { buildBrowsePathForFacet, CATALOG_BROWSE_PATH } from './urlState'
import { buildSrcset, coverImageUrl } from '../seo/imageUrl'
import { songRecordingJsonLd } from '../seo/jsonLd'
import { PageMeta } from './PageMeta'
import { CatalogNotFoundPage } from './CatalogNotFoundPage'
import { songOgImageUrl } from './pageMetaConstants'
import { useSyncCatalogHeaderHeight } from './useSyncCatalogHeaderHeight'
import { ScrollRail } from './ScrollRail'
import { SongThumbCard } from './SongThumbCard'
import { ShareButton } from './ShareButton'
import { songShareUrl, trackShareUrl } from './shareUrl'
import { useSongCatalogAndDetail, loadYoutubeByLyricsId } from './generatedData'
import './CatalogApp.css'
import './CatalogVideoSpotlight.css'
import './ListenLpPage.css'
import './SutrasPages.css'
import './SongDetail.css'

const SONG_DETAIL_SISTER_SONGS_LIMIT = 6

type AudioListenTab = 'tracks' | `ep:${number}`

function epListenTabId(volume: number): AudioListenTab {
  return `ep:${volume}`
}

function parseEpListenTab(tab: string): number | null {
  if (!tab.startsWith('ep:')) return null
  const n = Number(tab.slice(3))
  return Number.isFinite(n) ? n : null
}

function epVolumeTabLabel(volume: number, listenUrl: string): string {
  if (listenUrl.includes('/sets/')) {
    return volume > 0 ? `EP · vol ${volume}` : 'EP'
  }
  return volume > 0 ? `Single · vol ${volume}` : 'Single'
}

function EpVolumeTabLabel({ volume, listenUrl }: { volume: number; listenUrl: string }) {
  const isSet = listenUrl.includes('/sets/')
  if (isSet) {
    if (volume <= 0) {
      return (
        <>
          <span className="song-detail-tab__label song-detail-tab__label--full">EP</span>
          <span className="song-detail-tab__label song-detail-tab__label--short">EP</span>
        </>
      )
    }
    return (
      <>
        <span className="song-detail-tab__label song-detail-tab__label--full">
          EP · vol {volume}
        </span>
        <span className="song-detail-tab__label song-detail-tab__label--short">EP {volume}</span>
      </>
    )
  }
  if (volume <= 0) {
    return (
      <>
        <span className="song-detail-tab__label song-detail-tab__label--full">Single</span>
        <span className="song-detail-tab__label song-detail-tab__label--short">Single</span>
      </>
    )
  }
  return (
    <>
      <span className="song-detail-tab__label song-detail-tab__label--full">
        Single · vol {volume}
      </span>
      <span className="song-detail-tab__label song-detail-tab__label--short">Single {volume}</span>
    </>
  )
}

function ListenTracksTabLabel({
  tracksTabLabel,
  compactTracksLabel,
}: {
  tracksTabLabel: string
  compactTracksLabel: string
}) {
  return (
    <>
      <span className="song-detail-tab__label song-detail-tab__label--full">{tracksTabLabel}</span>
      <span className="song-detail-tab__label song-detail-tab__label--short">{compactTracksLabel}</span>
    </>
  )
}

function isEpListenTab(tab: string): tab is `ep:${number}` {
  return parseEpListenTab(tab) != null
}

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

/** W-055 wireframe §6: cap top-tracks list before expand (balance vs. lyrics column). */
const SONG_DETAIL_TOP_TRACKS_COLLAPSED_COUNT = 3

function useSongDetailLyricsClampViewport(): boolean {
  const subscribe = useCallback((onStoreChange: () => void) => {
    const mq = window.matchMedia(SONG_DETAIL_TWO_COL_MEDIA_QUERY)
    mq.addEventListener('change', onStoreChange)
    return () => mq.removeEventListener('change', onStoreChange)
  }, [])
  const getSnapshot = useCallback(
    () => window.matchMedia(SONG_DETAIL_TWO_COL_MEDIA_QUERY).matches,
    [],
  )
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
    return <CatalogNotFoundPage />
  }
  const lyricsId = lyricsIdFromSongUrlSlug(trimmed)
  if (!lyricsId) {
    return <CatalogNotFoundPage />
  }
  return <SongDetailInner key={lyricsId} lyricsId={lyricsId} urlSlug={trimmed} />
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
    return <CatalogNotFoundPage />
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
  const requestedTrackId = (searchParams.get('t') ?? '').trim()

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
      thumbnailUrl: (focusedYoutubeVideo.thumbnail_url || '').trim() || undefined,
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
        thumbnailUrl: (v.thumbnail_url || '').trim() || undefined,
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

  const printLyricsOnly = useCallback(() => {
    setLyricsExpanded(true)
    const root = document.documentElement
    root.classList.add('print-lyrics-only')
    let cleaned = false
    const cleanup = () => {
      if (cleaned) return
      cleaned = true
      root.classList.remove('print-lyrics-only')
      window.removeEventListener('afterprint', cleanup)
    }
    window.addEventListener('afterprint', cleanup)
    window.setTimeout(cleanup, 60_000)
    // Expand + class need a paint before the print dialog snapshots the page.
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        window.print()
      })
    })
  }, [])

  useEffect(() => {
    const expandForPrint = () => setLyricsExpanded(true)
    window.addEventListener('beforeprint', expandForPrint)
    return () => window.removeEventListener('beforeprint', expandForPrint)
  }, [])

  const songbookRecord = useMemo(
    () => (detail.songbook ? songbookByName(detail.songbook) : undefined),
    [detail.songbook],
  )

  const fallbackScUrl = (detail.fallback_sc_url ?? '').trim()
  const catalogListenUrl = (detail.sc_catalog_listen_url ?? '').trim()
  const primaryEpUrl = (detail.primary_ep_url ?? '').trim()
  const primaryEpTitle = (detail.primary_ep_title ?? '').trim()
  const songbookPlaylistUrl = (songbookRecord?.playlist_url ?? '').trim()
  const songbookUrlNorm = normSoundcloudUrl(songbookPlaylistUrl)

  const catalogEpVolumes = useMemo((): SongEpVolume[] => {
    const fromData = (detail.ep_volumes ?? []).filter((v) => {
      const url = v.ep_url.trim()
      if (!url) return false
      const norm = normSoundcloudUrl(url)
      return Boolean(norm && norm !== songbookUrlNorm)
    })
    if (fromData.length > 0) return fromData
    const epUrlNorm = normSoundcloudUrl(primaryEpUrl)
    if (primaryEpUrl.trim() && epUrlNorm && epUrlNorm !== songbookUrlNorm) {
      return [
        {
          ep_volume: detail.primary_ep_volume ?? 0,
          ep_url: primaryEpUrl,
          ep_title: primaryEpTitle,
          ep_rating: detail.primary_ep_rating ?? '',
        },
      ]
    }
    return []
  }, [
    detail.ep_volumes,
    detail.primary_ep_rating,
    detail.primary_ep_volume,
    primaryEpTitle,
    primaryEpUrl,
    songbookUrlNorm,
  ])

  const inAppPlayableTracks = useMemo(
    () => orderedTracks.filter((t) => trackIsInApp(t) && t.sc_url.trim()),
    [orderedTracks],
  )

  /** One listen path only: single track row, catalog-export URL, or both pointing at the same lone SC link. */
  const isLoneSingleSong =
    catalogEpVolumes.length === 0 &&
    orderedTracks.length <= 1 &&
    inAppPlayableTracks.length <= 1

  const listenEpVolumes = useMemo((): SongEpVolume[] => {
    if (catalogEpVolumes.length > 0) return catalogEpVolumes
    if (!isLoneSingleSong) return []
    const loneUrl = (inAppPlayableTracks[0]?.sc_url || catalogListenUrl || '').trim()
    if (!loneUrl) return []
    const loneTitle =
      (detail.sc_catalog_track_title || '').trim() ||
      (inAppPlayableTracks[0]?.track_title || '').trim() ||
      detail.lyrics_title
    return [{ ep_volume: 0, ep_url: loneUrl, ep_title: loneTitle, ep_rating: '' }]
  }, [
    catalogEpVolumes,
    catalogListenUrl,
    detail.lyrics_title,
    detail.sc_catalog_track_title,
    inAppPlayableTracks,
    isLoneSingleSong,
  ])

  const primaryListenEpVolume = listenEpVolumes[listenEpVolumes.length - 1] ?? null
  const primaryListenEpTab = primaryListenEpVolume
    ? epListenTabId(primaryListenEpVolume.ep_volume)
    : ('tracks' as const)

  const [audioListenTab, setAudioListenTab] = useState<AudioListenTab>('tracks')

  const activeListenEpVolume = useMemo(() => {
    const vol = parseEpListenTab(audioListenTab)
    if (vol != null) {
      const hit = listenEpVolumes.find((e) => e.ep_volume === vol)
      if (hit) return hit
    }
    return primaryListenEpVolume
  }, [audioListenTab, listenEpVolumes, primaryListenEpVolume])

  const activeEpUrl = (activeListenEpVolume?.ep_url ?? '').trim()
  const activeEpTitle = (activeListenEpVolume?.ep_title ?? '').trim()
  const activeEpUrlNorm = normSoundcloudUrl(activeEpUrl)
  const showEpEmbed = listenEpVolumes.length > 0

  const activeEpListenMeta = useMemo(() => {
    if (!showEpEmbed || !activeListenEpVolume) return ''
    const epTrack = detail.tracks.find((t) => normSoundcloudUrl(t.ep_url) === activeEpUrlNorm)
    const trackCount = epTrack?.ep_total_tracks ?? 0
    const duration =
      detail.sc_ep_set_duration_totals?.[activeEpUrl] ??
      detail.sc_ep_set_duration_totals?.[activeEpUrlNorm] ??
      ''
    return formatEpListenMeta(trackCount, duration)
  }, [activeEpUrl, activeEpUrlNorm, activeListenEpVolume, detail, showEpEmbed])

  const lyricsExtract = useMemo(() => (detail.lyrics_extract || '').trim(), [detail.lyrics_extract])
  const typedLyricsExtract = useTypewriterText(lyricsExtract)

  const playingUrl = (
    selectedUrl?.trim() ||
    defaultTrack?.sc_url?.trim() ||
    fallbackScUrl ||
    catalogListenUrl ||
    ''
  ).trim()
  const playAllDesktopAvailable = usePlayAllDesktopAvailable()
  /** Multi-track Play All uses the persistent bar; single-track / catalog-export keeps inline SC beside lyrics. */
  const showInlineScEmbed = !playAllDesktopAvailable || inAppPlayableTracks.length <= 1
  const { persistentScEmbedWrapRef, usePersistentPlayback } = usePlayerQueueRegistrar()

  const [topTracksExpanded, setTopTracksExpanded] = useState(false)
  const playerWrapRef = useRef<HTMLDivElement | null>(null)
  const inAppPlayableTracksRef = useRef<SongDetailTrack[]>(inAppPlayableTracks)
  const playingUrlRef = useRef<string>(playingUrl)

  useEffect(() => {
    inAppPlayableTracksRef.current = inAppPlayableTracks
  }, [inAppPlayableTracks])

  useEffect(() => {
    playingUrlRef.current = playingUrl
  }, [playingUrl])

  const soundcloudMainEmbedHeight =
    playingUrl.includes('/sets/') ? SC_EMBED_HEIGHT_SET_PLAYLIST : SC_EMBED_HEIGHT_TRACK_LIST

  const requestSoundcloudPlayback = useCallback((url: string, opts?: { fromPlayAllStart?: boolean }) => {
    const trimmed = url.trim()
    const sameUrl = trimmed === playingUrlRef.current.trim()
    if (opts?.fromPlayAllStart && sameUrl) return
    setSelectedUrl(url)
    setSoundcloudReloadKey((k) => k + 1)
  }, [])

  const syncPlayingUrl = useCallback((url: string) => {
    const trimmed = url.trim()
    if (!trimmed) return
    playingUrlRef.current = trimmed
    setSelectedUrl(trimmed)
  }, [])

  const { registration, startPlayAllFromPage } = useSongDetailTopTracksQueue({
    inAppPlayableTracksRef,
    playingUrlRef,
    lyricsId: detail.lyrics_id,
    songTitle: detail.lyrics_title,
    songSlug: detail.url_slug,
    lyricsExtract,
    requestSoundcloudPlayback,
    syncPlayingUrl,
    songUrlSlug: detail.url_slug,
  })
  const { bindWidgetOnLoad } = usePlayerQueueInternals()
  usePlayerQueuePageBridge('song-detail-top-tracks', registration, {
    startPlayAllFromPage,
    bindWidgetOnLoad,
  })
  const { state: queueState, actions: queueActions } = usePlayerQueue()
  const playAllTopTracksActive = queueState.playAllActive
  const isScPlaying = queueState.playing
  const persistentBarOwnsQueue = persistentBarOwnsQueueChrome(playAllDesktopAvailable, playAllTopTracksActive)
  const playingTrackId = selectedTrackId(queueState)
  const sessionActive = queueSessionActive(queueState)
  const queueOwnsPage = queueSessionOwnsPage(queueState, 'song_detail')
  const foreignSessionActive =
    sessionActive && !queueOwnsPage && queueState.source?.type !== 'single'
  const foreignPlaybackNote = 'Playing in mini player below. Use the bar for controls.'

  const queueIndex =
    queueOwnsPage && playAllTopTracksActive
      ? queueState.position
      : inAppPlayableTracks.findIndex((t) => t.sc_url.trim() === playingUrl.trim())
  const canGoPrevious =
    queueOwnsPage && playAllTopTracksActive ? queueState.position > 0 : queueIndex > 0
  const canGoNext =
    queueOwnsPage && playAllTopTracksActive
      ? queueState.position >= 0 && queueState.position < queueState.tracks.length - 1
      : queueIndex >= 0 && queueIndex < inAppPlayableTracks.length - 1
  const queueStatusTotal =
    queueOwnsPage && playAllTopTracksActive && queueState.tracks.length > 0
      ? queueState.tracks.length
      : inAppPlayableTracks.length

  const pickTopTrack = useCallback(
    (url: string, options?: { keepPlayAll?: boolean }) => {
      const trimmed = url.trim()
      const track = inAppPlayableTracksRef.current.find((t) => t.sc_url.trim() === trimmed)
      if (!track) return
      queueActions.pickTrack(songDetailTrackToPlayable(track, lyricsExtract, detail.url_slug), options)
    },
    [detail.url_slug, lyricsExtract, queueActions],
  )

  const handlePlayerLoad = useCallback(() => {
    bindWidgetOnLoad(playerWrapRef.current)
  }, [bindWidgetOnLoad])

  const writtenYear = (detail.written_year ?? '').trim()
  const songPageShareUrl = songShareUrl(detail.lyrics_title, detail.url_slug)
  const museNames = splitMuseList(detail.muse ?? '')
  const hasMuseMeta = museNames.length > 0
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
  const shouldShowTracksList =
    !isLoneSingleSong &&
    (inAppPlayableTracks.length >= 2 ||
      orderedTracks.length > 1 ||
      Boolean(activeTrackGenre) ||
      (inAppPlayableTracks.length === 1 && catalogEpVolumes.length > 0))
  const showTrackListInPanel = shouldShowTracksList && inAppPlayableTracks.length > 1
  const hasScCatalogListen = Boolean(catalogListenUrl)
  const defaultingToCatalogExport =
    hasScCatalogListen && !defaultTrack && !fallbackScUrl && !(selectedUrl?.trim())
  /** Multi-track list or catalog-export listen — not “video replaces listen slot” UX (D-013). */
  const hasTopTracksListenUi = shouldShowTracksList
  const hasInlineListenEmbed = showEpEmbed || hasScCatalogListen || (hasPlayableTrack && !shouldShowTracksList)
  const hasAudioContent =
    hasPlayableTrack || hasEpFallback || hasAnyTrackUrls || shouldShowTracksList || hasScCatalogListen
  const showVideoInColumn = hasYoutubeVideos && !hasTopTracksListenUi && !hasInlineListenEmbed
  /** Below the listen block whenever column video is suppressed (EP tab, top tracks, or catalog listen). */
  const showVideoBelow = hasYoutubeVideos && !showVideoInColumn
  const showAudioSection = hasAudioContent
  const showVideoSection = showVideoInColumn
  const hasMediaColumnForSplit = showAudioSection || showVideoInColumn
  /** No hero art / fallback column: lyrics-first rows with no listener media (e.g. pipeline-only songs). */
  const isLyricsOnlyNoCoverHero =
    !(detail.cover_image_url || '').trim() && !hasAudioContent && !hasYoutubeVideos
  const useLyricsMediaSplit = hasLyrics && hasMediaColumnForSplit
  /** Top tracks / catalog listen vs EP vol tabs when video or multi-volume listen competes. */
  const hasListenTabNav =
    useLyricsMediaSplit && (hasTopTracksListenUi || listenEpVolumes.length > 0)
  const showEpPanel = Boolean(
    listenEpVolumes.length > 0 && (!hasListenTabNav || isEpListenTab(audioListenTab)),
  )
  const showTracksPanel =
    hasTopTracksListenUi && (!hasListenTabNav || audioListenTab === 'tracks')
  const hasActiveMediaPanel = showEpPanel || (showTracksPanel && showAudioSection) || showVideoSection
  const tracksTabLabel = inAppPlayableTracks.length === 1 ? 'Top track' : 'Top tracks'
  const compactTracksTabLabel = tracksTabLabel
  const topTracksHasOverflow = orderedTracks.length > SONG_DETAIL_TOP_TRACKS_COLLAPSED_COUNT
  const topTracksListExpanded = topTracksExpanded || !topTracksHasOverflow
  const displayedTopTracks = topTracksListExpanded
    ? orderedTracks
    : orderedTracks.slice(0, SONG_DETAIL_TOP_TRACKS_COLLAPSED_COUNT)
  const playAllHonestHintVariant =
    showEpEmbed && hasListenTabNav
      ? ('full-ep-tab' as const)
      : showEpEmbed
        ? ('full-ep-only' as const)
        : songbookPlaylistUrl
          ? ('songbook' as const)
          : ('generic' as const)

  useEffect(() => {
    if (!hasListenTabNav || hasTopTracksListenUi || listenEpVolumes.length === 0) return
    setAudioListenTab(primaryListenEpTab)
  }, [hasListenTabNav, hasTopTracksListenUi, listenEpVolumes.length, primaryListenEpTab, lyricsId])

  const switchToFullEpTab = useCallback(() => {
    setAudioListenTab(primaryListenEpTab)
    window.requestAnimationFrame(() => {
      document.getElementById(`song-tab-${primaryListenEpTab}`)?.focus()
    })
  }, [primaryListenEpTab])

  const songExclusivePlaybackEnabled = Boolean(showEpPanel || hasPlayableTrack || hasYoutubeVideos)
  const embeddableYoutubeCount = useMemo(
    () => youtubeVideos.filter((v) => v.can_embed).length,
    [youtubeVideos],
  )
  const songYtYtExclusivityEnabled = embeddableYoutubeCount >= 2

  useExclusiveYoutubeSoundcloudPlayback({
    youtubeIframeRef: youtubeExclusiveRef,
    soundcloudWrapRefs: [epEmbedWrapRef, playerWrapRef],
    persistentScWrapRef: usePersistentPlayback ? persistentScEmbedWrapRef : undefined,
    enabled: songExclusivePlaybackEnabled,
    controlsRef: exclusivePlaybackRef,
    syncKey: `${lyricsId}|ep:${activeEpUrl}|tr:${playingUrl}|tab:${audioListenTab}|yt:${effectiveYoutubeVideoId}`,
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
  const lyricsClampEnabled = useLyricsMediaSplit && isSongDetailTwoColDesktop && hasActiveMediaPanel

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
      if (!requestedTrackId) {
        setTopTracksExpanded(false)
      }
      const defaultListenTab: AudioListenTab =
        requestedSection === 'audio' || requestedTrackId
          ? hasTopTracksListenUi
            ? 'tracks'
            : showEpEmbed
              ? primaryListenEpTab
              : 'tracks'
          : showEpEmbed && !hasTopTracksListenUi && !hasYoutubeVideos
            ? primaryListenEpTab
            : 'tracks'
      setAudioListenTab(defaultListenTab)
    })
  }, [
    detail.lyrics_id,
    hasTopTracksListenUi,
    hasYoutubeVideos,
    requestedSection,
    requestedTrackId,
    showEpEmbed,
    primaryListenEpTab,
  ])

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

  // Deep-link: ?t=:track_id → select + play that track on the audio tab.
  useEffect(() => {
    if (!requestedTrackId) return
    if (inAppPlayableTracks.length === 0) return

    const target =
      inAppPlayableTracks.find((t) => t.track_id === requestedTrackId) ??
      orderedTracks.find((t) => t.track_id === requestedTrackId && trackIsInApp(t))
    if (!target?.sc_url.trim()) return

    if (requestedSection === 'audio' || requestedTrackId) {
      setAudioListenTab('tracks')
    }

    const idx = orderedTracks.findIndex((t) => t.track_id === requestedTrackId)
    if (topTracksHasOverflow && idx >= SONG_DETAIL_TOP_TRACKS_COLLAPSED_COUNT) {
      setTopTracksExpanded(true)
    }

    const url = target.sc_url.trim()
    // pickTopTrack before syncPlayingUrl so queue key differs from default (avoids toggle branch).
    pickTopTrack(url)
    syncPlayingUrl(url)
  }, [
    inAppPlayableTracks,
    orderedTracks,
    pickTopTrack,
    requestedSection,
    requestedTrackId,
    syncPlayingUrl,
    topTracksHasOverflow,
  ])

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
              <div className="song-detail-hero-actions" role="group" aria-label="Song actions">
                <ShareButton
                  variant="icon"
                  className="song-detail-hero-action"
                  url={songPageShareUrl}
                  title={detail.lyrics_title}
                  text={`Listen to "${detail.lyrics_title}" on Bananasutra`}
                />
                {hasLyrics ? (
                  <button
                    type="button"
                    className="song-detail-print-lyrics song-detail-hero-action"
                    onClick={printLyricsOnly}
                    title="Print lyrics"
                    aria-label="Print lyrics"
                  >
                    <svg
                      className="song-detail-print-lyrics__icon"
                      width="15"
                      height="15"
                      viewBox="0 0 16 16"
                      fill="none"
                      aria-hidden="true"
                      focusable="false"
                    >
                      <path
                        d="M4 6V2.5h8V6M4 11.5H3A1.5 1.5 0 0 1 1.5 10V7A1.5 1.5 0 0 1 3 5.5h10A1.5 1.5 0 0 1 14.5 7v3A1.5 1.5 0 0 1 13 11.5h-1"
                        stroke="currentColor"
                        strokeWidth="1.4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M4 9.5h8V14H4V9.5Z"
                        stroke="currentColor"
                        strokeWidth="1.4"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                ) : null}
              </div>
              {detail.lyrics_summary ? <p className="song-detail-summary">{detail.lyrics_summary}</p> : null}
              {detail.sutra || hasHeroFacetMeta || hasMuseMeta || detail.songbook ? (
                <div className="song-detail-hero-meta">
                  {detail.sutra || detail.songbook ? (
                    <ul
                      className="song-detail-secondary-meta song-detail-secondary-meta--identity"
                      aria-label="Sutra and songbook"
                    >
                      {detail.sutra ? (
                        <li className="song-detail-secondary-meta-item">
                          <Link
                            className="song-detail-secondary-link"
                            to={sutraHrefFromSongSutraField(detail.sutra) ?? buildBrowsePathForFacet('sutra', detail.sutra)}
                          >
                            <span className={`catalog-facet-sutra-name ${sutraClassName(detail.sutra)}`}>{detail.sutra}</span>
                          </Link>
                        </li>
                      ) : null}
                      {detail.songbook ? (
                        <li className="song-detail-secondary-meta-item">
                          <Link className="song-detail-secondary-link" to={songbookHref(detail.songbook)}>
                            {detail.songbook}
                          </Link>
                        </li>
                      ) : null}
                    </ul>
                  ) : null}
                  {hasHeroFacetMeta ? (
                    <ul
                      className="song-detail-secondary-meta song-detail-secondary-meta--facets"
                      aria-label="Song facets"
                    >
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
                          <Link
                            className="song-detail-secondary-link"
                            to={buildBrowsePathForFacet('light_shadow', detail.light_shadow)}
                          >
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
                  ) : null}
                  {hasMuseMeta ? (
                    <ul
                      className="song-detail-secondary-meta song-detail-secondary-meta--muses"
                      aria-label="Muses"
                    >
                      {museNames.map((muse, index) => (
                        <li key={muse} className="song-detail-secondary-meta-item">
                          {index === 0 ? (
                            <span className="song-detail-muse-label" aria-hidden="true">
                              Muse:
                            </span>
                          ) : null}
                          <Link className="song-detail-secondary-link" to={searchCatalogHref(muse)}>
                            {muse}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : null}
            </div>
          </header>

          {lyricsExtract ? (
            <section className="sutra-detail__section sutra-detail__pull song-detail-extract" aria-label="Lyric extract">
              <blockquote className="sutra-detail__pull-quote">
                <span className="sutra-detail__pull-quote-text">{typedLyricsExtract}</span>
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
                        {hasTopTracksListenUi ? (
                          <button
                            type="button"
                            role="tab"
                            id="song-tab-tracks"
                            aria-selected={audioListenTab === 'tracks'}
                            aria-controls="song-panel-tracks"
                            className={`song-detail-tab${audioListenTab === 'tracks' ? ' is-active' : ''}`}
                            onClick={() => setAudioListenTab('tracks')}
                          >
                            <ListenTracksTabLabel
                              tracksTabLabel={tracksTabLabel}
                              compactTracksLabel={compactTracksTabLabel}
                            />
                          </button>
                        ) : null}
                        {listenEpVolumes.map((epVolume) => {
                          const tabId = epListenTabId(epVolume.ep_volume)
                          const tabDomId = `song-tab-${tabId}`
                          return (
                            <button
                              key={tabId}
                              type="button"
                              role="tab"
                              id={tabDomId}
                              aria-selected={audioListenTab === tabId}
                              aria-controls={`song-panel-${tabId}`}
                              className={`song-detail-tab${audioListenTab === tabId ? ' is-active' : ''}`}
                              onClick={() => setAudioListenTab(tabId)}
                            >
                              <EpVolumeTabLabel volume={epVolume.ep_volume} listenUrl={epVolume.ep_url} />
                            </button>
                          )
                        })}
                      </div>
                    ) : null}

                    {showEpPanel ? (
                      <section
                        className="song-detail-listen-block"
                        aria-labelledby={
                          hasListenTabNav && activeListenEpVolume
                            ? `song-tab-${epListenTabId(activeListenEpVolume.ep_volume)}`
                            : 'song-ep-heading'
                        }
                        role={hasListenTabNav ? 'tabpanel' : undefined}
                        id={
                          hasListenTabNav && activeListenEpVolume
                            ? `song-panel-${epListenTabId(activeListenEpVolume.ep_volume)}`
                            : undefined
                        }
                      >
                        {!hasListenTabNav ? (
                          <h2 id="song-ep-heading" className="catalog-section-title">
                            {activeListenEpVolume
                              ? epVolumeTabLabel(
                                  activeListenEpVolume.ep_volume,
                                  activeListenEpVolume.ep_url,
                                )
                              : 'Listen'}
                          </h2>
                        ) : null}
                        <SoundCloudPassthroughEmbed
                          ref={epEmbedWrapRef}
                          scUrl={activeEpUrl}
                          title={
                            activeEpTitle
                              ? `SoundCloud: ${activeEpTitle}`
                              : `SoundCloud EP · ${detail.lyrics_title}`
                          }
                          mode="list"
                          height={
                            activeEpUrl.includes('/sets/')
                              ? SC_EMBED_HEIGHT_SET_PLAYLIST
                              : SC_EMBED_HEIGHT_TRACK_LIST
                          }
                          loading={showEpPanel ? 'eager' : 'lazy'}
                        />
                        {activeEpListenMeta || activeEpTitle ? (
                          <div className="song-detail-listen-block__footer">
                            {activeEpListenMeta ? (
                              <p className="song-detail-listen-block__meta song-detail-listen-block__meta--stats">
                                {activeEpListenMeta}
                              </p>
                            ) : null}
                            {activeEpTitle ? (
                              <p className="song-detail-listen-block__title">{activeEpTitle}</p>
                            ) : null}
                          </div>
                        ) : null}
                      </section>
                    ) : null}

                    {showAudioSection && showTracksPanel && !showVideoInColumn ? (
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
                    {showInlineScEmbed ? (
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
                    ) : null}
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

              {showTrackListInPanel ? (
                <section
                  className={`song-detail-tracks${hasListenTabNav ? ' song-detail-tracks--tabbed' : ''}`}
                  aria-labelledby={hasListenTabNav ? 'song-tab-tracks' : 'song-tracks-heading'}
                >
                  {hasListenTabNav ? null : (
                    <h2 id="song-tracks-heading" className="catalog-section-title">
                      {inAppPlayableTracks.length === 1 ? 'Top track' : 'Top tracks'}
                    </h2>
                  )}
                  {inAppPlayableTracks.length > 1 ? (
                    <div
                      className="song-detail-audio-playall"
                      aria-label={playAllDesktopAvailable && !foreignSessionActive ? 'Play all top tracks' : undefined}
                    >
                      {foreignSessionActive ? (
                        <>
                          <p className="song-detail-audio-hint song-detail-audio-hint--foreign">
                            {foreignPlaybackNote}
                          </p>
                          {playAllDesktopAvailable && !playAllTopTracksActive ? (
                            <div className="song-detail-audio-playall-row">
                              <button
                                type="button"
                                className="song-detail-audio-action-btn song-detail-audio-action-btn--primary"
                                onClick={startPlayAllFromPage}
                              >
                                <span className="song-detail-audio-action-btn__glyph" aria-hidden>
                                  ▶
                                </span>
                                {`Play all ${inAppPlayableTracks.length} top track${inAppPlayableTracks.length === 1 ? '' : 's'}`}
                              </button>
                            </div>
                          ) : null}
                        </>
                      ) : playAllDesktopAvailable || playAllTopTracksActive ? (
                        <div className="song-detail-audio-playall-row">
                          {playAllTopTracksActive ? (
                            persistentBarOwnsQueue ? null : (
                              <>
                                {isScPlaying ? (
                                  <button
                                    type="button"
                                    className="song-detail-audio-action-btn song-detail-audio-action-btn--primary"
                                    onClick={() => queueActions.pause()}
                                  >
                                    <span className="song-detail-audio-action-btn__glyph" aria-hidden>
                                      ❚❚
                                    </span>
                                    Pause
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    className="song-detail-audio-action-btn song-detail-audio-action-btn--primary"
                                    onClick={() => queueActions.resume()}
                                  >
                                    <span className="song-detail-audio-action-btn__glyph" aria-hidden>
                                      ▶
                                    </span>
                                    Resume
                                  </button>
                                )}
                                <button
                                  type="button"
                                  className="song-detail-audio-action-btn song-detail-audio-action-btn--stop"
                                  onClick={() => queueActions.stop()}
                                >
                                  <span className="song-detail-audio-action-btn__glyph" aria-hidden>
                                    ■
                                  </span>
                                  Stop playing all
                                </button>
                              </>
                            )
                          ) : playAllDesktopAvailable ? (
                            <button
                              type="button"
                              className="song-detail-audio-action-btn song-detail-audio-action-btn--primary"
                              onClick={startPlayAllFromPage}
                            >
                              <span className="song-detail-audio-action-btn__glyph" aria-hidden>
                                ▶
                              </span>
                              {`Play all ${inAppPlayableTracks.length} top track${inAppPlayableTracks.length === 1 ? '' : 's'}`}
                            </button>
                          ) : null}
                          {playAllDesktopAvailable || playAllTopTracksActive ? (
                            <>
                              {persistentBarOwnsQueue ? null : (
                                <div className="song-detail-audio-controls" role="group" aria-label="Track queue navigation">
                                  <button
                                    type="button"
                                    className="song-detail-audio-action-btn song-detail-audio-action-btn--queue"
                                    onClick={() => queueActions.jump(-1)}
                                    disabled={!canGoPrevious}
                                  >
                                    Previous
                                  </button>
                                  <button
                                    type="button"
                                    className="song-detail-audio-action-btn song-detail-audio-action-btn--queue"
                                    onClick={() => queueActions.jump(1)}
                                    disabled={!canGoNext}
                                  >
                                    Next
                                  </button>
                                </div>
                              )}
                              <span className="song-detail-audio-status" aria-live="polite">
                                {queueIndex >= 0
                                  ? `Track ${queueIndex + 1} of ${queueStatusTotal}`
                                  : `Track 0 of ${queueStatusTotal}`}
                              </span>
                            </>
                          ) : null}
                        </div>
                      ) : null}
                      {!playAllDesktopAvailable ? (
                        <SongDetailPlayAllHonestHint
                          variant={playAllHonestHintVariant}
                          onSwitchToFullEp={playAllHonestHintVariant === 'full-ep-tab' ? switchToFullEpTab : undefined}
                        />
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
                      const explicitUrl = (selectedUrl ?? '').trim()
                      const active = explicitUrl
                        ? Boolean(url && url === explicitUrl)
                        : playingTrackId != null && queueOwnsPage
                          ? t.track_id === playingTrackId
                          : Boolean(url && playingUrl && url === playingUrl)
                      const hidden = !trackIsInApp(t)
                      const trackShareLink = trackShareUrl(detail.lyrics_title, detail.url_slug, t.track_id)
                      return (
                        <li key={t.track_id} className="song-detail-track-row">
                          <div
                            className={`song-detail-track${active ? ' is-active' : ''}${hidden ? ' is-hidden' : ''}${!url || hidden ? ' is-disabled' : ''}`}
                          >
                            <div
                              role="button"
                              tabIndex={!url || hidden ? -1 : 0}
                              className="song-detail-track-hit"
                              aria-disabled={!url || hidden}
                              onClick={() => {
                                if (!url || hidden) return
                                pickTopTrack(url)
                              }}
                              onKeyDown={(e) => {
                                if (!url || hidden) return
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault()
                                  pickTopTrack(url)
                                }
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
                            </div>
                            {!hidden ? (
                              <ShareButton
                                variant="icon"
                                className="song-detail-track-share"
                                url={trackShareLink}
                                title={t.track_title}
                                text="Listen on Bananasutra"
                              />
                            ) : null}
                          </div>
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
                        aria-label={SONG_VIDEO_SECTION_TITLE}
                      >
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
                              posterThumbnailUrl={focusedYoutubeVideo.thumbnail_url}
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
                    <h2
                      id="song-lyrics-heading"
                      className={hasListenTabNav ? 'song-detail-chrome-label' : 'catalog-section-title'}
                    >
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
                (useLyricsMediaSplit ? ' song-detail-shell-section--wide-divider' : '')
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
                    posterThumbnailUrl={focusedYoutubeVideo.thumbnail_url}
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
                <ScrollRail className="listen-lp__scroll-rail" variant="fade">
                  <ul className="listen-lp__rail-list" aria-label="Sister songs">
                    {orderedRelatedSongs.slice(0, SONG_DETAIL_SISTER_SONGS_LIMIT).map((related) => {
                      const catalog = songCatalogByLyricsId.get(related.lyrics_id)
                      return (
                        <li key={related.lyrics_id} className="listen-lp__rail-cell">
                          <SongThumbCard
                            to={songCatalogLinkTo(related.lyrics_title, related.url_slug, {
                              section: browseRowHasAudioSection(related) ? 'audio' : undefined,
                            })}
                            coverUrl={related.cover_image_url}
                            title={related.lyrics_title}
                            metaLabel={catalog?.sutra?.trim() || undefined}
                          />
                        </li>
                      )
                    })}
                  </ul>
                </ScrollRail>
            </section>
          ) : null}

          <SongDetailBertrandEntry sutra={detail.sutra} />
        </main>
      </div>

      <GlobalFooter />
    </div>
  )
}
