import { ScrollRail } from './ScrollRail'
import { SongThumbCard } from './SongThumbCard'
import { browseRowHasAudioSection, songCatalogLinkTo } from './songPaths'
import type { SongCatalogItem } from './types'
import './songThumbCard.css'

type Props = {
  songs: SongCatalogItem[]
}

/** Same cover-card rail as /listen “What’s new?” — shared SongThumbCard + ScrollRail. */
export function HomeLatestDropsSpotlight({ songs }: Props) {
  if (!songs.length) {
    return <p className="home-portal__empty">No recent drops.</p>
  }

  return (
    <ScrollRail className="listen-lp__scroll-rail" variant="fade">
      <ul className="listen-lp__rail-list">
        {songs.map((song) => (
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
  )
}
