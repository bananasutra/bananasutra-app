import { useCallback, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useLocation, useSearchParams } from 'react-router-dom'
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
import type { SutraFamilyKey } from './sutraContext'
import { useSongCatalogBrowse, useSongbookCatalog } from './generatedData'
import { canonicalPathForRoute } from './seoPaths'
import { CATALOG_BROWSE_PATH, searchHasBrowseParams } from './urlState'
import { PageMeta } from './PageMeta'
import { websiteJsonLd } from '../seo/jsonLd'
import { useHomeDeferredCatalog } from './useHomeDeferredCatalog'
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

  const { data: browseCatalog, loading: browseLoading } = useSongCatalogBrowse()
  const { data: songbookCatalog } = useSongbookCatalog()
  const { trackCatalog, youtubeByLyrics, trackLoadError, youtubeLoadError } = useHomeDeferredCatalog()

  const heroQuote = useMemo(() => {
    if (!browseCatalog?.length) return null
    return pickRandomHeroQuote(buildHeroQuotePool(browseCatalog))
  }, [browseCatalog])

  const latestSongs = useMemo(
    () => (browseCatalog ? pickLatestSongsForListenLp(browseCatalog, HOME_LATEST_DROPS_LIMIT) : []),
    [browseCatalog],
  )

  const listenerFavorites = useMemo(
    () => (browseCatalog ? buildListenerFavorites(trackCatalog, browseCatalog, 5) : []),
    [trackCatalog, browseCatalog],
  )

  const sutraSongCounts = useMemo(() => {
    if (!browseCatalog) return new Map<SutraFamilyKey, number>()
    const stats = buildSutraStats(browseCatalog)
    return new Map([...stats.entries()].map(([key, row]) => [key, row.songs]))
  }, [browseCatalog])

  const songbookCornerCards = useMemo(() => {
    if (!songbookCatalog?.length) return []
    return pickRandomHomeSongbookCorner(songbookCatalog)
  }, [songbookCatalog])

  const videoTeasers = useMemo(
    () => (youtubeByLyrics ? pickRandomHomeVideoTeasers(youtubeByLyrics) : []),
    [youtubeByLyrics],
  )
  const statsSummary = useMemo(() => buildHomeStatsSummary(), [])

  const topTracksLoading = trackCatalog === null && trackLoadError === null
  const videoTeasersLoading = youtubeByLyrics === null && youtubeLoadError === null
  const showTopTracksSection = topTracksLoading || listenerFavorites.length > 0 || Boolean(trackLoadError)
  const showVideoTeaserSection = videoTeasersLoading || videoTeasers.length > 0 || Boolean(youtubeLoadError)

  const [luckySeed, setLuckySeed] = useState(() => `${location.key}|${Date.now()}`)
  const coverStripTiles = useMemo(
    () =>
      browseCatalog
        ? shuffleCoverStrip(buildCoverPool(browseCatalog), luckySeed, HOME_COVER_STRIP_COUNT)
        : [],
    [browseCatalog, luckySeed],
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
              Learn more about the sutras →
            </Link>
          </ScrollRevealSection>

          <ScrollRevealSection className="home-portal__section--listen-rail" aria-labelledby="home-drops-heading">
            <HomeLatestDropsSection songs={latestSongs} loading={browseLoading} />
          </ScrollRevealSection>

          {showTopTracksSection ? (
            <ScrollRevealSection className="home-portal__section--listen-rail" aria-labelledby="home-have-a-bite-heading">
              <HomeTopTracksSection
                favorites={listenerFavorites}
                loading={topTracksLoading}
                loadError={trackLoadError}
              />
            </ScrollRevealSection>
          ) : null}

          {coverStripTiles.length > 0 ? (
            <>
              <ScrollRevealSection className="home-portal__section--lucky" aria-labelledby="home-cover-strip-heading">
                <HomePortalCoverStrip tiles={coverStripTiles} stripKey={luckySeed} onReload={reloadLuckyStrip} />
              </ScrollRevealSection>
              <ScrollRevealSection className="home-portal__section--bbb" aria-labelledby="home-bbb-nudge-heading">
                <HomePortalBbbNudge />
              </ScrollRevealSection>
            </>
          ) : null}

          {songbookCornerCards.length > 0 ? (
            <ScrollRevealSection
              className="home-portal__section--listen-rail"
              aria-labelledby="home-songbook-spotlight-heading"
            >
              <HomeSongbooksCorner cards={songbookCornerCards} />
            </ScrollRevealSection>
          ) : null}

          {showVideoTeaserSection ? (
            <ScrollRevealSection aria-labelledby="home-video-teaser-heading">
              <HomeVideoTeaser videos={videoTeasers} loading={videoTeasersLoading} loadError={youtubeLoadError} />
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
