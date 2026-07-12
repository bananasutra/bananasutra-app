import { ScrollRail } from './ScrollRail'
import { SongThumbCard } from './SongThumbCard'
import { browseRowHasAudioSection, songCatalogLinkTo } from './songPaths'
import type { SongCatalogItem } from './types'

type Props = {
  songs: SongCatalogItem[]
}

/** Latest drops — fade scroll rail (~4 visible, up to 6), matching sutra "what's new". */
export function HomeLatestDropsSpotlight({ songs }: Props) {
  if (!songs.length) {
    return <p className="home-portal__empty">No recent drops.</p>
  }

  return (
    <ScrollRail className="listen-lp__scroll-rail" variant="fade">
      <ul className="listen-lp__rail-list" aria-label="Latest drops">
        {songs.map((song, index) => (
          <li key={song.lyrics_id} className="listen-lp__rail-cell">
            <SongThumbCard
              to={songCatalogLinkTo(song.lyrics_title, song.url_slug, {
                section: browseRowHasAudioSection(song) ? 'audio' : undefined,
              })}
              coverUrl={song.cover_image_url}
              title={song.lyrics_title}
              metaLabel={song.sutra}
              publishedAt={song.published_at}
              loading={index < 2 ? 'eager' : 'lazy'}
              fetchPriority={index === 0 ? 'high' : undefined}
            />
          </li>
        ))}
      </ul>
    </ScrollRail>
  )
}
