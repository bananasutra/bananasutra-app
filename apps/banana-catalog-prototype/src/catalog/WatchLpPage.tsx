import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { catalogDataFileUrl, fetchCatalogData } from './catalogDataUrl'
import {
  CatalogVideoSpotlight,
  type CatalogVideoSpotlightItem,
} from './CatalogVideoSpotlight'
import { GlobalFooter } from './GlobalFooter'
import { GlobalHeader } from './GlobalHeader'
import { getYoutubeByLyricsIdSync, useSongCatalogBrowse } from './generatedData'
import { canonicalPathForRoute } from './seoPaths'
import { songCatalogLinkTo } from './songPaths'
import type { YouTubeCatalogVideo, YouTubePlaylistCatalogItem } from './types'
import { renderPageMeta } from './usePageMeta'
import { useSyncCatalogHeaderHeight } from './useSyncCatalogHeaderHeight'
import { useExclusiveYoutubeEmbedsPlayback } from './useExclusiveYoutubeEmbedsPlayback'
import { pauseSoundcloudWidgetsInWraps } from './useExclusiveYoutubeSoundcloudPlayback'
import { usePlayerQueueRegistrar } from './playerQueue/playerQueueRegistrarContext'
import { WatchLpBertrandTail } from './WatchLpBertrandTail'
import { ScrollRevealSection } from './ScrollRevealSection'
import { WatchLpFacetBar } from './WatchLpFacetBar'
import { allSongbooks } from './songbooks'
import { songbookSlugForYoutubePlaylist } from './songbookYoutubeMatch'
import { WatchLpPlaylistEmbed } from './WatchLpPlaylistEmbed'
import { WatchLpPlaylistThumb } from './WatchLpPlaylistThumb'
import { CatalogVideoSpotlightRailThumb } from './CatalogVideoSpotlightRailThumb'
import { pauseYoutubeEmbed } from './youtubeEmbedControl'
import {
  dedupeWatchPlaylists,
  pickFilteredWatchPlaylists,
  pickRecentClipsRail,
  pickSpotlightHero,
  WATCH_LP_META,
  WATCH_LP_PLAYLIST_GRID_LIMIT,
  watchLpRecentClipsNote,
  watchLpVideoRailThumbLines,
  type WatchLpSutraFilter,
} from './watchLpData'
import { formatDurationDisplay } from './durationFormat'
import {
  buildYoutubePlaylistDurationByName,
  dedupeYoutubeVideosByVideoId,
  flattenYoutubeCatalogVideos,
} from './youtubeCatalogFlat'
import './CatalogApp.css'
import './catalog-page-shell.css'
import './CatalogVideoSpotlight.css'
import './lp-facet-bar.css'
import './WatchLpPage.css'

function toSpotlightItem(
  video: YouTubeCatalogVideo,
  inApp: boolean,
): CatalogVideoSpotlightItem {
  const title = (video.lyrics_title || video.title || '').trim()
  return {
    videoId: video.video_id,
    title,
    summary: (video.lyrics_summary || '').trim() || undefined,
    sutra: (video.sutra || '').trim() || undefined,
    duration: formatDurationDisplay(video.duration) || undefined,
    inApp,
    songHref: inApp
      ? songCatalogLinkTo(title, video.url_slug, { section: 'video' })
      : null,
    externalHref: inApp ? null : (video.yt_url || '').trim() || null,
    thumbnailUrl: (video.thumbnail_url || '').trim() || undefined,
  }
}

