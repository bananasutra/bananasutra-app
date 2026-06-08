import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { catalogDataFileUrl, fetchCatalogData } from './catalogDataUrl'
import { featuredYoutubeSongPageHref } from './featuredYoutubeSongPageHref'
import { GlobalFooter } from './GlobalFooter'
import { GlobalHeader } from './GlobalHeader'
import { useSongCatalogBrowse } from './generatedData'
import { ScrollRail } from './ScrollRail'
import { canonicalPathForRoute } from './seoPaths'
import { songCatalogLinkTo } from './songPaths'
import type { YouTubeCatalogVideo, YouTubePlaylistCatalogItem } from './types'
import { renderPageMeta } from './usePageMeta'
import { useSyncCatalogHeaderHeight } from './useSyncCatalogHeaderHeight'
import { WatchLpBertrandTail } from './WatchLpBertrandTail'
import { WatchLpFacetBar } from './WatchLpFacetBar'
import { WatchLpPlaylistEmbed } from './WatchLpPlaylistEmbed'
import { WatchLpPlaylistThumb } from './WatchLpPlaylistThumb'
import { WatchLpVideoPickThumb } from './WatchLpVideoPickThumb'
import {
  dedupeWatchPlaylists,
  pickFilteredWatchPlaylists,
  pickRecentClipsRail,
  pickSpotlightHero,
  pickVisibleWatchPlaylists,
  WATCH_LP_META,
  watchLpRecentClipsNote,
  type WatchLpSutraFilter,
} from './watchLpData'
import { dedupeYoutubeVideosByVideoId, flattenYoutubeCatalogVideos } from './youtubeCatalogFlat'
import { youtubeAspectRatioFromFormat } from './youtubeAspectRatio'
import { YoutubeEmbeddedPlayer } from './YouTubeEmbed'
import './CatalogApp.css'
import './catalog-page-shell.css'
import './WatchLpPage.css'

