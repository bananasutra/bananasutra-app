import type { SongbookCatalogItem } from './types'

export function songbookPopularity(b: SongbookCatalogItem): number {
  return b.playlist_total_plays + 40 * b.playlist_total_likes + b.songs_with_in_app_playback
}

/** Deterministic “songbook of the day” — same contract as previous HomePortal inline helper. */
export function pickFeaturedSongbook(books: SongbookCatalogItem[]): SongbookCatalogItem | null {
  const eligible = books.filter((b) => (b.playlist_url || '').includes('/sets/')).sort((a, b) => songbookPopularity(b) - songbookPopularity(a))
  if (!eligible.length) return null
  const t = new Date()
  const start = new Date(t.getFullYear(), 0, 0).getTime()
  const dayOfYear = Math.floor((t.getTime() - start) / 86400000)
  return eligible[dayOfYear % eligible.length]!
}
