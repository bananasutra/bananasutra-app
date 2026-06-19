import { useCallback, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useLocation, useSearchParams } from 'react-router-dom'
import songCatalogBrowseJson from '../data/generated/song_catalog_browse.json'
import songbookCatalogJson from '../data/generated/songbook_catalog.json'
import { GlobalFooter } from './GlobalFooter'
import { GlobalHeader } from './GlobalHeader'
import { HomeLatestDropsSection, HomeTopTracksSection } from './HomeNowPlayingSection'
import { HomePortalBbbNudge } from './HomePortalBbbNudge'
import { HomePortalCoverStrip } from './HomePortalCoverStrip'
import { HomePortalHeroQuote } from './HomePortalHeroQuote'
import { HomePortalSutraGrid } from './HomePortalSutraGrid'
import { HomeSongbooksCorner } from './HomeSongbooksCorner'
import { HomeStatsSummary } from './HomeStatsSummary'
import { HomeVideoTeaser } from './HomeVideoTeaser'
import { ScrollRevealSection } from './ScrollRevealSection'
import {
  buildCoverPool,
  buildHeroQuotePool,
  buildHomeStatsSummary,
  buildListenerFavorites,
  HOME_COVER_STRIP_COUNT,
  HOME_LATEST_DROPS_LIMIT,
  pickRandomHeroQuote,
  pickRandomHomeVideoTeasers,
  shuffleCoverStrip,
} from './homePortalData'
import { pickRandomHomeSongbookCorner } from './homePortalUtils'
import { pickLatestSongsForListenLp } from './listenLpData'
import { buildSutraStats } from './sutraPageUtils'
import type { SongCatalogItem, SongbookCatalogItem } from './types'
import { canonicalPathForRoute } from './seoPaths'
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

  const [heroQuote] = useState(() => pickRandomHeroQuote(buildHeroQuotePool()))
  const latestSongs = useMemo(
    () => pickLatestSongsForListenLp(songCatalogBrowseJson as SongCatalogItem[], HOME_LATEST_DROPS_LIMIT),
    [],
  )
  const listenerFavorites = useMemo(() => buildListenerFavorites(5), [])
  const sutraSongCounts = useMemo(() => {
    const stats = buildSutraStats(songCatalogBrowseJson as SongCatalogItem[])
    return new Map([...stats.entries()].map(([key, row]) => [key, row.songs]))
  }, [])
  const [songbookCornerCards] = useState(() =>
    pickRandomHomeSongbookCorner((songbookCatalogJson as SongbookCatalogItem[]) ?? []),
  )
  const [videoTeasers] = useState(() => pickRandomHomeVideoTeasers())
  const statsSummary = useMemo(() => buildHomeStatsSummary(), [])

  const [luckySeed, setLuckySeed] = useState(() => `${location.key}|${Date.now()}`)
  const coverStripTiles = useMemo(
    () => shuffleCoverStrip(buildCoverPool(), luckySeed, HOME_COVER_STRIP_COUNT),
    [luckySeed],
  )
  const reloadLuckyStrip = useCallback(() => {
    setLuckySeed(`${location.key}|${Date.now()}`)
  }, [location.key])

  useSyncCatalogHeaderHeight(pageRef, headerRef, [fullSearch, luckySeed])

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

          <ScrollRevealSection aria-labelledby="home-sutra-grid-heading">
            <h2 id="home-sutra-grid-heading" className="catalog-section-title">
              The seven sutras
            </h2>
            <p className="catalog-lp-section-intro">
              Start here. This is the compass behind the songs.
            </p>
            <HomePortalSutraGrid songCounts={sutraSongCounts} />
            <Link className="catalog-section-cta" to={canonicalPathForRoute('/sutras')}>
              Explore sutras →
            </Link>
          </ScrollRevealSection>

          <ScrollRevealSection className="home-portal__section--listen-rail" aria-labelledby="home-drops-heading">
            <HomeLatestDropsSection songs={latestSongs} />
          </ScrollRevealSection>

          {listenerFavorites.length > 0 ? (
            <ScrollRevealSection className="home-portal__section--listen-rail" aria-labelledby="home-have-a-bite-heading">
              <HomeTopTracksSection favorites={listenerFavorites} />
            </ScrollRevealSection>
          ) : null}

          {coverStripTiles.length > 0 ? (
            <ScrollRevealSection className="home-portal__section--lucky" aria-labelledby="home-cover-strip-heading">
              <HomePortalCoverStrip tiles={coverStripTiles} onReload={reloadLuckyStrip} />
              <HomePortalBbbNudge />
            </ScrollRevealSection>
          ) : null}

          {songbookCornerCards.length > 0 ? (
            <ScrollRevealSection
              className="home-portal__section--listen-rail"
              aria-labelledby="home-songbook-spotlight-heading"
            >
              <HomeSongbooksCorner cards={songbookCornerCards} />
            </ScrollRevealSection>
          ) : null}

          {videoTeasers.length > 0 ? (
            <ScrollRevealSection aria-labelledby="home-video-teaser-heading">
              <HomeVideoTeaser videos={videoTeasers} />
            </ScrollRevealSection>
          ) : null}

          {statsSummary.length > 0 ? (
            <ScrollRevealSection immediate className="home-portal__section--stats" aria-label="Catalog scale">
              <HomeStatsSummary items={statsSummary} />
            </ScrollRevealSection>
          ) : null}
        </main>
      </div>

      <GlobalFooter />
    </div>
  )
}
