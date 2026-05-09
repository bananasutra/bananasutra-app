import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { GlobalFooter } from './GlobalFooter'
import { GlobalHeader } from './GlobalHeader'
import { hasListenerCatalogMedia } from './listenerCatalog'
import { songCatalogPath } from './songPaths'
import { songbookBySlug } from './songbooks'
import { SoundCloudEmbed } from './SoundCloudEmbed'
import { sutraClassName } from './sutraTheme'
import { buildBrowsePath, buildBrowsePathForFacet } from './urlState'
import { emptyFilterState, type SongCatalogItem, type SongbookMemberSong } from './types'
import { usePageMeta } from './usePageMeta'
import { useSyncCatalogHeaderHeight } from './useSyncCatalogHeaderHeight'
import { useSongCatalog } from './generatedData'
import { SongThumbCard } from './SongThumbCard'
import { dedupeYoutubeVideosByVideoId, flattenYoutubeCatalogVideos } from './youtubeCatalogFlat'
import { youtubeAspectRatioFromFormat } from './youtubeAspectRatio'
import { youtubePrivacyEmbedSrc } from './youtubeEmbedUrl'
import { featuredYoutubeSongPageHref } from './featuredYoutubeSongPageHref'
import type { YouTubeCatalogVideo } from './types'
import './CatalogApp.css'
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

function pickRandomVideo(videos: YouTubeCatalogVideo[]): YouTubeCatalogVideo | null {
  if (videos.length === 0) return null
  const index = Math.floor(Math.random() * videos.length)
  return videos[index] ?? null
}

/** IA §3.4-style line; uses `songbook_type` from SONGBOOKs (not SC playlist internal typing). */
function songbookKindBadgeLabel(songbookType: string | undefined): string | null {
  switch ((songbookType ?? '').trim().toLowerCase()) {
    case 'sutra':
      return 'SONGBOOK · SUTRA'
    case 'collection':
      return 'SONGBOOK · COLLECTION'
    case 'genre':
      return 'SONGBOOK · GENRE'
    case 'language':
      return 'SONGBOOK · LANGUAGE'
    default:
      return null
  }
}

