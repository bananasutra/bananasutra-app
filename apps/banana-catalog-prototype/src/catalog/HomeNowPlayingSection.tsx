import { Link } from 'react-router-dom'
import { HomeHaveABitePlayer } from './HomeHaveABitePlayer'
import { HomeLatestDropsSpotlight } from './HomeLatestDropsSpotlight'
import { CatalogProgressiveLoading } from './CatalogProgressiveLoading'
import type { HomeListenerFavorite } from './homePortalData'
import type { SongCatalogItem } from './types'
import { browsePathWithQuery, canonicalPathForRoute } from './seoPaths'

export function HomeLatestDropsSection({
  songs,
  loading = false,
}: {
  songs: SongCatalogItem[]
  loading?: boolean
}) {
  return (
    <>
      <h2 id="home-drops-heading" className="catalog-section-title">
        Latest drops
      </h2>
      <p className="catalog-lp-section-intro">
        Fresh in the catalog. The newest songs, ready when you are.
      </p>
      {loading ? (
        <CatalogProgressiveLoading label="Loading latest drops" />
      ) : (
        <HomeLatestDropsSpotlight songs={songs} />
      )}
      <Link className="catalog-section-cta" to={browsePathWithQuery('/songs', 'sort=newest')}>
        Explore the full songs collection →
      </Link>
    </>
  )
}

export function HomeTopTracksSection({
  favorites,
  loading = false,
  loadError = null,
}: {
  favorites: HomeListenerFavorite[]
  loading?: boolean
  loadError?: string | null
}) {
  return (
    <>
      <h2 id="home-have-a-bite-heading" className="catalog-section-title">
        Top 5 tracks
      </h2>
      <p className="catalog-lp-section-intro">
        Press play. The five tracks listeners keep coming back to.
      </p>
      {loading ? (
        <CatalogProgressiveLoading label="Loading top tracks" />
      ) : loadError ? (
        <p className="home-portal__empty" role="status">
          {loadError}
        </p>
      ) : favorites.length > 0 ? (
        <>
          <HomeHaveABitePlayer favorites={favorites} showBrowseCta={false} />
          <Link className="catalog-section-cta" to={canonicalPathForRoute('/tracks')}>
            Listen to all top tracks →
          </Link>
        </>
      ) : null}
    </>
  )
}
