import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { catalogDataFileUrl, fetchCatalogData } from './catalogDataUrl'
import { GlobalFooter } from './GlobalFooter'
import { GlobalHeader } from './GlobalHeader'
import { LazySoundCloudEmbed } from './LazySoundCloudEmbed'
import { ListenLpBertrandTail } from './ListenLpBertrandTail'
import { ListenLpFacetBar } from './ListenLpFacetBar'
import { ListenLpSongbookThumb } from './ListenLpSongbookThumb'
import { ListenLpTopTracks } from './ListenLpTopTracks'
import { ScrollRail } from './ScrollRail'
import { SongThumbCard } from './SongThumbCard'
import { allSongbooks } from './songbooks'
import { songbookFeaturedKickerLabel, songbookHrefFromCatalogItem } from './homePortalUtils'
import {
  pickFeaturedListenSongbook,
  pickGenreSongbooksForListenLp,
  pickLatestSongsForListenLp,
  pickSutraSongbooksForListenLp,
  pickTopTracksForListenLp,
  type ListenLpSutraFilter,
} from './listenLpData'
import { browseRowHasAudioSection, songCatalogLinkTo } from './songPaths'
import { SongbookPlaylistMetaLine } from './SongbookPlaylistMetaLine'
import { useSongCatalogBrowse } from './generatedData'
import { canonicalPathForRoute } from './seoPaths'
import type { TrackCatalogItem } from './types'
import { renderPageMeta } from './usePageMeta'
import { useSyncCatalogHeaderHeight } from './useSyncCatalogHeaderHeight'
import './CatalogApp.css'
import './catalog-page-shell.css'
import './songThumbCard.css'
import './ListenLpPage.css'

const LISTEN_LP_META = {
  title: 'Listen',
  description:
    'Press play. The catalog is already sorted into stories. Top tracks for a quick hit. Songbooks when you want a longer ride. Full lyrics on song pages.',
  lead: 'Press play. The catalog is already sorted into stories.',
  sub: 'Top tracks for a quick hit. Songbooks when you want a longer ride. Full lyrics on song pages.',
}

