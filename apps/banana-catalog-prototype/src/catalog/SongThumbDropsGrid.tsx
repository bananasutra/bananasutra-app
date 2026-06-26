import { SongThumbCard } from './SongThumbCard'
import { browseRowHasAudioSection, songCatalogLinkTo } from './songPaths'
import type { SongCatalogItem } from './types'
import './songThumbCard.css'

export type SongThumbDropsItem = Pick<
  SongCatalogItem,
  'lyrics_id' | 'cover_image_url' | 'lyrics_title' | 'url_slug' | 'sutra'
> &
  Partial<Pick<SongCatalogItem, 'published_at' | 'has_in_app_playback' | 'has_sc_catalog_listen' | 'primary_ep_url' | 'has_youtube_video'>>

type Props = {
  songs: SongThumbDropsItem[]
  /** Cap grid size (homepage + related rows use 4). */
  limit?: number
  className?: string
  /** First N covers load eagerly for above-the-fold rows. */
  eagerCount?: number
  /** First card gets high fetch priority when eager. */
  highPriorityFirst?: boolean
}

/** Shared 4-up desktop / 2-up mobile cover grid (homepage latest drops pattern). */
export function SongThumbDropsGrid({ songs, limit = 4, className, eagerCount = 0, highPriorityFirst = true }: Props) {
  const visible = songs.slice(0, limit)
  if (!visible.length) return null

  return (
    <ul className={['song-thumb-grid song-thumb-grid--home-portal-drops', className].filter(Boolean).join(' ')}>
      {visible.map((song, index) => (
        <li key={song.lyrics_id} className="song-thumb-grid__cell">
          <SongThumbCard
            to={songCatalogLinkTo(song.lyrics_title, song.url_slug, {
              section: browseRowHasAudioSection(song as SongCatalogItem) ? 'audio' : undefined,
            })}
            coverUrl={song.cover_image_url}
            title={song.lyrics_title}
            metaLabel={song.sutra?.trim() || undefined}
            publishedAt={song.published_at}
            loading={index < eagerCount ? 'eager' : 'lazy'}
            fetchPriority={highPriorityFirst && index === 0 && index < eagerCount ? 'high' : undefined}
          />
        </li>
      ))}
    </ul>
  )
}
