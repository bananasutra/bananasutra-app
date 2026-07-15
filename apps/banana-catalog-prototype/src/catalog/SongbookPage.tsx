import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { GlobalFooter } from './GlobalFooter'
import { GlobalHeader } from './GlobalHeader'
import { hasListenerCatalogMedia, isLyricsOnlySong } from './listenerCatalog'
import { browsePathWithQuery, canonicalPathForRoute } from './seoPaths'
import { ShareButton } from './ShareButton'
import { songbookShareUrl } from './shareUrl'
import { songCatalogPath, songbookCatalogPath } from './songPaths'
import { songbookBySlug } from './songbooks'
import { SoundCloudPassthroughEmbed } from './SoundCloudPassthroughEmbed'
import { sutraClassName } from './sutraTheme'
import { buildBrowsePath, buildBrowsePathForFacet } from './urlState'
import { emptyFilterState, type SongCatalogItem, type SongbookMemberSong } from './types'
import { buildSrcset, coverImageUrl } from '../seo/imageUrl'
import { musicAlbumJsonLd, songbookItemListJsonLd } from '../seo/jsonLd'
import { renderPageMeta } from './usePageMeta'
import { CatalogNotFoundPage } from './CatalogNotFoundPage'
import { syncCatalogHeaderHeightNow, useSyncCatalogHeaderHeight } from './useSyncCatalogHeaderHeight'
import { useSongCatalog } from './generatedData'
import { SongThumbCard } from './SongThumbCard'
import { SongbookPlaylistMetaLine } from './SongbookPlaylistMetaLine'
import { catalogDataFileUrl, fetchCatalogData } from './catalogDataUrl'
import { primaryGenreTokenFromSongbookTitle } from './songbookGenreToken'
import { youtubePlaylistForSongbook } from './songbookYoutubeMatch'
import {
  buildYoutubePlaylistDurationByName,
  dedupeYoutubeVideosByVideoId,
  flattenYoutubeCatalogVideos,
} from './youtubeCatalogFlat'
import { CatalogMediaOutbound } from './CatalogMediaOutbound'
import { WatchLpPlaylistEmbed } from './WatchLpPlaylistEmbed'
import {
  useExclusiveYoutubeSoundcloudPlayback,
  type ExclusiveYoutubeSoundcloudControls,
} from './useExclusiveYoutubeSoundcloudPlayback'
import { usePlayerQueueRegistrar } from './playerQueue/playerQueueRegistrarContext'
import type { YouTubeCatalogVideo, YouTubePlaylistCatalogItem } from './types'
import './CatalogApp.css'
import './catalog-page-shell.css'
import './ListenLpPage.css'
import './SongDetail.css'
import './SongbooksPage.css'

function splitCsvTokens(value: string): string[] {
  return value
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean)
}

function sortSongbookMembersByPopularity(rows: SongbookMemberSong[]): SongbookMemberSong[] {
  return [...rows].sort((a, b) => {
    if (b.aggregate_play_count !== a.aggregate_play_count) return b.aggregate_play_count - a.aggregate_play_count
    if (b.aggregate_like_count !== a.aggregate_like_count) return b.aggregate_like_count - a.aggregate_like_count
    return a.lyrics_title.localeCompare(b.lyrics_title)
  })
}

/** `/tracks` filtered by primary genre, sorted by likes (stable deep-link for genre best-of pages). */
function tracksHrefForPrimaryGenre(token: string): string {
  const q = new URLSearchParams()
  q.set('primary_genre', token)
  q.set('tsort', 'likes')
  return browsePathWithQuery('/tracks', q.toString())
}

