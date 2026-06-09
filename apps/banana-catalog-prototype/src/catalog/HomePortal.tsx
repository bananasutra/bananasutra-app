import { useMemo, useRef } from 'react'
import { Link, Navigate, useLocation, useSearchParams } from 'react-router-dom'
import songCatalogBrowseJson from '../data/generated/song_catalog_browse.json'
import songbookCatalogJson from '../data/generated/songbook_catalog.json'
import { GlobalFooter } from './GlobalFooter'
import { GlobalHeader } from './GlobalHeader'
import { HomeFeaturedSongbookCard } from './HomeFeaturedSongbookCard'
import { HomeHaveABitePlayer } from './HomeHaveABitePlayer'
import { HomeLatestDropsSpotlight } from './HomeLatestDropsSpotlight'
import { HomePortalBbbNudge } from './HomePortalBbbNudge'
import { HomePortalCoverStrip } from './HomePortalCoverStrip'
import { HomePortalDoors } from './HomePortalDoors'
import { HomePortalHeroQuote } from './HomePortalHeroQuote'
import { HomePortalSutraGrid } from './HomePortalSutraGrid'
import { LEARN_LP_META } from './learnLpData'
import {
  buildCoverPool,
  buildHeroQuotePool,
  buildListenerFavorites,
  HOME_LATEST_DROPS_LIMIT,
  pickHeroQuoteForVisit,
  pickListenDoorPreview,
  pickWatchDoorPreview,
  shuffleCoverStrip,
} from './homePortalData'
import { pickLatestSongsForListenLp } from './listenLpData'
import { resolveHiddenPeelsSongbook } from './homePortalUtils'
import type { SongCatalogItem, SongbookCatalogItem } from './types'
import { browsePathWithQuery, canonicalPathForRoute } from './seoPaths'
import { CATALOG_BROWSE_PATH, searchHasBrowseParams } from './urlState'
import { PageMeta } from './PageMeta'
import { websiteJsonLd } from '../seo/jsonLd'
import { useSyncCatalogHeaderHeight } from './useSyncCatalogHeaderHeight'
import './CatalogApp.css'
import './catalog-page-shell.css'
import './HomePortal.css'
import './ListenLpPage.css'
import './SutrasPages.css'

