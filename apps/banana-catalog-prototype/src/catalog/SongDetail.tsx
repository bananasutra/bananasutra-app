import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
  type RefObject,
} from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { GlobalHeader } from './GlobalHeader'
import { GlobalFooter } from './GlobalFooter'
import { SoundCloudEmbed } from './SoundCloudEmbed'
import { YouTubeEmbed } from './YouTubeEmbed'
import { loadSoundCloudWidgetApi } from './soundcloudWidgetApi'
import {
  catalogPathSlugFromTitleAndSlug,
  lyricsIdFromSongUrlSlug,
  browseRowHasAudioSection,
  songCatalogLinkTo,
  songCatalogPath,
} from './songPaths'
import { songbookHref } from './songbooks'
import { sutraClassName } from './sutraTheme'
import type { SongCatalogItem, SongDetailNavState, SongDetailRecord, SongDetailTrack, YouTubeCatalogVideo } from './types'
import { sutraHrefFromSongSutraField } from './sutraPageUtils'
import { buildBrowsePathForFacet, CATALOG_BROWSE_PATH } from './urlState'
import { songRecordingJsonLd } from '../seo/jsonLd'
import { PageMeta, songOgImageUrl } from './PageMeta'
import { useSyncCatalogHeaderHeight } from './useSyncCatalogHeaderHeight'
import { SongThumbCard } from './SongThumbCard'
import { useSongCatalogAndDetail, loadYoutubeByLyricsId } from './generatedData'
import './CatalogApp.css'
import './SongDetail.css'

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

function formatEpDuration(totalSeconds: number): string {
  if (totalSeconds <= 0) return ''
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.round((totalSeconds % 3600) / 60)
  if (h > 0) return `~${h}h ${m}m`
  return `~${m}m`
}

function parseDurationFormatted(fmt: string): number {
  const parts = fmt.split(':').map(Number)
  if (parts.some((n) => Number.isNaN(n))) return 0
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  return 0
}

/** Matches `_norm_soundcloud_url` in build_artifacts.py — stable lookup for EP duration metadata. */
function normSoundcloudUrl(url: string): string {
  let u = url.trim().replace(/\/+$/, '').toLowerCase()
  if (!u) return ''
  const q = u.indexOf('?')
  if (q >= 0) u = u.slice(0, q)
  return u
}

function trackDurationSeconds(track: SongDetailTrack): number {
  const sec = Number(track.duration_sec)
  if (Number.isFinite(sec) && sec > 0) return sec
  return parseDurationFormatted((track.duration_raw ?? '').trim())
}

/** Single-track list-mode chrome (R9); `/sets/` URLs need enough height for multi-track rows in the SC widget. */
const SC_EMBED_HEIGHT_TRACK_LIST = 166
const SC_EMBED_HEIGHT_SET_PLAYLIST = 450

/** Matches `@media (min-width: 900px)` for `.song-detail-split--two-col` — lyrics clamp only there. */
const SONG_DETAIL_TWO_COL_MQ = '(min-width: 900px)'

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

type SongDetailSection = 'audio' | 'video'

/** Mirrors `--song-detail-lyrics-collapsed-max` in SongDetail.css (sum of rem terms + min(..., 82vh)). */
function lyricsCollapsedMaxPx(): number {
  if (typeof window === 'undefined') return Math.round(59.5 * 16)
  const remPx = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
  const sumRem = 2.5 + 0.85 + 11 + 0.85 + 3 * 2.9 + 2 * 0.8 + 34
  return Math.min(sumRem * remPx, window.innerHeight * 0.82)
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
}