export function WatchLpPage() {
  const pageRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLElement>(null)
  const spotlightYtRef = useRef<HTMLIFrameElement>(null)
  const playlistYtRef = useRef<HTMLIFrameElement>(null)
  const { data: songCatalogRows } = useSongCatalogBrowse()
  const [youtubeVideos, setYoutubeVideos] = useState<YouTubeCatalogVideo[] | null>(() => {
    const seeded = getYoutubeByLyricsIdSync()
    if (!seeded) return null
    return dedupeYoutubeVideosByVideoId(Object.values(seeded).flat())
  })
  const [playlists, setPlaylists] = useState<YouTubePlaylistCatalogItem[] | null>(null)
  const [catalogLoadError, setCatalogLoadError] = useState<string | null>(null)
  const [activeSutra, setActiveSutra] = useState<WatchLpSutraFilter>('ALL')
  const [activeGenre, setActiveGenre] = useState('ALL')
  const [pickedFeaturedId, setPickedFeaturedId] = useState<string | null>(null)
  const [pickedPlaylistId, setPickedPlaylistId] = useState<string | null>(null)
  const [showAllPlaylists, setShowAllPlaylists] = useState(false)
  const [isPlaylistEmbedPlaying, setIsPlaylistEmbedPlaying] = useState(false)
  const [isSpotlightEmbedPlaying, setIsSpotlightEmbedPlaying] = useState(false)
  const [filterBarExpanded, setFilterBarExpanded] = useState(false)

  const { persistentScEmbedWrapRef, usePersistentPlayback } = usePlayerQueueRegistrar()

  useExclusiveYoutubeEmbedsPlayback(Boolean(youtubeVideos?.length && playlists?.length), {
    persistentScWrapRef: usePersistentPlayback ? persistentScEmbedWrapRef : undefined,
  })

  useEffect(() => {
    let cancelled = false

    void flattenYoutubeCatalogVideos()
      .then((videosResult) => {
        if (cancelled) return
        setYoutubeVideos(dedupeYoutubeVideosByVideoId(Array.isArray(videosResult) ? videosResult : []))
      })
      .catch(() => {
        if (!cancelled) {
          setYoutubeVideos(null)
          setCatalogLoadError('Could not load watch catalog data.')
        }
      })

    void fetchCatalogData(catalogDataFileUrl('youtube_playlists_catalog.json'))
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        const rows = (await r.json()) as unknown
        if (!Array.isArray(rows)) throw new Error('Invalid playlist catalog payload')
        return rows as YouTubePlaylistCatalogItem[]
      })
      .then((playlistsResult) => {
        if (cancelled) return
        setCatalogLoadError(null)
        setPlaylists(dedupeWatchPlaylists(Array.isArray(playlistsResult) ? playlistsResult : []))
      })
      .catch(() => {
        if (!cancelled) {
          setPlaylists(null)
          setCatalogLoadError('Could not load watch catalog data.')
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  const inAppIds = useMemo(() => {
    const ids = songCatalogRows?.map((s) => (s.lyrics_id || '').trim()).filter(Boolean) ?? []
    return new Set(ids)
  }, [songCatalogRows])

  const allVideos = useMemo(() => youtubeVideos ?? [], [youtubeVideos])
  const playlistDurationByName = useMemo(
    () => buildYoutubePlaylistDurationByName(allVideos),
    [allVideos],
  )
  const defaultHero = useMemo(() => pickSpotlightHero(allVideos), [allVideos])

  const featuredVideo = useMemo(() => {
    if (pickedFeaturedId) {
      return allVideos.find((v) => v.video_id === pickedFeaturedId) ?? defaultHero
    }
    return defaultHero
  }, [pickedFeaturedId, allVideos, defaultHero])

  const recentRail = useMemo(
    () => pickRecentClipsRail(allVideos, featuredVideo?.video_id ?? null),
    [allVideos, featuredVideo?.video_id],
  )

  const allPlaylists = useMemo(() => playlists ?? [], [playlists])
  const filteredPlaylists = useMemo(
    () => pickFilteredWatchPlaylists(allPlaylists, activeSutra, activeGenre),
    [allPlaylists, activeSutra, activeGenre],
  )
  const sortedPlaylists = useMemo(
    () => [...filteredPlaylists].sort((a, b) => (b.video_count || 0) - (a.video_count || 0)),
    [filteredPlaylists],
  )
  const visiblePlaylists = useMemo(() => {
    if (showAllPlaylists) return sortedPlaylists
    return sortedPlaylists.slice(0, WATCH_LP_PLAYLIST_GRID_LIMIT)
  }, [sortedPlaylists, showAllPlaylists])

  useEffect(() => {
    setShowAllPlaylists(false)
  }, [activeSutra, activeGenre])

  useEffect(() => {
    if (window.location.hash !== '#watch-lp-playlists-heading') return
    if (playlists === null) return
    const timer = window.setTimeout(() => {
      document.getElementById('watch-lp-playlists-heading')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 120)
    return () => window.clearTimeout(timer)
  }, [playlists])

  const activePlaylist = useMemo(() => {
    if (!visiblePlaylists.length) return null
    if (pickedPlaylistId && visiblePlaylists.some((pl) => pl.playlist_id === pickedPlaylistId)) {
      return allPlaylists.find((pl) => pl.playlist_id === pickedPlaylistId) ?? visiblePlaylists[0]
    }
    if (pickedPlaylistId && sortedPlaylists.some((pl) => pl.playlist_id === pickedPlaylistId)) {
      return allPlaylists.find((pl) => pl.playlist_id === pickedPlaylistId) ?? sortedPlaylists[0]
    }
    return visiblePlaylists[0] ?? sortedPlaylists[0] ?? null
  }, [pickedPlaylistId, visiblePlaylists, sortedPlaylists, allPlaylists])

  const activePlaylistId = activePlaylist?.playlist_id ?? null

  useEffect(() => {
    setIsPlaylistEmbedPlaying(false)
  }, [activePlaylistId])

  const handleSelectFeaturedVideo = (videoId: string) => {
    setPickedFeaturedId(videoId)
    setIsSpotlightEmbedPlaying(false)
  }

  const genreSongbooks = useMemo(() => allSongbooks(), [])
  const activePlaylistSongbookSlug = useMemo(
    () => (activePlaylist ? songbookSlugForYoutubePlaylist(activePlaylist, genreSongbooks) : null),
    [activePlaylist, genreSongbooks],
  )

  const featuredInApp = featuredVideo ? inAppIds.has((featuredVideo.lyrics_id || '').trim()) : false
  const featuredSpotlight = featuredVideo ? toSpotlightItem(featuredVideo, featuredInApp) : null
  const railSpotlight = recentRail.shown.map((video) => {
    const lid = (video.lyrics_id || '').trim()
    return toSpotlightItem(video, Boolean(lid && inAppIds.has(lid)))
  })

  const pageMeta = renderPageMeta({
    title: WATCH_LP_META.title,
    description: WATCH_LP_META.description,
    path: canonicalPathForRoute('/watch'),
  })

  useSyncCatalogHeaderHeight(pageRef, headerRef, [
    activeSutra,
    activeGenre,
    pickedFeaturedId,
    activePlaylistId,
    showAllPlaylists,
    filterBarExpanded,
    allVideos.length,
    allPlaylists.length,
    youtubeVideos === null ? -1 : allVideos.length,
  ])

  const clearPlaylistFilters = () => {
    setActiveSutra('ALL')
    setActiveGenre('ALL')
    setPickedPlaylistId(null)
  }

  const handleSutraChange = (value: WatchLpSutraFilter) => {
    setActiveSutra(value)
    if (value !== 'ALL') setActiveGenre('ALL')
    setPickedPlaylistId(null)
  }

  const handleGenreChange = (value: string) => {
    setActiveGenre(value)
    if (value !== 'ALL') setActiveSutra('ALL')
    setPickedPlaylistId(null)
  }

  const pausePersistentSoundcloud = () => {
    if (!usePersistentPlayback) return
    pauseSoundcloudWidgetsInWraps([persistentScEmbedWrapRef])
  }

  const pausePlaylistEmbed = () => {
    pauseYoutubeEmbed(playlistYtRef.current)
    setIsPlaylistEmbedPlaying(false)
    pausePersistentSoundcloud()
  }
  const pauseSpotlightEmbed = () => {
    pauseYoutubeEmbed(spotlightYtRef.current)
    setIsSpotlightEmbedPlaying(false)
    pausePersistentSoundcloud()
  }

  return (
    <div ref={pageRef} className="catalog catalog-page catalog-page--shell watch-lp">
      {pageMeta}
      <GlobalHeader ref={headerRef} />
      <div className="catalog-page__main">
        <main className="catalog-layout-shell watch-lp__main" id="main-content">
          <nav className="catalog-breadcrumbs" aria-label="Breadcrumb">
            <Link className="catalog-breadcrumbs__link" to="/">
              Home
            </Link>
            <span className="catalog-breadcrumbs__sep" aria-hidden>
              /
            </span>
            <span className="catalog-breadcrumbs__current" aria-current="page">
              Watch
            </span>
          </nav>

          <header className="catalog-page-intro watch-lp__intro">
            <h1 className="catalog-page-h1">{WATCH_LP_META.lead}</h1>
            <p className="catalog-page-sub">
              Recent clips and longer playlists, press play here. The full archive, every upload with filters, is on{' '}
              <Link to={canonicalPathForRoute('/videos')}>Videos</Link>.
            </p>
          </header>

          {catalogLoadError ? <p className="watch-lp__load-error">{catalogLoadError}</p> : null}

          {youtubeVideos === null && !catalogLoadError ? (
            <p className="watch-lp__loading" aria-live="polite">
              Loading videos…
            </p>
          ) : (
            <ScrollRevealSection
              immediate
              className="watch-lp__section watch-lp__spotlight"
              aria-labelledby="watch-lp-spotlight-heading"
            >
              <h2 id="watch-lp-spotlight-heading" className="catalog-section-title">
                What&apos;s new?
              </h2>
              <p className="catalog-lp-section-intro">Most recent clips first. Tap a thumbnail to swap the player.</p>

              <CatalogVideoSpotlight
                className="watch-lp__spotlight-player catalog-video-spotlight--borderless catalog-video-spotlight--compact-rail"
                featured={featuredSpotlight}
                rail={railSpotlight}
                activeVideoId={featuredVideo?.video_id ?? null}
                onSelectVideo={handleSelectFeaturedVideo}
                iframeRef={spotlightYtRef}
                onBeforePlay={pausePlaylistEmbed}
                onPlayingChange={setIsSpotlightEmbedPlaying}
                railEyebrow="More recent clips"
                renderRailCell={(video, isActive, onSelect) => {
                  const source = recentRail.shown.find((v) => v.video_id === video.videoId)
                  if (!source) return null
                  const title = (source.lyrics_title || source.title || 'Video').trim()
                  const railLines = watchLpVideoRailThumbLines(source)
                  const isNowPlaying = isActive && isSpotlightEmbedPlaying
                  return (
                    <CatalogVideoSpotlightRailThumb
                      thumbnailUrl={source.thumbnail_url}
                      sutra={railLines.sutra}
                      duration={railLines.duration}
                      isActive={isActive}
                      isPlaying={isNowPlaying}
                      onSelect={onSelect}
                      ariaLabel={`${title}${isNowPlaying ? ' (now playing)' : isActive ? ' (selected)' : ''}`}
                    />
                  )
                }}
                footer={
                  <>
                    {recentRail.total ? (
                      <span className="watch-lp__grid-note">
                        {watchLpRecentClipsNote(recentRail.total, recentRail.shown.length)}
                      </span>
                    ) : null}
                    <Link className="catalog-section-cta watch-lp__spotlight-browse" to="/videos/">
                      Browse all videos →
                    </Link>
                  </>
                }
              />
            </ScrollRevealSection>
          )}

          {playlists === null && !catalogLoadError ? (
            <p className="watch-lp__loading" aria-live="polite">
              Loading playlists…
            </p>
          ) : (
            <ScrollRevealSection
              className="watch-lp__section watch-lp__playlists-block"
              aria-labelledby="watch-lp-playlists-heading"
            >
              <h2 id="watch-lp-playlists-heading" className="catalog-section-title">
                BANANASUTRA cinema
              </h2>
              <p className="catalog-lp-section-intro">
                The longer form. Playlists organized by story or by sound. Pick one and stay a while.
              </p>

              <div className="watch-lp__playlists-player">
                <WatchLpPlaylistEmbed
                  playlist={activePlaylist}
                  durationByName={playlistDurationByName}
                  iframeRef={playlistYtRef}
                  onBeforePlay={pauseSpotlightEmbed}
                  onPlayingChange={setIsPlaylistEmbedPlaying}
                  songbookSlug={activePlaylistSongbookSlug}
                  borderless
                />
              </div>

              <div className="catalog-index-filter-band watch-lp__filters-band">
                <WatchLpFacetBar
                playlists={allPlaylists}
                activeSutra={activeSutra}
                activeGenre={activeGenre}
                shownCount={visiblePlaylists.length}
                totalCount={sortedPlaylists.length}
                onSutraChange={handleSutraChange}
                onGenreChange={handleGenreChange}
                onClearSutra={() => {
                  setActiveSutra('ALL')
                  setPickedPlaylistId(null)
                }}
                onClearGenre={() => {
                  setActiveGenre('ALL')
                  setPickedPlaylistId(null)
                }}
                onClearAll={clearPlaylistFilters}
                defaultExpanded={filterBarExpanded}
                onExpandedChange={setFilterBarExpanded}
                />
              </div>

              {visiblePlaylists.length ? (
                <ul className="watch-lp__playlist-grid catalog-index-after-filters" aria-live="polite">
                  {visiblePlaylists.map((pl) => (
                    <WatchLpPlaylistThumb
                      key={pl.playlist_id}
                      playlist={pl}
                      durationByName={playlistDurationByName}
                      isActive={pl.playlist_id === activePlaylistId}
                      isPlaying={pl.playlist_id === activePlaylistId && isPlaylistEmbedPlaying}
                      onSelect={() => setPickedPlaylistId(pl.playlist_id)}
                    />
                  ))}
                </ul>
              ) : (
                <p className="watch-lp__empty catalog-index-after-filters">No playlists match this filter.</p>
              )}

              {sortedPlaylists.length > WATCH_LP_PLAYLIST_GRID_LIMIT && !showAllPlaylists ? (
                <button
                  type="button"
                  className="catalog-index-show-more"
                  onClick={() => setShowAllPlaylists(true)}
                >
                  Load all {sortedPlaylists.length} playlists
                </button>
              ) : null}
            </ScrollRevealSection>
          )}

          <p className="watch-lp__honest-note">
            Background video pauses on most mobile browsers. Keep the app open while watching.
          </p>

          <WatchLpBertrandTail />
        </main>
      </div>
      <GlobalFooter />
    </div>
  )
}