export function ListenLpPage() {
  const pageRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLElement>(null)
  const [activeSutra, setActiveSutra] = useState<ListenLpSutraFilter>('ALL')
  const [activeGenre, setActiveGenre] = useState('ALL')
  const [trackCatalog, setTrackCatalog] = useState<TrackCatalogItem[] | null>(null)
  const [trackLoadError, setTrackLoadError] = useState<string | null>(null)
  const { data: songCatalogRows } = useSongCatalogBrowse()

  useEffect(() => {
    let cancelled = false
    const loadCatalog = async () => {
      try {
        const r = await fetchCatalogData(catalogDataFileUrl('track_catalog.json'))
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        const rows = (await r.json()) as unknown
        if (!Array.isArray(rows)) throw new Error('Invalid track catalog payload')
        if (!cancelled) {
          setTrackLoadError(null)
          setTrackCatalog(rows as TrackCatalogItem[])
        }
      } catch {
        if (!cancelled) {
          setTrackCatalog(null)
          setTrackLoadError('Could not load track catalog data.')
        }
      }
    }
    void loadCatalog()
    return () => {
      cancelled = true
    }
  }, [])

  const songbooks = useMemo(() => [...allSongbooks()], [])
  const [featuredSongbook] = useState(() => pickFeaturedListenSongbook([...allSongbooks()]))
  const topTracks = useMemo(() => pickTopTracksForListenLp(trackCatalog), [trackCatalog])
  const latestSongs = useMemo(() => pickLatestSongsForListenLp(songCatalogRows), [songCatalogRows])
  const sutraSongbooks = useMemo(
    () => (activeGenre === 'ALL' ? pickSutraSongbooksForListenLp(songbooks, activeSutra) : []),
    [songbooks, activeSutra, activeGenre],
  )
  const genreSongbooks = useMemo(
    () => (activeSutra === 'ALL' ? pickGenreSongbooksForListenLp(songbooks, activeGenre) : []),
    [songbooks, activeSutra, activeGenre],
  )

  const pageMeta = renderPageMeta({
    title: LISTEN_LP_META.title,
    description: LISTEN_LP_META.description,
    path: canonicalPathForRoute('/listen'),
  })

  useSyncCatalogHeaderHeight(pageRef, headerRef, [
    activeSutra,
    activeGenre,
    topTracks.length,
    latestSongs.length,
    sutraSongbooks.length,
    genreSongbooks.length,
    trackCatalog === null ? -1 : topTracks.length,
  ])

  return (
    <div ref={pageRef} className="catalog catalog-page catalog-page--shell listen-lp">
      {pageMeta}
      <GlobalHeader ref={headerRef} />
      <div className="catalog-page__main">
        <main className="catalog-layout-shell listen-lp__main" id="main-content">
          <nav className="catalog-breadcrumbs" aria-label="Breadcrumb">
            <Link className="catalog-breadcrumbs__link" to="/">
              Home
            </Link>
            <span className="catalog-breadcrumbs__sep" aria-hidden>
              /
            </span>
            <span className="catalog-breadcrumbs__current" aria-current="page">
              Listen
            </span>
          </nav>

          <header className="catalog-page-intro listen-lp__intro">
            <h1 className="catalog-page-h1">{LISTEN_LP_META.lead}</h1>
            <p className="catalog-page-sub catalog-page-shell__measure">{LISTEN_LP_META.sub}</p>
          </header>

          {trackLoadError ? <p className="listen-lp__load-error">{trackLoadError}</p> : null}

          {trackCatalog === null && !trackLoadError ? (
            <p className="listen-lp__loading" aria-live="polite">
              Loading top tracks…
            </p>
          ) : (
            <ListenLpTopTracks tracks={topTracks} />
          )}

          <section className="catalog-page-shell__section listen-lp__section" aria-labelledby="listen-lp-new-heading">
            <h2 id="listen-lp-new-heading" className="catalog-section-title">
              What&apos;s new
            </h2>
            <p className="listen-lp__section-intro">
              Fresh in. Lyrics, meaning, and playback on each song page.
            </p>
            {latestSongs.length ? (
              <ScrollRail className="listen-lp__scroll-rail" variant="fade">
                <ul className="listen-lp__rail-list">
                  {latestSongs.map((song) => (
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
              <p className="listen-lp__empty">No songs in the catalog right now.</p>
            )}
            <Link className="catalog-section-cta" to="/songs/?sort=newest">
              Explore the fool catalog →
            </Link>
          </section>

          {featuredSongbook ? (
            <section
              className="catalog-page-shell__section listen-lp__section listen-lp__featured"
              aria-labelledby="listen-lp-featured-heading"
            >
              <h2 id="listen-lp-featured-heading" className="catalog-section-title">
                Featured songbook
              </h2>
              <p className="listen-lp__section-intro">
                A curated playlist, organized around a single theme. Full lyrics on the song page.
              </p>
              <div className="listen-lp__featured-grid">
                <LazySoundCloudEmbed scUrl={featuredSongbook.playlist_url} title={featuredSongbook.songbook} />
                <div className="listen-lp__featured-copy">
                  <p className="listen-lp__featured-kicker">{songbookFeaturedKickerLabel(featuredSongbook)}</p>
                  <h3 className="listen-lp__featured-title">{featuredSongbook.songbook}</h3>
                  {featuredSongbook.description ? (
                    <p className="listen-lp__featured-desc">{featuredSongbook.description}</p>
                  ) : null}
                  <SongbookPlaylistMetaLine book={featuredSongbook} />
                  <Link className="catalog-section-cta listen-lp__featured-cta" to={songbookHrefFromCatalogItem(featuredSongbook)}>
                    Open songbook →
                  </Link>
                </div>
              </div>
            </section>
          ) : null}

          <section
            className="catalog-page-shell__section listen-lp__section listen-lp__songbooks-block"
            aria-labelledby="listen-lp-songbooks-block-heading"
          >
            <h2 id="listen-lp-songbooks-block-heading" className="catalog-section-title">
              Browse songbooks
            </h2>
            <p className="listen-lp__section-intro listen-lp__songbooks-block-intro">
              Filter the sutra and genre lists below. Pick one guiding question or one genre at a time.
            </p>

            <ListenLpFacetBar
              books={songbooks}
              activeSutra={activeSutra}
              activeGenre={activeGenre}
              sutraRailCount={sutraSongbooks.length}
              genreRailCount={genreSongbooks.length}
              onSutraChange={setActiveSutra}
              onGenreChange={setActiveGenre}
              onClearSutra={() => setActiveSutra('ALL')}
              onClearGenre={() => setActiveGenre('ALL')}
              onClearAll={() => {
                setActiveSutra('ALL')
                setActiveGenre('ALL')
              }}
            />

            {activeGenre === 'ALL' ? (
            <section
              className="listen-lp__songbooks-rail"
              aria-labelledby="listen-lp-sutra-songbooks-heading"
            >
              <h3 id="listen-lp-sutra-songbooks-heading" className="listen-lp__songbooks-rail-title">
                Songbooks by sutra
              </h3>
              <p className="listen-lp__section-intro">
                Continuous listens built around a single question. One sutra, one playlist, one through-line.
              </p>
              {sutraSongbooks.length ? (
                <ScrollRail className="listen-lp__scroll-rail" variant="fade">
                  <ul className="listen-lp__rail-list">
                    {sutraSongbooks.map((book) => (
                      <li key={book.slug} className="listen-lp__rail-cell">
                        <ListenLpSongbookThumb book={book} />
                      </li>
                    ))}
                  </ul>
                </ScrollRail>
              ) : (
                <p className="listen-lp__empty">No songbooks for this sutra in the catalog.</p>
              )}
              <Link className="catalog-section-cta" to="/songbooks/">
                All songbooks →
              </Link>
            </section>
            ) : null}

            {activeSutra === 'ALL' && genreSongbooks.length ? (
            <section
              className="listen-lp__songbooks-rail listen-lp__songbooks-rail--genre"
              aria-labelledby="listen-lp-genre-songbooks-heading"
            >
              <h3 id="listen-lp-genre-songbooks-heading" className="listen-lp__songbooks-rail-title">
                Songbooks by genre
              </h3>
              <p className="listen-lp__section-intro">
                Sound-first. Same songs, sorted by what they feel like, not what they&apos;re about.
              </p>
              <ScrollRail className="listen-lp__scroll-rail" variant="fade">
                <ul className="listen-lp__rail-list">
                  {genreSongbooks.map((book) => (
                    <li key={book.slug} className="listen-lp__rail-cell">
                      <ListenLpSongbookThumb book={book} />
                    </li>
                  ))}
                </ul>
              </ScrollRail>
              <Link className="catalog-section-cta" to="/songbooks/?type=genre">
                Browse genre songbooks →
              </Link>
            </section>
          ) : null}

          </section>

          <ListenLpBertrandTail />
        </main>
      </div>
      <GlobalFooter />
    </div>
  )
}