export function HomePortal() {
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const pageRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLElement>(null)
  const legacyRedirect = location.pathname === '/' && searchHasBrowseParams(location.search)
  const fullSearch = searchParams.toString()

  const heroQuotePool = useMemo(() => buildHeroQuotePool(), [])
  const heroQuote = useMemo(() => pickHeroQuoteForVisit(heroQuotePool), [heroQuotePool])
  const listenDoor = useMemo(() => pickListenDoorPreview(), [])
  const watchDoor = useMemo(() => pickWatchDoorPreview(), [])
  const latestSongs = useMemo(
    () => pickLatestSongsForListenLp(songCatalogBrowseJson as SongCatalogItem[], HOME_LATEST_DROPS_LIMIT),
    [],
  )
  const listenerFavorites = useMemo(() => buildListenerFavorites(5), [])

  const coverStripSeed = useMemo(() => `${location.key}|${Math.random()}`, [location.key])
  const coverStripTiles = useMemo(() => shuffleCoverStrip(buildCoverPool(), coverStripSeed), [coverStripSeed])

  const featuredSongbook = useMemo(
    () => resolveHiddenPeelsSongbook((songbookCatalogJson as SongbookCatalogItem[]) ?? []),
    [],
  )

  useSyncCatalogHeaderHeight(pageRef, headerRef, [fullSearch])

  if (legacyRedirect) {
    return <Navigate to={{ pathname: CATALOG_BROWSE_PATH, search: location.search }} replace />
  }

  return (
    <div ref={pageRef} className="catalog catalog-page catalog-page--shell home-portal">
      <PageMeta
        title="Songs for a World Gone Bananas"
        description="Explore the BANANASUTRA catalog — songs organized by sutra, topic, intention, and sound. Browse songbooks, read lyrics, watch videos, and listen to tracks."
        path="/"
        jsonLd={websiteJsonLd()}
      />
      <GlobalHeader ref={headerRef} />

      <div className="catalog-page__main">
        <main id="main-content" className="home-portal__main catalog-layout-shell">
          <h1 className="visually-hidden">BANANASUTRA</h1>

          <section
            className="home-hero home-hero--centered catalog-page-shell__section home-portal__section--hero"
            aria-labelledby="home-tagline"
          >
            <p id="home-tagline" className="home-hero__tagline">
              Ideas you can feel.
            </p>
            {heroQuote ? <HomePortalHeroQuote quote={heroQuote} /> : null}
          </section>

          {coverStripTiles.length > 0 ? (
            <section className="catalog-page-shell__section" aria-labelledby="home-cover-strip-heading">
              <h2 id="home-cover-strip-heading" className="catalog-section-title">
                Feeling lucky?
              </h2>
              <p className="home-portal__section-intro">
                Tap a cover and see where it takes you. It&apos;s chill. It&apos;s fun. It&apos;s free. Woo.
              </p>
              <HomePortalCoverStrip tiles={coverStripTiles} />
            </section>
          ) : null}

          <HomePortalBbbNudge />

          <section
            className="catalog-page-shell__section home-portal__section--listen-rail"
            aria-labelledby="home-drops-heading"
          >
            <h2 id="home-drops-heading" className="catalog-section-title">
              Latest drops
            </h2>
            <p className="home-portal__section-intro">
              Fresh in. Lyrics, meaning, and playback on each song page.
            </p>
            <HomeLatestDropsSpotlight songs={latestSongs} />
            <Link className="catalog-section-cta" to={browsePathWithQuery('/songs', 'sort=newest')}>
              Browse newest songs →
            </Link>
          </section>

          {listenerFavorites.length > 0 ? (
            <section
              className="catalog-page-shell__section home-portal__section--listen-rail"
              aria-labelledby="home-have-a-bite-heading"
            >
              <h2 id="home-have-a-bite-heading" className="catalog-section-title">
                or, have a bite.
              </h2>
              <p className="home-portal__section-intro">Here, have a top 5. Just press play.</p>
              <HomeHaveABitePlayer favorites={listenerFavorites} />
            </section>
          ) : null}

          {featuredSongbook ? (
            <section
              className="catalog-page-shell__section home-portal__section--listen-rail"
              aria-labelledby="home-songbook-spotlight-heading"
            >
              <h2 id="home-songbook-spotlight-heading" className="catalog-section-title">
                the songbooks corner
              </h2>
              <p className="home-portal__section-intro">
                This is where we settle in. Songbooks are the long-play option for the curious.
              </p>
              <HomeFeaturedSongbookCard book={featuredSongbook} />
            </section>
          ) : null}

          <section className="home-doors catalog-page-shell__section" aria-labelledby="home-doors-heading">
            <h2 id="home-doors-heading" className="catalog-section-title">
              Three doors
            </h2>
            <p className="home-portal__section-intro catalog-page-shell__measure">
              Same windows, same human, three ways in. LEARN, LISTEN, or WATCH.
            </p>
            <HomePortalDoors learnQuote={heroQuote} listen={listenDoor} watch={watchDoor} />
          </section>

          <section className="catalog-page-shell__section" aria-labelledby="home-sutra-grid-heading">
            <h2 id="home-sutra-grid-heading" className="catalog-section-title">
              Start here
            </h2>
            <p className="home-portal__section-intro catalog-page-shell__measure">
              {LEARN_LP_META.lead} So does everything else. Funny because it&apos;s true.
            </p>
            <HomePortalSutraGrid />
            <Link className="catalog-section-cta" to={canonicalPathForRoute('/sutras')}>
              Explore all sutras →
            </Link>
          </section>
        </main>
      </div>

      <GlobalFooter />
    </div>
  )
}
