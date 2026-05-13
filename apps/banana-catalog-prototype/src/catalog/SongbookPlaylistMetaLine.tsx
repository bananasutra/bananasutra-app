import { formatSongbookScPlaylistMeta, type SongbookPlaylistMetaFields } from './songbookPlaylistMeta'

type Props = {
  book: SongbookPlaylistMetaFields
  /** Extra classes (e.g. layout variant on cards). */
  className?: string
}

/** SC playlist `track_count` + `duration_total` when present on the catalog row. */
export function SongbookPlaylistMetaLine({ book, className }: Props) {
  const text = formatSongbookScPlaylistMeta(book)
  if (!text) return null
  return <p className={['catalog-songbook-playlist-meta', className].filter(Boolean).join(' ')}>{text}</p>
}