export function SongbookPage() {
  const { slug = '' } = useParams()
  const location = useLocation()
  const pageRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLElement>(null)
  const youtubeExclusiveRef = useRef<HTMLIFrameElement>(null)
  const soundcloudExclusiveWrapRef = useRef<HTMLDivElement>(null)
  const songbookSoundcloudWrapRefs = useMemo(() => [soundcloudExclusiveWrapRef] as const, [])
  const exclusivePlaybackRef = useRef<ExclusiveYoutubeSoundcloudControls | null>(null)
  const { persistentScEmbedWrapRef, usePersistentPlayback } = usePlayerQueueRegistrar()
  const [youtubeIframeGen, setYoutubeIframeGen] = useState(0)
  const { data: songCatalogRows, error: catalogError, loading: catalogLoading } = useSongCatalog()
  const [youtubePlaylists, setYoutubePlaylists] = useState<YouTubePlaylistCatalogItem[]>([])
  const [youtubeVideos, setYoutubeVideos] = useState<YouTubeCatalogVideo[] | null>(null)

  const songCatalogByLyricsId = useMemo(() => {
    const rows = songCatalogRows ?? []
    return new Map<string, SongCatalogItem>(rows.map((s) => [s.lyrics_id, s]))
  }, [songCatalogRows])

  const trimmedSlug = slug.trim()
  const songbook = useMemo(() => songbookBySlug(trimmedSlug), [trimmedSlug])
  const pageMeta = renderPageMeta({
    title: songbook ? `${songbook.songbook} · Songbook` : 'Songbook not found',
    description: songbook
      ? (songbook.description || '').trim() || `${songbook.songbook} — a curated BANANASUTRA songbook.`
      : undefined,
    path: songbook ? songbookCatalogPath(trimmedSlug) : undefined,
    jsonLd: songbook
      ? (songbook.songbook_type || '').toLowerCase() === 'collection' ||
        (songbook.songbook_type || '').toLowerCase() === 'genre'
        ? musicAlbumJsonLd(songbook.songbook, trimmedSlug, songbook.description || '')
        : songbookItemListJsonLd(
            songbook.songbook,
            trimmedSlug,
            (songbook.member_songs ?? []).map((s) => s.lyrics_title),
          )
      : undefined,
  })
  useSyncCatalogHeaderHeight(pageRef, headerRef, [slug, songbook?.songbook, songbook?.song_count])

  const sutraTokens = useMemo(() => splitCsvTokens(songbook?.sutras ?? ''), [songbook?.sutras])
  const topicTokens = useMemo(() => splitCsvTokens(songbook?.topics_primary ?? ''), [songbook?.topics_primary])
  const sortedMemberSongs = useMemo(
    () => sortSongbookMembersByPopularity(songbook?.member_songs ?? []),
    [songbook?.member_songs],
  )
  /** Under the playlist embed, only list songs that have a listener path (SC / YT / EP / catalog URL). */
  const playbackMemberSongs = useMemo(
    () =>
      sortedMemberSongs.filter((song) => {
        const row = songCatalogByLyricsId.get(song.lyrics_id)
        return row ? hasListenerCatalogMedia(row) : false
      }),
    [sortedMemberSongs, songCatalogByLyricsId],
  )
  const lyricsOnlyMemberSongs = useMemo(
    () =>
      sortedMemberSongs.filter((song) => {
        const row = songCatalogByLyricsId.get(song.lyrics_id)
        return row ? isLyricsOnlySong(row) : false
      }),
    [sortedMemberSongs, songCatalogByLyricsId],
  )
  const playlistIsSet = (songbook?.playlist_url ?? '').includes('/sets/')

  const songbookTypeKey = (songbook?.songbook_type ?? '').trim().toLowerCase()
  const heroFacetTopics = useMemo(() => {
    const secondarySutra = (songbook?.secondary_sutra ?? '').trim()
    const topics = topicTokens.filter((topic) => topic.trim())
    const rows: { key: string; label: string; href: string }[] = []
    if (secondarySutra) {
      rows.push({
        key: `secondary-sutra-${secondarySutra}`,
        label: secondarySutra,
        href: buildBrowsePathForFacet('sutra', secondarySutra),
      })
    }
    for (const topic of topics) {
      rows.push({
        key: `topic-${topic}`,
        label: topic,
        href: buildBrowsePathForFacet('topic', topic),
      })
    }
    return rows
  }, [songbook?.secondary_sutra, topicTokens])
  useEffect(() => {
    let cancelled = false
    fetchCatalogData(catalogDataFileUrl('youtube_playlists_catalog.json'))
      .then(async (response) => {
        if (!response.ok) throw new Error('youtube playlists fetch failed')
        const rows = (await response.json()) as YouTubePlaylistCatalogItem[]
        if (cancelled) return
        setYoutubePlaylists(rows)
      })
      .catch(() => {
        if (cancelled) return
        setYoutubePlaylists([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  const songsBrowseFindHref = useMemo(
    () =>
      songbook
        ? buildBrowsePath('newest', emptyFilterState(), songbook.songbook.trim(), 'all', 1)
        : canonicalPathForRoute('/songs'),
    [songbook],
  )

  const relatedCount = playbackMemberSongs.length
  const lyricsOnlyCount = lyricsOnlyMemberSongs.length
  const relatedSongsHeading = relatedCount === 1 ? '1 related song' : `${relatedCount} related songs`
  const lyricsOnlyHeading =
    lyricsOnlyCount === 1 ? '1 lyrics-only song' : `${lyricsOnlyCount} lyrics-only songs`
  const hideEmptyGenreOrCollectionRelated =
    (songbookTypeKey === 'genre' || songbookTypeKey === 'collection') && relatedCount === 0
  const genrePrimaryToken =
    songbook && songbookTypeKey === 'genre' ? primaryGenreTokenFromSongbookTitle(songbook.songbook) : null
  const genreTracksBrowseHref = genrePrimaryToken ? tracksHrefForPrimaryGenre(genrePrimaryToken) : null
  const songbookYoutubePlaylist = useMemo(() => {
    if (!songbook || youtubePlaylists.length === 0) return null
    return youtubePlaylistForSongbook(songbook, youtubePlaylists)
  }, [songbook, youtubePlaylists])

  useEffect(() => {
    if (!songbookYoutubePlaylist) {
      setYoutubeVideos(null)
      return
    }
    let cancelled = false
    void flattenYoutubeCatalogVideos()
      .then((rows) => {
        if (cancelled) return
        setYoutubeVideos(dedupeYoutubeVideosByVideoId(rows))
      })
      .catch(() => {
        if (cancelled) return
        setYoutubeVideos(null)
      })
    return () => {
      cancelled = true
    }
  }, [songbookYoutubePlaylist?.playlist_id])

  const playlistDurationByName = useMemo(
    () => (youtubeVideos ? buildYoutubePlaylistDurationByName(youtubeVideos) : new Map<string, number>()),
    [youtubeVideos],
  )

  const songbookExclusivePlaybackEnabled = Boolean(
    !catalogLoading &&
      songCatalogRows != null &&
      songbook &&
      (songbook.playlist_url || '').trim() &&
      songbookYoutubePlaylist,
  )

  useExclusiveYoutubeSoundcloudPlayback({
    youtubeIframeRef: youtubeExclusiveRef,
    soundcloudWrapRefs: songbookSoundcloudWrapRefs,
    persistentScWrapRef: usePersistentPlayback ? persistentScEmbedWrapRef : undefined,
    enabled: songbookExclusivePlaybackEnabled,
    controlsRef: exclusivePlaybackRef,
    syncKey: `${slug}|${songbookYoutubePlaylist?.playlist_id ?? ''}|${(songbook?.playlist_url ?? '').trim()}|yt:${youtubeIframeGen}`,
  })

  /** Songbook JSON is sync; only grids need the song catalog. Keep hero on first paint (same idea as /songs/). */
  useLayoutEffect(() => {
    if (!songbook) return
    const anchor = () => {
      syncCatalogHeaderHeightNow(pageRef, headerRef)
      window.scrollTo(0, 0)
    }
    anchor()
    requestAnimationFrame(() => {
      anchor()
      requestAnimationFrame(anchor)
    })
  }, [location.pathname, slug, songbook?.songbook])

  if (!catalogLoading && (catalogError || songCatalogRows === null)) {
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

  if (!songbook) {
    return <CatalogNotFoundPage />
  }

  return (
    <div ref={pageRef} className="catalog catalog-page catalog-page--shell">
      {pageMeta}
      <GlobalHeader ref={headerRef} />
      <div className="catalog-page__main">
        <main id="main-content" className="songbooks-page songbooks-page--detail catalog-layout-shell">
            <nav className="catalog-breadcrumbs" aria-label="Breadcrumb">
              <Link to="/" className="catalog-breadcrumbs__link">
                Home
              </Link>
              <span className="catalog-breadcrumbs__sep" aria-hidden>
                /
              </span>
              <Link to={canonicalPathForRoute('/songbooks')} className="catalog-breadcrumbs__link">
                Songbooks
              </Link>
              <span className="catalog-breadcrumbs__sep" aria-hidden>
                /
              </span>
              <span className="catalog-breadcrumbs__current" aria-current="page">{songbook.songbook}</span>
            </nav>

            <header className="songbooks-page__hero songbooks-page__hero--detail">
              <div className="songbooks-page__hero-art-wrap">
                {songbook.playlist_artwork_url ? (
                  <picture>
                    <source
                      srcSet={buildSrcset(songbook.playlist_artwork_url)}
                      sizes="(max-width: 640px) 100vw, 640px"
                      type="image/webp"
                    />
                    <img
                      className="songbooks-page__hero-art"
                      src={coverImageUrl(songbook.playlist_artwork_url, { width: 400 })}
                      alt=""
                      width={320}
                      height={320}
                      loading="eager"
                      fetchPriority="high"
                      decoding="sync"
                    />
                  </picture>
                ) : (
                  <div className="songbooks-page__hero-art songbooks-page__hero-art--fallback" aria-hidden>
                    🍌
                  </div>
                )}
              </div>
              <div className="song-detail-hero-text songbooks-page__hero-text--detail">
                <h1 className="catalog-page-h1 songbooks-page__hero-title">{songbook.songbook}</h1>
                <div className="song-detail-hero-actions" role="group" aria-label="Songbook actions">
                  <ShareButton
                    variant="icon"
                    className="song-detail-hero-action"
                    url={songbookShareUrl(trimmedSlug)}
                    title={songbook.songbook}
                    text={`Listen to "${songbook.songbook}" on Bananasutra`}
                  />
                </div>
                {songbook.description ? <p className="songbooks-page__hero-description">{songbook.description}</p> : null}
                {sutraTokens.length > 0 || heroFacetTopics.length > 0 ? (
                  <ul className="song-detail-secondary-meta songbooks-page__hero-meta" aria-label="Songbook metadata">
                    {sutraTokens.map((sutra) => (
                      <li key={`sutra-${sutra}`} className="song-detail-secondary-meta-item">
                        <Link
                          className="song-detail-secondary-link"
                          to={buildBrowsePathForFacet('sutra', sutra)}
                        >
                          <span className={`catalog-facet-sutra-name ${sutraClassName(sutra)}`}>{sutra}</span>
                        </Link>
                      </li>
                    ))}
                    {heroFacetTopics.map((facet) => (
                      <li key={facet.key} className="song-detail-secondary-meta-item">
                        <Link className="song-detail-secondary-link" to={facet.href}>
                          {facet.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </header>

            {songbook.playlist_url ? (
              <section
                className="catalog-page-shell__section songbooks-page__playlist"
                aria-labelledby="songbook-playlist-heading"
              >
                <h2 id="songbook-playlist-heading" className="catalog-section-title">
                  Listen to songbook
                </h2>
                <SongbookPlaylistMetaLine book={songbook} className="songbooks-page__section-playlist-meta" />
                <SoundCloudPassthroughEmbed
                  ref={soundcloudExclusiveWrapRef}
                  scUrl={songbook.playlist_url}
                  title={`SoundCloud playlist: ${songbook.songbook}`}
                  mode={playlistIsSet ? 'list' : 'visual'}
                  height={playlistIsSet ? 760 : 680}
                  loading="eager"
                />
                <CatalogMediaOutbound href={songbook.playlist_url} label="Open on SoundCloud ↗" />
              </section>
            ) : null}

            {songbookYoutubePlaylist ? (
              <section
                className="catalog-page-shell__section songbooks-page__yt-playlist"
                aria-labelledby="songbook-yt-playlist-heading"
              >
                <h2 id="songbook-yt-playlist-heading" className="catalog-section-title">
                  BANANASUTRA cinema
                </h2>
                <p className="catalog-lp-section-intro">
                  The video version. Same songbook, eyes open.
                </p>
                <WatchLpPlaylistEmbed
                  playlist={songbookYoutubePlaylist}
                  durationByName={playlistDurationByName}
                  iframeRef={youtubeExclusiveRef}
                  onBeforePlay={() => {
                    exclusivePlaybackRef.current?.pauseAllSoundcloud()
                    setYoutubeIframeGen((g) => g + 1)
                  }}
                />
              </section>
            ) : null}

            {songbookTypeKey === 'genre' && relatedCount === 0 && genreTracksBrowseHref ? (
              <section
                className="catalog-page-shell__section songbooks-page__genre-tracks"
                aria-labelledby="songbook-genre-tracks-heading"
              >
                <h2 id="songbook-genre-tracks-heading" className="catalog-section-title">
                  Matching tracks
                </h2>
                <p className="songbooks-page__genre-tracks-copy">
                  <Link to={genreTracksBrowseHref} className="songbooks-page__songs-browse-link">
                    Browse {genrePrimaryToken} tracks on /tracks (sorted by likes)
                  </Link>
                </p>
              </section>
            ) : null}

            {songbookTypeKey === 'genre' && relatedCount === 0 && !genreTracksBrowseHref ? (
              <section
                className="catalog-page-shell__section songbooks-page__genre-fallback"
                aria-labelledby="songbook-genre-fallback-heading"
              >
                <h2 id="songbook-genre-fallback-heading" className="catalog-section-title">
                  Browse catalog
                </h2>
                <p className="songbooks-page__playback-empty songbooks-page__playback-empty--browse">
                  <Link to={songsBrowseFindHref} className="songbooks-page__songs-browse-link">
                    Browse matching songs on /songs
                  </Link>
                </p>
              </section>
            ) : null}

            {!hideEmptyGenreOrCollectionRelated ? (
              <section
                className="catalog-page-shell__section songbooks-page__songs"
                aria-labelledby="songbook-songs-heading"
              >
                <h2 id="songbook-songs-heading" className="catalog-section-title">
                  {catalogLoading ? 'Related songs' : relatedSongsHeading}
                </h2>
                {catalogLoading ? (
                  <p className="songbooks-page__playback-empty">Loading song catalog…</p>
                ) : playbackMemberSongs.length === 0 ? (
                  songbookTypeKey === 'genre' ? (
                    <p className="songbooks-page__playback-empty songbooks-page__playback-empty--browse">
                      <Link to={songsBrowseFindHref} className="songbooks-page__songs-browse-link">
                        Browse matching songs on /songs
                      </Link>
                    </p>
                  ) : (
                    <p className="songbooks-page__playback-empty">
                      No catalog songs with in-app playback are listed for this songbook yet. Lyrics-only pieces may
                      still be tagged in Airtable. Browse <Link to={canonicalPathForRoute('/words')}>Words</Link> or{' '}
                      <Link to={canonicalPathForRoute('/songs')}>Songs</Link>.
                    </p>
                  )
                ) : (
                  <ul className="song-thumb-grid song-thumb-grid--home">
                    {playbackMemberSongs.map((song) => {
                      const cat = songCatalogByLyricsId.get(song.lyrics_id)
                      const sutra = cat?.sutra?.trim() ?? ''
                      return (
                        <li key={song.lyrics_id} className="song-thumb-grid__cell">
                          <SongThumbCard
                            to={songCatalogPath(song.lyrics_title, song.url_slug)}
                            coverUrl={song.cover_image_url}
                            title={song.lyrics_title}
                            metaLabel={sutra || undefined}
                          />
                        </li>
                      )
                    })}
                  </ul>
                )}
              </section>
            ) : null}

            {!hideEmptyGenreOrCollectionRelated && lyricsOnlyCount > 0 ? (
              <section
                className="catalog-page-shell__section songbooks-page__lyrics-only-songs"
                aria-labelledby="songbook-lyrics-only-heading"
              >
                <h2 id="songbook-lyrics-only-heading" className="catalog-section-title">
                  {catalogLoading ? 'Lyrics-only songs' : lyricsOnlyHeading}
                </h2>
                <p className="catalog-lp-section-intro">
                  Songs in this songbook with lyrics on file, no audio or video linked yet.
                </p>
                {catalogLoading ? (
                  <p className="songbooks-page__playback-empty">Loading song catalog…</p>
                ) : (
                  <ul className="song-thumb-grid song-thumb-grid--home">
                    {lyricsOnlyMemberSongs.map((song) => {
                      const cat = songCatalogByLyricsId.get(song.lyrics_id)
                      const sutra = cat?.sutra?.trim() ?? ''
                      return (
                        <li key={song.lyrics_id} className="song-thumb-grid__cell">
                          <SongThumbCard
                            to={songCatalogPath(song.lyrics_title, song.url_slug)}
                            coverUrl={song.cover_image_url}
                            title={song.lyrics_title}
                            metaLabel={sutra || undefined}
                          />
                        </li>
                      )
                    })}
                  </ul>
                )}
              </section>
            ) : null}
          </main>
      </div>
      <GlobalFooter />
    </div>
  )
}