export function WatchLpPage() {
  const pageRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLElement>(null)
  const { data: songCatalogRows } = useSongCatalogBrowse()
  const [youtubeVideos, setYoutubeVideos] = useState<YouTubeCatalogVideo[] | null>(null)
  const [playlists, setPlaylists] = useState<YouTubePlaylistCatalogItem[] | null>(null)
  const [catalogLoadError, setCatalogLoadError] = useState<string | null>(null)
  const [activeSutra, setActiveSutra] = useState<WatchLpSutraFilter>('ALL')
  const [activeGenre, setActiveGenre] = useState('ALL')
  const [pickedFeaturedId, setPickedFeaturedId] = useState<string | null>(null)
  const [pickedPlaylistId, setPickedPlaylistId] = useState<string | null>(null)

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
  const visiblePlaylists = useMemo(() => pickVisibleWatchPlaylists(filteredPlaylists), [filteredPlaylists])

  const activePlaylist = useMemo(() => {
    if (!visiblePlaylists.shown.length) return null
    if (pickedPlaylistId && visiblePlaylists.shown.some((pl) => pl.playlist_id === pickedPlaylistId)) {
      return allPlaylists.find((pl) => pl.playlist_id === pickedPlaylistId) ?? visiblePlaylists.shown[0]
    }
    return visiblePlaylists.shown[0]
  }, [pickedPlaylistId, visiblePlaylists.shown, allPlaylists])

  const activePlaylistId = activePlaylist?.playlist_id ?? null

  const featuredInApp = featuredVideo ? inAppIds.has((featuredVideo.lyrics_id || '').trim()) : false
  const featuredSongHref = featuredVideo
    ? featuredYoutubeSongPageHref(featuredVideo, featuredInApp)
    : null
  const featuredTitle = (featuredVideo?.lyrics_title || featuredVideo?.title || '').trim()

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
            <p className="catalog-page-sub catalog-page-shell__measure">{WATCH_LP_META.sub}</p>
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
                What&apos;s new
              </h2>

              <div className="watch-lp__spotlight-unit">
                <div className="watch-lp__spotlight-stage">
                  {featuredVideo ? (
                    <article className="watch-lp__now-playing">
                      <YoutubeEmbeddedPlayer
                        key={featuredVideo.video_id}
                        videoId={featuredVideo.video_id}
                        title={featuredTitle || 'Featured video'}
                        embedWrapperClassName="watch-lp__featured-embed"
                        embedWrapperStyle={{ aspectRatio: youtubeAspectRatioFromFormat(featuredVideo.format) }}
                        iframeClassName="watch-lp__featured-iframe"
                        facadeUntilClick
                        facadePosterEager
                        posterWidth={640}
                        outboundFooterClassName="watch-lp__featured-yt-outbound"
                      />
                      <div className="watch-lp__spotlight-detail">
                        <h3 className="watch-lp__spotlight-title">
                          {featuredInApp ? (
                            <Link
                              className="watch-lp__spotlight-title-link"
                              to={songCatalogLinkTo(featuredTitle, featuredVideo.url_slug, { section: 'video' })}
                            >
                              {featuredTitle}
                            </Link>
                          ) : (
                            <a
                              className="watch-lp__spotlight-title-link"
                              href={featuredVideo.yt_url}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              {featuredTitle}
                            </a>
                          )}
                        </h3>
                        {(featuredVideo.lyrics_summary || '').trim() ? (
                          <p className="watch-lp__spotlight-summary">{featuredVideo.lyrics_summary?.trim()}</p>
                        ) : null}
                        {featuredSongHref ? (
                          <Link className="catalog-section-cta catalog-section-cta--inline" to={featuredSongHref}>
                            Song page →
                          </Link>
                        ) : null}
                      </div>
                    </article>
                  ) : (
                    <p className="watch-lp__empty">No recent clips in the catalog.</p>
                  )}
                </div>

                {recentRail.shown.length ? (
                  <div className="watch-lp__spotlight-rail">
                    <p className="watch-lp__spotlight-rail-eyebrow">More recent clips</p>
                    <ScrollRail className="watch-lp__scroll-rail" variant="fade">
                      <ul className="watch-lp__picks-rail" aria-label="Recent video picks">
                        {recentRail.shown.map((video) => {
                          const lid = (video.lyrics_id || '').trim()
                          return (
                            <li key={video.video_id} className="watch-lp__picks-rail-cell">
                              <WatchLpVideoPickThumb
                                video={video}
                                inApp={Boolean(lid && inAppIds.has(lid))}
                                isActive={video.video_id === featuredVideo?.video_id}
                                onSelect={() => setPickedFeaturedId(video.video_id)}
                              />
                            </li>
                          )
                        })}
                      </ul>
                    </ScrollRail>
                  </div>
                ) : null}
              </div>

              <p className="watch-lp__spotlight-footer">
                {recentRail.total ? (
                  <span className="watch-lp__grid-note">{watchLpRecentClipsNote(recentRail.total, recentRail.shown.length)}</span>
                ) : null}
                <Link className="catalog-section-cta watch-lp__spotlight-browse" to="/videos/">
                  Browse all videos →
                </Link>
              </p>
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
                Keep watching
              </h2>
              <p className="watch-lp__section-intro">
                The longer form. Playlists organized by story or by sound. Pick one and stay a while.
              </p>

              <WatchLpFacetBar
                playlists={allPlaylists}
                activeSutra={activeSutra}
                activeGenre={activeGenre}
                shownCount={visiblePlaylists.shown.length}
                totalCount={visiblePlaylists.total}
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

              <div className="watch-lp__playlists-player">
                <WatchLpPlaylistEmbed playlist={activePlaylist} />
              </div>

              {visiblePlaylists.shown.length ? (
                <ul className="watch-lp__playlist-grid" aria-live="polite">
                  {visiblePlaylists.shown.map((pl) => (
                    <WatchLpPlaylistThumb
                      key={pl.playlist_id}
                      playlist={pl}
                      isActive={pl.playlist_id === activePlaylistId}
                      onSelect={() => setPickedPlaylistId(pl.playlist_id)}
                    />
                  ))}
                </ul>
              ) : (
                <p className="watch-lp__empty">No playlists match this filter.</p>
              )}
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
