import { SongThumbCard } from './SongThumbCard'
import { browseRowHasAudioSection, songCatalogLinkTo } from './songPaths'
import type { SongCatalogItem } from './types'
import './songThumbCard.css'

type Props = {
  songs: SongCatalogItem[]
}

/** Latest drops — 2×2 cover grid (wireframe §3 left column). */
export function HomeLatestDropsSpotlight({ songs }: Props) {
  if (!songs.length) {
    return <p className="home-portal__empty">No recent drops.</p>
  }

  return (
    <ul className="song-thumb-grid song-thumb-grid--home-portal-drops">
      {songs.map((song) => (
        <li key={song.lyrics_id} className="song-thumb-grid__cell">
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
  )
}