function SongDetailLoaded({
  detail,
  lyricsId,
  pageRef,
  headerRef,
  listBreadcrumbHref,
  listBreadcrumbLabel,
  songCatalogByLyricsId,
}: SongDetailLoadedProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const fullSearch = searchParams.toString()
  const catalogSearch = useMemo(() => {
    const p = new URLSearchParams(fullSearch)
    p.delete('section')
    return p.toString()
  }, [fullSearch])
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

  const [selectedUrl, setSelectedUrl] = useState<string | null>(null)
  const [soundcloudReloadKey, setSoundcloudReloadKey] = useState(0)
  const [isEpExpanded, setIsEpExpanded] = useState(false)
  const [lyricsExpanded, setLyricsExpanded] = useState(false)
  const [lyricsTall, setLyricsTall] = useState(false)
  const lyricsPreRef = useRef<HTMLPreElement>(null)

  const fallbackScUrl = (detail.fallback_sc_url ?? '').trim()
  const catalogListenUrl = (detail.sc_catalog_listen_url ?? '').trim()
  const primaryEpUrl = (detail.primary_ep_url ?? '').trim()
  const primaryEpTitle = (detail.primary_ep_title ?? '').trim()
  const playingUrl = (
    selectedUrl?.trim() ||
    defaultTrack?.sc_url?.trim() ||
    fallbackScUrl ||
    catalogListenUrl ||
    ''
  ).trim()
  const inAppPlayableTracks = orderedTracks.filter((t) => trackIsInApp(t) && t.sc_url.trim())

  const [playAllTopTracksActive, setPlayAllTopTracksActive] = useState(false)
  const playAllTopTracksActiveRef = useRef(false)
  const playerWrapRef = useRef<HTMLDivElement | null>(null)
  const inAppPlayableTracksRef = useRef<SongDetailTrack[]>(inAppPlayableTracks)
  const playingUrlRef = useRef<string>(playingUrl)
  const advanceToNextInQueueRef = useRef<() => void>(() => {})

  useEffect(() => {
    playAllTopTracksActiveRef.current = playAllTopTracksActive
  }, [playAllTopTracksActive])

  useEffect(() => {
    inAppPlayableTracksRef.current = inAppPlayableTracks
  }, [inAppPlayableTracks])

  useEffect(() => {
    playingUrlRef.current = playingUrl
  }, [playingUrl])

  /** All curated picks reference one EP → use it; otherwise fall back to primary SC EP set when tracks span multiple releases. */
  const sharedPlayableEpUrl = useMemo(() => {
    const set = new Set(
      inAppPlayableTracks
        .map((t) => (t.ep_url || '').trim())
        .filter((u) => u.includes('/sets/')),
    )
    return set.size === 1 ? [...set][0] : ''
  }, [inAppPlayableTracks])
  const playFullEpSetUrl = useMemo(() => {
    const primarySet = primaryEpUrl.includes('/sets/') ? primaryEpUrl : ''
    return sharedPlayableEpUrl || primarySet
  }, [sharedPlayableEpUrl, primaryEpUrl])
  const playFullEpTrackCount = useMemo(() => {
    if (!playFullEpSetUrl) return 0
    const nk = normSoundcloudUrl(playFullEpSetUrl)
    const matchingApp = inAppPlayableTracks.filter((t) => normSoundcloudUrl((t.ep_url || '').trim()) === nk)
    const epTotal = Math.max(0, ...matchingApp.map((t) => Number(t.ep_total_tracks || 0)))
    if (epTotal > 0) return epTotal
    if (matchingApp.length > 0) return matchingApp.length
    const catalogMatching = detail.tracks.filter((t) => normSoundcloudUrl((t.ep_url || '').trim()) === nk)
    const ct = Math.max(0, ...catalogMatching.map((t) => Number(t.ep_total_tracks || 0)))
    if (ct > 0) return ct
    return catalogMatching.length
  }, [playFullEpSetUrl, inAppPlayableTracks, detail.tracks])
  const playFullEpDurationLabel = useMemo(() => {
    if (!playFullEpSetUrl) return ''
    const nk = normSoundcloudUrl(playFullEpSetUrl)
    const fromEpRow = nk ? detail.sc_ep_set_duration_totals?.[nk]?.trim() : ''
    if (fromEpRow) {
      const secs = parseDurationFormatted(fromEpRow)
      return formatEpDuration(secs)
    }
    const matchingApp = inAppPlayableTracks.filter((t) => normSoundcloudUrl((t.ep_url || '').trim()) === nk)
    const totalSeconds = matchingApp.reduce((acc, t) => acc + trackDurationSeconds(t), 0)
    return formatEpDuration(totalSeconds)
  }, [detail.sc_ep_set_duration_totals, inAppPlayableTracks, playFullEpSetUrl])

  const soundcloudMainEmbedHeight =
    playingUrl.includes('/sets/') ? SC_EMBED_HEIGHT_SET_PLAYLIST : SC_EMBED_HEIGHT_TRACK_LIST

  const requestSoundcloudPlayback = useCallback((url: string) => {
    setSelectedUrl(url)
    setSoundcloudReloadKey((k) => k + 1)
  }, [])

  const pickTopTrack = useCallback(
    (url: string, { keepPlayAll = false }: { keepPlayAll?: boolean } = {}) => {
      if (!keepPlayAll && playAllTopTracksActiveRef.current) {
        playAllTopTracksActiveRef.current = false
        setPlayAllTopTracksActive(false)
      }
      requestSoundcloudPlayback(url)
    },
    [requestSoundcloudPlayback],
  )

  const stopPlayAllTopTracks = useCallback(() => {
    playAllTopTracksActiveRef.current = false
    setPlayAllTopTracksActive(false)
  }, [])

  const startPlayAllTopTracks = useCallback(() => {
    const queue = inAppPlayableTracksRef.current
    const firstUrl = queue[0]?.sc_url.trim()
    if (!firstUrl) return
    playAllTopTracksActiveRef.current = true
    setPlayAllTopTracksActive(true)
    pickTopTrack(firstUrl, { keepPlayAll: true })
  }, [pickTopTrack])

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
      stopPlayAllTopTracks()
      return
    }

    const nextUrl = next.sc_url.trim()
    if (!nextUrl) {
      stopPlayAllTopTracks()
      return
    }

    // Keep the play-all mode active while auto-advancing.
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
        widget.bind(SC.Widget.Events.FINISH, () => {
          if (!playAllTopTracksActiveRef.current) return
          advanceToNextInQueueRef.current()
        })
      })
      .catch(() => {
        // Widget API failed to load; Play All becomes effectively manual.
      })
  }, [])

  const writtenYear = (detail.written_year ?? '').trim()
  const hasHeroPrimaryTags = Boolean(detail.sutra) || Boolean(detail.songbook)
  const hasHeroFacetMeta =
    Boolean(detail.topic) ||
    Boolean(detail.intention) ||
    Boolean(detail.light_shadow) ||
    Boolean(detail.lang) ||
    Boolean(writtenYear) ||
    Boolean((detail.muse ?? '').trim())
  const hasYoutubeVideos = youtubeVideos.length > 0
  const hasLyrics = Boolean((detail.lyrics_text || '').trim())
  const hasPlayableTrack = Boolean(playingUrl)
  const hasEpFallback = Boolean(primaryEpUrl)
  const hasAnyTrackUrls = detail.tracks.some((t) => t.sc_url.trim())
  const shouldShowTracksList = orderedTracks.length > 1 || Boolean(activeTrackGenre)
  const hasCuratedInAppTracks = inAppPlayableTracks.length > 0
  const hasScCatalogListen = Boolean(catalogListenUrl)
  const hasPreferredScSource = hasCuratedInAppTracks || hasScCatalogListen
  const defaultingToCatalogExport =
    hasScCatalogListen && !defaultTrack && !fallbackScUrl && !(selectedUrl?.trim())
  const hasAudioContent =
    hasPlayableTrack || hasEpFallback || hasAnyTrackUrls || shouldShowTracksList || hasScCatalogListen
  /** No hero art / fallback column: lyrics-first rows with no listener media (e.g. pipeline-only songs). */
  const isLyricsOnlyNoCoverHero =
    !(detail.cover_image_url || '').trim() && !hasAudioContent && !hasYoutubeVideos
  const tabDefs = useMemo(() => {
    const out: Array<{ id: SongDetailSection; label: string }> = []
    if (hasAudioContent) out.push({ id: 'audio', label: 'Audio' })
    if (hasYoutubeVideos) out.push({ id: 'video', label: 'Video' })
    return out
  }, [hasAudioContent, hasYoutubeVideos])
  const hasTabNav = hasAudioContent && hasYoutubeVideos

  const tabIds = tabDefs.map((tab) => tab.id)
  const hasSongsBrowseContext = Boolean(catalogSearch)
  const activeSection = useMemo<null | SongDetailSection>(() => {
    if (hasTabNav && (requestedSection === 'audio' || requestedSection === 'video') && tabIds.includes(requestedSection)) {
      return requestedSection
    }
    if (hasPreferredScSource && hasSongsBrowseContext && tabIds.includes('audio')) {
      return 'audio'
    }
    if (!hasPreferredScSource && tabIds.includes('video')) return 'video'
    if (tabIds.includes('audio')) return 'audio'
    if (tabIds.includes('video')) return 'video'
    return null
  }, [hasTabNav, requestedSection, tabIds, hasPreferredScSource, hasSongsBrowseContext])
  const showAudioSection = hasAudioContent && (!hasTabNav || activeSection === 'audio')
  const showVideoSection = hasYoutubeVideos && (!hasTabNav || activeSection === 'video')
  const hasMediaColumn = hasTabNav || showAudioSection || showVideoSection
  const useLyricsMediaSplit = hasLyrics && hasMediaColumn
  const isSongDetailTwoColDesktop = useSongDetailLyricsClampViewport()
  /** Collapse long lyrics only on desktop two-column layout — tablet/mobile and lyrics-only pages show full text. */
  const lyricsClampEnabled = useLyricsMediaSplit && isSongDetailTwoColDesktop

  useLayoutEffect(() => {
    const pre = lyricsPreRef.current
    if (!lyricsClampEnabled || !pre) {
      setLyricsTall(false)
      return
    }
    const maxPx = lyricsCollapsedMaxPx()
    const prev = pre.style.maxHeight
    pre.style.maxHeight = 'none'
    const full = pre.scrollHeight
    pre.style.maxHeight = prev
    setLyricsTall(full > maxPx + 6)
  }, [detail.lyrics_text, lyricsClampEnabled])

  useEffect(() => {
    queueMicrotask(() => setLyricsExpanded(false))
  }, [detail.lyrics_id])

  useEffect(() => {
    const onResize = () => {
      const pre = lyricsPreRef.current
      if (!lyricsClampEnabled || !pre) return
      const maxPx = lyricsCollapsedMaxPx()
      const prev = pre.style.maxHeight
      pre.style.maxHeight = 'none'
      const full = pre.scrollHeight
      pre.style.maxHeight = prev
      setLyricsTall(full > maxPx + 6)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [lyricsClampEnabled, detail.lyrics_text])

  useEffect(() => {
    // Depend on `location.search` (string), not `searchParams` — RR can churn the latter's identity
    // every render; re-running this effect spams `navigate` and can freeze or blank the page in dev.
    const qParams = new URLSearchParams(location.search)
    if (!hasTabNav) {
      if (!requestedSection) return
      // Preserve deep-linked video tab until youtube-by-lyrics data has resolved.
      if (requestedSection === 'video' && !youtubeVideosLoaded) return
      const sectionExists =
        (requestedSection === 'audio' && hasAudioContent) ||
        (requestedSection === 'video' && hasYoutubeVideos)
      if (sectionExists) return
      qParams.delete('section')
      const q = qParams.toString()
      navigate(`${location.pathname}${q ? `?${q}` : ''}`, { replace: true, state: location.state })
      return
    }
    const current = requestedSection
    const next = activeSection
    if (!next) return
    if (current === next) return
    qParams.set('section', next)
    const q = qParams.toString()
    navigate(`${location.pathname}${q ? `?${q}` : ''}`, { replace: true, state: location.state })
  }, [
    hasTabNav,
    activeSection,
    requestedSection,
    location.search,
    navigate,
    location.pathname,
    location.state,
    hasAudioContent,
    hasYoutubeVideos,
    youtubeVideosLoaded,
  ])

  const setActiveSection = (next: SongDetailSection) => {
    if (!hasTabNav) return
    const p = new URLSearchParams(location.search)
    p.set('section', next)
    const q = p.toString()
    navigate(`${location.pathname}${q ? `?${q}` : ''}`, { replace: true, state: location.state })
  }

  const tabRefs = useRef<Record<SongDetailSection, HTMLButtonElement | null>>({
    audio: null,
    video: null,
  })

  const onTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, tab: SongDetailSection) => {
    const idx = tabIds.indexOf(tab)
    if (idx < 0) return
    let nextIdx = idx
    if (event.key === 'ArrowRight') nextIdx = (idx + 1) % tabIds.length
    else if (event.key === 'ArrowLeft') nextIdx = (idx - 1 + tabIds.length) % tabIds.length
    else if (event.key === 'Home') nextIdx = 0
    else if (event.key === 'End') nextIdx = tabIds.length - 1
    else return
    event.preventDefault()
    const nextTab = tabIds[nextIdx]
    tabRefs.current[nextTab]?.focus()
  }

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
                  <img
                    src={detail.cover_image_url}
                    alt=""
                    width={320}
                    height={320}
                    loading="eager"
                    fetchPriority="high"
                    decoding="sync"
                  />
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
              {hasHeroPrimaryTags || hasHeroFacetMeta ? (
                <>
                  {hasHeroPrimaryTags ? (
                    <ul className="song-detail-secondary-meta" aria-label="Sutra and songbook">
                      {detail.sutra ? (
                        <li className="song-detail-secondary-meta-item">
                          <Link
                            className="song-detail-secondary-link"
                            to={sutraHrefFromSongSutraField(detail.sutra) ?? buildBrowsePathForFacet('sutra', detail.sutra)}
                          >
                            sutra:{' '}
                            <span className={`catalog-facet-sutra-name ${sutraClassName(detail.sutra)}`}>{detail.sutra}</span>
                          </Link>
                        </li>
                      ) : null}
                      {detail.songbook ? (
                        <li className="song-detail-secondary-meta-item">
                          <Link className="song-detail-secondary-link" to={songbookHref(detail.songbook)}>
                            songbook: {detail.songbook}
                          </Link>
                        </li>
                      ) : null}
                    </ul>
                  ) : null}
                  {hasHeroFacetMeta ? (
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
                      {detail.muse ? (
                        <li className="song-detail-secondary-meta-item">
                          <Link className="song-detail-secondary-link" to={searchCatalogHref(detail.muse)}>
                            {detail.muse}
                          </Link>
                        </li>
                      ) : null}
                    </ul>
                  ) : null}
                </>
              ) : null}
            </div>
          </header>

          <div
            className={
              'song-detail-split' +
              (useLyricsMediaSplit ? ' song-detail-split--two-col' : '') +
              (useLyricsMediaSplit && hasTabNav ? ' song-detail-split--tabbed' : '') +
              (!hasLyrics && hasMediaColumn ? ' song-detail-split--media-only' : '') +
              (hasLyrics && !hasMediaColumn ? ' song-detail-split--lyrics-only' : '')
            }
          >
            {hasMediaColumn ? (
              <div className="song-detail-split__media">
                {hasTabNav ? (
                  <div className="song-detail-tabs" role="tablist" aria-label="Media sections">
                    {tabDefs.map((tab) => (
                      <button
                        key={tab.id}
                        ref={(node) => {
                          tabRefs.current[tab.id] = node
                        }}
                        type="button"
                        role="tab"
                        id={`song-tab-${tab.id}`}
                        aria-controls={`song-panel-${tab.id}`}
                        aria-selected={activeSection === tab.id}
                        className={`song-detail-tab${activeSection === tab.id ? ' is-active' : ''}`}
                        onClick={() => setActiveSection(tab.id)}
                        onKeyDown={(e) => onTabKeyDown(e, tab.id)}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                ) : null}

                {showAudioSection ? (
                  <section
                    className="song-detail-media"
                    role={hasTabNav ? 'tabpanel' : undefined}
                    id={hasTabNav ? 'song-panel-audio' : undefined}
                    aria-labelledby={hasTabNav ? 'song-tab-audio' : undefined}
                  >
                    {!hasTabNav ? <h2 className="catalog-section-title">Audio</h2> : null}

                    <section className="song-detail-player" aria-label="SoundCloud player">
                {hasPlayableTrack ? (
                  <>
                    {defaultingToCatalogExport ? (
                      <p className="song-detail-ep-only-intro">
                        Here&apos;s the SoundCloud version for this song.
                      </p>
                    ) : null}
                    <div ref={playerWrapRef}>
                      <SoundCloudEmbed
                        scUrl={playingUrl}
                        title={`SoundCloud: ${detail.lyrics_title}`}
                        mode="list"
                        height={soundcloudMainEmbedHeight}
                        autoPlay={Boolean((selectedUrl ?? '').trim())}
                        reloadKey={soundcloudReloadKey}
                        onLoad={handlePlayerLoad}
                        loading="eager"
                      />
                    </div>
                  </>
                ) : hasEpFallback ? (
                  <>
                    <p className="song-detail-ep-only-intro">This one lives inside a full EP.</p>
                    <details
                      className="song-detail-ep-disclosure"
                      open={isEpExpanded}
                      onToggle={(e) => setIsEpExpanded((e.currentTarget as HTMLDetailsElement).open)}
                    >
                      <summary className="song-detail-ep-summary">Play full EP</summary>
                      <div className="song-detail-ep-panel">
                      {isEpExpanded ? (
                        <SoundCloudEmbed
                          scUrl={primaryEpUrl}
                          title={primaryEpTitle ? `SoundCloud: ${primaryEpTitle}` : `SoundCloud EP · ${detail.lyrics_title}`}
                          height={primaryEpUrl.includes('/sets/') ? SC_EMBED_HEIGHT_SET_PLAYLIST : 360}
                          mode={primaryEpUrl.includes('/sets/') ? 'list' : 'visual'}
                          autoPlay
                          loading="eager"
                        />
                      ) : null}
                      <p className="song-detail-ep-only-footer">
                        <a className="song-detail-ep-link" href={primaryEpUrl} target="_blank" rel="noreferrer">
                          Open EP on SoundCloud
                        </a>
                      </p>
                      </div>
                    </details>
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
                  <h3 id="song-tracks-heading" className="song-detail-subsection-title">
                    {inAppPlayableTracks.length > 1 ? 'Top tracks' : 'Track picks'}
                  </h3>
                  {inAppPlayableTracks.length > 1 ? (
                    <div className="song-detail-audio-playall" aria-label="Play all top tracks">
                      {playAllTopTracksActive ? (
                        <>
                          <p className="song-detail-audio-hint" aria-live="polite">
                            {(() => {
                              const queue = inAppPlayableTracks
                              const idx = queue.findIndex((t) => t.sc_url.trim() === playingUrl.trim())
                              const pos = idx >= 0 ? idx + 1 : 1
                              return `Playing ${pos} of ${queue.length}`
                            })()}. Autoplay works best on desktop. On mobile (especially iPhone), you may need to tap each next
                            track to keep the queue going.
                          </p>
                          <button type="button" className="song-detail-audio-action-btn" onClick={stopPlayAllTopTracks}>
                            Stop playing all
                          </button>
                        </>
                      ) : (
                        <>
                          <p className="song-detail-audio-hint">
                            Autoplay works best on desktop. On mobile (especially iPhone), you may need to tap each next track to
                            keep the queue going.
                          </p>
                          <button type="button" className="song-detail-audio-action-btn" onClick={startPlayAllTopTracks}>
                            {`Play all ${inAppPlayableTracks.length} top track${inAppPlayableTracks.length === 1 ? '' : 's'}`}
                          </button>
                        </>
                      )}
                    </div>
                  ) : null}
                  {activeTrackGenre ? (
                    <p className="song-detail-track-context">
                      Browsing genre: <strong>{activeTrackGenre}</strong>
                    </p>
                  ) : null}
                  <ul className="song-detail-track-list">
                    {orderedTracks.map((t) => {
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
                              <span>{t.duration_raw || '—'}</span>
                              <span>{t.play_count.toLocaleString()} plays</span>
                              <span>{t.like_count.toLocaleString()} likes</span>
                            </span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </section>
              ) : null}
              {playFullEpSetUrl && hasCuratedInAppTracks ? (
                <section className="song-detail-audio-playall" aria-label="Play full EP">
                  <p className="song-detail-audio-hint">
                    Like it? Listen to all {playFullEpTrackCount || 'the'} track{playFullEpTrackCount === 1 ? '' : 's'} as a
                    playlist{playFullEpDurationLabel ? ` (${playFullEpDurationLabel})` : ''}.
                  </p>
                  <button
                    type="button"
                    className="song-detail-audio-action-btn"
                    onClick={() => pickTopTrack(playFullEpSetUrl)}
                  >
                    Play full EP
                  </button>
                </section>
              ) : null}
            </section>
          ) : null}

          {showVideoSection ? (
            <section
              className="song-detail-media"
              role={hasTabNav ? 'tabpanel' : undefined}
              id={hasTabNav ? 'song-panel-video' : undefined}
              aria-labelledby={hasTabNav ? 'song-tab-video' : undefined}
            >
              {!hasTabNav ? <h2 className="catalog-section-title">Video</h2> : null}
              <section className="song-detail-youtube" aria-label="YouTube player">
                {focusedYoutubeVideo?.can_embed ? (
                  <YouTubeEmbed
                    videoId={focusedYoutubeVideo.video_id}
                    title={`YouTube: ${focusedYoutubeVideo.title || detail.lyrics_title}`}
                  />
                ) : focusedYoutubeVideo ? (
                  <div className="song-detail-youtube-no-embed" role="region" aria-label="Selected video not embeddable">
                    <p className="song-detail-youtube-no-embed-lead">
                      YouTube marks this upload as not embeddable on other sites—that&apos;s their rule, not a bug on
                      this site.
                    </p>
                    {focusedYoutubeVideo.yt_url ? (
                      <a className="song-detail-youtube-open" href={focusedYoutubeVideo.yt_url} target="_blank" rel="noreferrer">
                        Watch on YouTube
                      </a>
                    ) : null}
                  </div>
                ) : (
                  <p className="song-detail-youtube-no-embed">No embeddable public video is available for in-app playback.</p>
                )}
                {youtubeVideos.length > 1 ? (
                  <>
                    <h4 className="song-detail-youtube-subheading">Videos for this song</h4>
                    <ul className="song-detail-youtube-list" aria-label="YouTube uploads for this song">
                      {youtubeVideos.map((v) => {
                        const active = v.video_id === effectiveYoutubeVideoId
                        return (
                          <li key={v.video_id} className="song-detail-youtube-row">
                            <button
                              type="button"
                              className={`song-detail-youtube-vid${active ? ' is-active' : ''}`}
                              onClick={() => setSelectedYoutubeVideoId(v.video_id)}
                            >
                              {v.thumbnail_url ? (
                                <span className="song-detail-youtube-vid-thumb">
                                  <img src={v.thumbnail_url} alt="" width={88} height={50} loading="lazy" />
                                </span>
                              ) : (
                                <span
                                  className="song-detail-youtube-vid-thumb song-detail-youtube-vid-thumb--fallback"
                                  aria-hidden
                                >
                                  ▶
                                </span>
                              )}
                              <span className="song-detail-youtube-vid-copy">
                                <span className="song-detail-youtube-vid-title">
                                  {v.title || v.lyrics_title || 'YouTube video'}
                                </span>
                                <span className="song-detail-youtube-vid-meta">
                                  {v.duration ? <span>{v.duration}</span> : null}
                                  {v.publish_date ? <span>{v.publish_date.slice(0, 10)}</span> : null}
                                  {!v.can_embed ? <span className="song-detail-youtube-vid-flag">in-app embed off</span> : null}
                                </span>
                              </span>
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  </>
                ) : null}
              </section>
            </section>
          ) : null}
              </div>
            ) : null}

            {hasLyrics ? (
              <section className="song-detail-split__lyrics song-detail-lyrics" aria-labelledby="song-lyrics-heading">
                <h2 id="song-lyrics-heading" className="catalog-section-title">
                  Lyrics
                </h2>
                <div
                  className={
                    'song-detail-lyrics-frame' +
                    (lyricsClampEnabled && lyricsTall && !lyricsExpanded
                      ? ' song-detail-lyrics-frame--collapsed'
                      : '')
                  }
                >
                  <pre ref={lyricsPreRef} className="song-detail-lyrics-pre" id="song-lyrics-body">
                    {detail.lyrics_text}
                  </pre>
                  {lyricsClampEnabled && lyricsTall ? (
                    <button
                      type="button"
                      className="song-detail-lyrics-expand"
                      aria-expanded={lyricsExpanded}
                      aria-controls="song-lyrics-body"
                      onClick={() => setLyricsExpanded((v) => !v)}
                    >
                      {lyricsExpanded ? 'Show less' : 'Show full lyrics'}
                    </button>
                  ) : null}
                </div>
              </section>
            ) : null}
          </div>

          {detail.related_songs.length ? (
            <section className="song-detail-related" aria-labelledby="song-related-heading">
              <h2 id="song-related-heading" className="catalog-section-title">
                Related songs
              </h2>
              <ul className="song-thumb-grid song-thumb-grid--section">
                {detail.related_songs.slice(0, 8).map((related) => {
                  const sutra = songCatalogByLyricsId.get(related.lyrics_id)?.sutra?.trim() ?? ''
                  return (
                    <li key={related.lyrics_id} className="song-thumb-grid__cell">
                      <SongThumbCard
                        to={songCatalogLinkTo(related.lyrics_title, related.url_slug, {
                          section: (() => {
                            const row = songCatalogByLyricsId.get(related.lyrics_id)
                            return row && browseRowHasAudioSection(row) ? 'audio' : undefined
                          })(),
                        })}
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
        </main>
      </div>

      <GlobalFooter />
    </div>
  )
}
