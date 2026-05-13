import type { SongbookCatalogItem } from './types'

export type SongbookPlaylistMetaFields = Pick<SongbookCatalogItem, 'playlist_track_count' | 'playlist_duration_total'>

export function formatSongbookScPlaylistMeta(b: SongbookPlaylistMetaFields): string | null {
  const n = b.playlist_track_count ?? 0
  const dur = (b.playlist_duration_total || '').trim()
  if (n <= 0 && !dur) return null
  const parts: string[] = []
  if (n > 0) parts.push(n === 1 ? '1 track' : `${n} tracks`)
  if (dur) parts.push(dur)
  return parts.join(' · ')
}