export function SongbookPage() {
  const { slug = '' } = useParams()
  const pageRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLElement>(null)
  const { data: songCatalogRows, error: catalogError, loading: catalogLoading } = useSongCatalog()
  const [youtubeVideos, setYoutubeVideos] = useState<YouTubeCatalogVideo[]>([])

  const songCatalogByLyricsId = useMemo(() => {
    const rows = songCatalogRows ?? []
    return new Map<string, SongCatalogItem>(rows.map((s) => [s.lyrics_id, s]))
  }, [songCatalogRows])

  const songbook = useMemo(() => songbookBySlug(slug), [slug])
  usePageMeta({
    title: songbook ? `${songbook.songbook} · Songbook` : 'Songbook not found',
    description: songbook
      ? (songbook.description || '').trim() || `${songbook.songbook} — a curated BANANASUTRA songbook.`
      : undefined,
    path: songbook ? `/songbooks/${slug.trim()}` : undefined,
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
  const playlistIsSet = (songbook?.playlist_url ?? '').includes('/sets/')
  const songbookKindLabel = songbook ? songbookKindBadgeLabel(songbook.songbook_type) : null

  const songbookTypeKey = (songbook?.songbook_type ?? '').trim().toLowerCase()
  const showHeroSongCount = songbookTypeKey !== 'sutra' && songbookTypeKey !== 'language'
  const isSutraSongbook = songbookTypeKey === 'sutra'

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

  const songsBrowseFindHref = useMemo(
    () =>
      songbook
        ? buildBrowsePath('newest', emptyFilterState(), songbook.songbook.trim(), 'all', 1)
        : '/songs',
    [songbook],
  )

  const relatedCount = playbackMemberSongs.length
  const relatedSongsHeading = relatedCount === 1 ? '1 related song' : `${relatedCount} related songs`
  const hideRelatedSongsSection = songbookTypeKey === 'collection' && relatedCount === 0
  const memberLyricsIdSet = useMemo(
    () => new Set((songbook?.member_lyrics_ids ?? []).map((id) => (id || '').trim()).filter(Boolean)),
    [songbook?.member_lyrics_ids],
  )
  const featuredSongbookVideos = useMemo(() => {
    if (!isSutraSongbook || memberLyricsIdSet.size === 0) return []
    return youtubeVideos.filter(
      (v) => memberLyricsIdSet.has((v.lyrics_id || '').trim()) && Boolean(v.video_featured) && Boolean(v.can_embed),
    )
  }, [isSutraSongbook, memberLyricsIdSet, youtubeVideos])
  const featuredSongbookVideo = useMemo(() => pickRandomVideo(featuredSongbookVideos), [featuredSongbookVideos])
  const featuredSongbookVideoSummary = (featuredSongbookVideo?.lyrics_summary || '').trim() || (
    featuredSongbookVideo?.lyrics_id ? (songCatalogByLyricsId.get(featuredSongbookVideo.lyrics_id)?.summary_short || '').trim() : ''
  )

  const featuredSongbookSongPageHref = useMemo(() => {
    if (!featuredSongbookVideo) return null
    const id = (featuredSongbookVideo.lyrics_id || '').trim()
    return featuredYoutubeSongPageHref(featuredSongbookVideo, Boolean(id && songCatalogByLyricsId.has(id)))
  }, [featuredSongbookVideo, songCatalogByLyricsId])

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

  if (catalogError || songCatalogRows === null) {
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

  return (
    <div ref={pageRef} className="catalog catalog-page catalog-page--shell">
      <GlobalHeader ref={headerRef} />
      <div className="catalog-page__main">
        {!songbook ? (
          <main id="main-content" className="songbooks-page songbooks-page--missing">
            <p className="songbooks-page__missing-title">Songbook not found.</p>
            <p className="songbooks-page__missing-sub">The link may be outdated or this songbook has not been generated yet.</p>
            <Link to="/songbooks" className="songbooks-page__back-link">
              ← Back to songbooks
            </Link>
          </main>
        ) : (
          <main id="main-content" className="songbooks-page">
            <nav className="catalog-breadcrumbs" aria-label="Breadcrumb">
              <Link to="/" className="catalog-breadcrumbs__link">
                Home
              </Link>
              <span className="catalog-breadcrumbs__sep" aria-hidden>
                /
              </span>
              <Link to="/songbooks" className="catalog-breadcrumbs__link">
                Songbooks
              </Link>
              <span className="catalog-breadcrumbs__sep" aria-hidden>
                /
              </span>
              <span className="catalog-breadcrumbs__current" aria-current="page">{songbook.songbook}</span>
            </nav>

            <header className="songbooks-page__hero">
              {songbook.playlist_artwork_url ? (
                <img
                  className="songbooks-page__hero-art"
                  src={songbook.playlist_artwork_url}
                  alt=""
                  width={320}
                  height={320}
                />
              ) : (
                <div className="songbooks-page__hero-art songbooks-page__hero-art--fallback" aria-hidden>
                  🍌
                </div>
              )}
              <div className="songbooks-page__hero-text songbooks-page__hero-text--detail">
                <h1 className="catalog-page-h1 songbooks-page__hero-title">{songbook.songbook}</h1>
                {songbook.description ? <p className="songbooks-page__hero-description">{songbook.description}</p> : null}
                {songbookKindLabel ? (
                  <p className="songbooks-page__kind-row">
                    <span className="songbooks-page__kind-badge">{songbookKindLabel}</span>
                  </p>
                ) : null}
                {showHeroSongCount ? (
                  <p className="songbooks-page__hero-song-count">
                    {songbook.song_count === 1 ? '1 song' : `${songbook.song_count} songs`}
                  </p>
                ) : null}
                {sutraTokens.length || topicTokens.length || songbook.secondary_sutra ? (
                  <div className="songbooks-page__tags">
                    {sutraTokens.map((sutra) => (
                      <Link
                        key={`sutra-${sutra}`}
                        className={`songbooks-page__tag-link songbooks-page__tag-link--sutra catalog-meta-pill--sutra ${sutraClassName(sutra)}`.trim()}
                        to={buildBrowsePathForFacet('sutra', sutra)}
                      >
                        {sutra}
                      </Link>
                    ))}
                  </div>
                ) : null}
                {songbook.secondary_sutra || topicTokens.length ? (
                  <ul className="songbooks-page__secondary-meta" aria-label="Secondary songbook metadata">
                    {songbook.secondary_sutra ? (
                      <li className="songbooks-page__secondary-meta-item">
                        <Link className="songbooks-page__secondary-link" to={buildBrowsePathForFacet('sutra', songbook.secondary_sutra)}>
                          secondary sutra: {songbook.secondary_sutra}
                        </Link>
                      </li>
                    ) : null}
                    {topicTokens.map((topic) => (
                      <li key={`topic-${topic}`} className="songbooks-page__secondary-meta-item">
                        <Link className="songbooks-page__secondary-link" to={buildBrowsePathForFacet('topic', topic)}>
                          topic: {topic}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </header>

            {songbook.playlist_url ? (
              <section className="songbooks-page__playlist" aria-labelledby="songbook-playlist-heading">
                <h2 id="songbook-playlist-heading" className="catalog-section-title">
                  Songbook Playlist on Soundcloud
                </h2>
                <SoundCloudEmbed
                  scUrl={songbook.playlist_url}
                  title={`SoundCloud playlist: ${songbook.songbook}`}
                  mode={playlistIsSet ? 'list' : 'visual'}
                  height={playlistIsSet ? 760 : 680}
                  loading="eager"
                />
              </section>
            ) : null}

            {isSutraSongbook && featuredSongbookVideo ? (
              <section className="songbooks-page__featured-video" aria-labelledby="songbook-featured-video-heading">
                <h2 id="songbook-featured-video-heading" className="catalog-section-title">
                  Featured Video
                </h2>
                <div
                  className="songbooks-page__featured-video-embed"
                  style={{ aspectRatio: youtubeAspectRatioFromFormat(featuredSongbookVideo.format) }}
                >
                  <iframe
                    className="songbooks-page__featured-video-iframe"
                    src={youtubePrivacyEmbedSrc(featuredSongbookVideo.video_id)}
                    title={featuredSongbookVideo.lyrics_title || featuredSongbookVideo.title || 'Featured video'}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    loading="lazy"
                  />
                </div>
                <div className="songbooks-page__featured-video-copy">
                  <h3 className="songbooks-page__featured-video-title">
                    {featuredSongbookVideo.lyrics_title || featuredSongbookVideo.title}
                  </h3>
                  {featuredSongbookVideoSummary ? (
                    <p className="songbooks-page__featured-video-summary">{featuredSongbookVideoSummary}</p>
                  ) : null}
                  {featuredSongbookSongPageHref ? (
                    <div className="catalog-featured-video-song-row">
                      <Link className="catalog-song-page-cta" to={featuredSongbookSongPageHref}>
                        Song page
                      </Link>
                    </div>
                  ) : null}
                </div>
              </section>
            ) : null}

            {!hideRelatedSongsSection ? (
              <section className="songbooks-page__songs" aria-labelledby="songbook-songs-heading">
                <h2 id="songbook-songs-heading" className="songbooks-page__songs-title catalog-section-title">
                  {relatedSongsHeading}
                </h2>
                {playbackMemberSongs.length === 0 ? (
                  songbookTypeKey === 'genre' ? (
                    <p className="songbooks-page__playback-empty songbooks-page__playback-empty--browse">
                      <Link to={songsBrowseFindHref} className="songbooks-page__songs-browse-link">
                        Browse matching songs on /songs
                      </Link>
                    </p>
                  ) : (
                    <p className="songbooks-page__playback-empty">
                      No catalog songs with in-app playback are listed for this songbook yet. Lyrics-only pieces may
                      still be tagged in Airtable. Browse <Link to="/words">Words</Link> or <Link to="/songs">Songs</Link>.
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
          </main>
        )}
      </div>
      <GlobalFooter />
    </div>
  )
}
