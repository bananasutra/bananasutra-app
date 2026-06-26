import { SongThumbDropsGrid } from './SongThumbDropsGrid'
import type { SongCatalogItem } from './types'

type Props = {
  songs: SongCatalogItem[]
}

/** Latest drops — 2×2 cover grid (wireframe §3 left column). */
export function HomeLatestDropsSpotlight({ songs }: Props) {
  if (!songs.length) {
    return <p className="home-portal__empty">No recent drops.</p>
  }

  return <SongThumbDropsGrid songs={songs} limit={4} eagerCount={2} />
}
