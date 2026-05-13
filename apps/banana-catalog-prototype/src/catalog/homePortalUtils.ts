import type { SongbookCatalogItem } from './types'
import { songbookToUrlSlug } from './slugify'

export function songbookHrefFromCatalogItem(b: SongbookCatalogItem): string {
  const slug = (b.url_slug_songbook || '').trim() || songbookToUrlSlug(b.songbook)
  return `/songbooks/${slug}`
}

/** Airtable slug for the G-gems “Hidden Peels” collection (R18 homepage spotlight). */
export const HOME_HIDDEN_PEELS_SLUG = 'hidden-peels'

/** Fixed homepage playlist: Hidden Peels / G-gems when present in `songbook_catalog.json`. */
export function resolveHiddenPeelsSongbook(books: SongbookCatalogItem[]): SongbookCatalogItem | null {
  const slug = HOME_HIDDEN_PEELS_SLUG
  const bySlug = books.find((b) => (b.url_slug_songbook || '').trim().toLowerCase() === slug)
  if (bySlug && (bySlug.playlist_url || '').includes('/sets/')) return bySlug
  const byId = books.find((b) => (b.songbook_id || '').trim().toLowerCase() === 'g-gems')
  if (byId && (byId.playlist_url || '').includes('/sets/')) return byId
  return null
}

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
