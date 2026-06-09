import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { catalogDataFileUrl, fetchCatalogData } from './catalogDataUrl'
import {
  CatalogVideoSpotlight,
  type CatalogVideoSpotlightItem,
} from './CatalogVideoSpotlight'
import { GlobalFooter } from './GlobalFooter'
import { GlobalHeader } from './GlobalHeader'
import { useSongCatalogBrowse } from './generatedData'
import { canonicalPathForRoute } from './seoPaths'
import { songCatalogLinkTo } from './songPaths'
import type { YouTubeCatalogVideo, YouTubePlaylistCatalogItem } from './types'
import { renderPageMeta } from './usePageMeta'
import { useSyncCatalogHeaderHeight } from './useSyncCatalogHeaderHeight'
import { useExclusiveYoutubeEmbedsPlayback } from './useExclusiveYoutubeEmbedsPlayback'
import { WatchLpBertrandTail } from './WatchLpBertrandTail'
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
  }
}

export function WatchLpPage() {
  const pageRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLElement>(null)
  const spotlightYtRef = useRef<HTMLIFrameElement>(null)
  const playlistYtRef = useRef<HTMLIFrameElement>(null)
  const { data: songCatalogRows } = useSongCatalogBrowse()
  const [youtubeVideos, setYoutubeVideos] = useState<YouTubeCatalogVideo[] | null>(null)
  const [playlists, setPlaylists] = useState<YouTubePlaylistCatalogItem[] | null>(null)
  const [catalogLoadError, setCatalogLoadError] = useState<string | null>(null)
  const [activeSutra, setActiveSutra] = useState<WatchLpSutraFilter>('ALL')
  const [activeGenre, setActiveGenre] = useState('ALL')
  const [pickedFeaturedId, setPickedFeaturedId] = useState<string | null>(null)
  const [pickedPlaylistId, setPickedPlaylistId] = useState<string | null>(null)
  const [showAllPlaylists, setShowAllPlaylists] = useState(false)

  useExclusiveYoutubeEmbedsPlayback(Boolean(youtubeVideos?.length && playlists?.length))

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const [videosResult, playlistsResult] = await Promise.all([
          flattenYoutubeCatalogVideos(),
          fetchCatalogData(catalogDataFileUrl('youtube_playlists_catalog.json')).then(async (r) => {
            if (!r.ok) throw new Error(`HTTP ${r.status}`)
            const rows = (await r.json()) as unknown
            if (!Array.isArray(rows)) throw new Error('Invalid playlist catalog payload')
            return rows as YouTubePlaylistCatalogItem[]
          }),
        ])
        if (cancelled) return
        setCatalogLoadError(null)
        setYoutubeVideos(dedupeYoutubeVideosByVideoId(Array.isArray(videosResult) ? videosResult : []))
        setPlaylists(dedupeWatchPlaylists(Array.isArray(playlistsResult) ? playlistsResult : []))
      } catch {
        if (!cancelled) {
          setYoutubeVideos(null)
          setPlaylists(null)
          setCatalogLoadError('Could not load watch catalog data.')
        }
      }
    }
    void load()
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

  const pausePlaylistEmbed = () => pauseYoutubeEmbed(playlistYtRef.current)
  const pauseSpotlightEmbed = () => pauseYoutubeEmbed(spotlightYtRef.current)

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
            <p className="catalog-page-sub">{WATCH_LP_META.sub}</p>
          </header>

          {catalogLoadError ? <p className="watch-lp__load-error">{catalogLoadError}</p> : null}

          {youtubeVideos === null && !catalogLoadError ? (
            <p className="watch-lp__loading" aria-live="polite">
              Loading videos…
            </p>
          ) : (
            <section
              className="catalog-page-shell__section watch-lp__section watch-lp__spotlight"
              aria-labelledby="watch-lp-spotlight-heading"
            >
              <h2 id="watch-lp-spotlight-heading" className="catalog-section-title">
                What&apos;s new?
              </h2>
              <p className="catalog-lp-section-intro">Most recent clips first. Tap a thumbnail to swap the player.</p>

              <CatalogVideoSpotlight
                className="watch-lp__spotlight-player catalog-video-spotlight--compact-rail"
                featured={featuredSpotlight}
                rail={railSpotlight}
                activeVideoId={featuredVideo?.video_id ?? null}
                onSelectVideo={setPickedFeaturedId}
                iframeRef={spotlightYtRef}
                onBeforePlay={pausePlaylistEmbed}
                railEyebrow="More recent clips"
                renderRailCell={(video, isActive, onSelect) => {
                  const source = recentRail.shown.find((v) => v.video_id === video.videoId)
                  if (!source) return null
                  const title = (source.lyrics_title || source.title || 'Video').trim()
                  const railLines = watchLpVideoRailThumbLines(source)
                  return (
                    <CatalogVideoSpotlightRailThumb
                      thumbnailUrl={source.thumbnail_url}
                      sutra={railLines.sutra}
                      duration={railLines.duration}
                      isActive={isActive}
                      onSelect={onSelect}
                      ariaLabel={`${title}${isActive ? ' (now showing)' : ''}`}
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
            </section>
          )}

          {playlists === null && !catalogLoadError ? (
            <p className="watch-lp__loading" aria-live="polite">
              Loading playlists…
            </p>
          ) : (
            <section
              className="catalog-page-shell__section watch-lp__section watch-lp__playlists-block"
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
                  songbookSlug={activePlaylistSongbookSlug}
                />
              </div>

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
              />

              {visiblePlaylists.length ? (
                <ul className="watch-lp__playlist-grid" aria-live="polite">
                  {visiblePlaylists.map((pl) => (
                    <WatchLpPlaylistThumb
                      key={pl.playlist_id}
                      playlist={pl}
                      durationByName={playlistDurationByName}
                      isActive={pl.playlist_id === activePlaylistId}
                      onSelect={() => setPickedPlaylistId(pl.playlist_id)}
                    />
                  ))}
                </ul>
              ) : (
                <p className="watch-lp__empty">No playlists match this filter.</p>
              )}

              {sortedPlaylists.length > WATCH_LP_PLAYLIST_GRID_LIMIT && !showAllPlaylists ? (
                <button
                  type="button"
                  className="catalog-section-cta watch-lp__load-more"
                  onClick={() => setShowAllPlaylists(true)}
                >
                  Load all {sortedPlaylists.length} playlists
                </button>
              ) : null}
            </section>
          )}

          <div className="watch-lp__phase3-note" aria-labelledby="watch-lp-phase3-heading">
            <p id="watch-lp-phase3-heading" className="watch-lp__phase3-label">
              Phase 3 · persistent YT player
            </p>
            <p className="watch-lp__phase3-body">
              Desktop-only queue that survives route changes. Same GO gate as the SoundCloud persistent player.
            </p>
          </div>

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
