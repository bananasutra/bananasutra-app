import { Link } from 'react-router-dom'
import { HomeHaveABitePlayer } from './HomeHaveABitePlayer'
import { HomeLatestDropsSpotlight } from './HomeLatestDropsSpotlight'
import type { HomeListenerFavorite } from './homePortalData'
import type { SongCatalogItem } from './types'
import { browsePathWithQuery, canonicalPathForRoute } from './seoPaths'

export function HomeLatestDropsSection({ songs }: { songs: SongCatalogItem[] }) {
  return (
    <>
      <h2 id="home-drops-heading" className="catalog-section-title">
        Latest drops
      </h2>
      <p className="catalog-lp-section-intro">
        Fresh in the catalog. The newest songs, ready when you are.
      </p>
      <HomeLatestDropsSpotlight songs={songs} />
      <Link className="catalog-section-cta" to={browsePathWithQuery('/songs', 'sort=newest')}>
        Browse newest songs →
      </Link>
    </>
  )
}

export function HomeTopTracksSection({ favorites }: { favorites: HomeListenerFavorite[] }) {
  if (!favorites.length) return null

  return (
    <>
      <h2 id="home-have-a-bite-heading" className="catalog-section-title">
        Top 5 tracks
      </h2>
      <p className="catalog-lp-section-intro">
        Press play. The five tracks listeners keep coming back to.
      </p>
      <HomeHaveABitePlayer favorites={favorites} showBrowseCta={false} />
      <Link className="catalog-section-cta" to={canonicalPathForRoute('/tracks')}>
        Listen to all tracks →
      </Link>
    </>
  )
}
