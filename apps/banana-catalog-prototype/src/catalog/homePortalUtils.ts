import type { SongbookCatalogItem } from './types'
import { songbookCatalogPath } from './songPaths'
import { songbookToUrlSlug } from './slugify'

export function songbookHrefFromCatalogItem(b: SongbookCatalogItem): string {
  const slug = (b.url_slug_songbook || '').trim() || songbookToUrlSlug(b.songbook)
  return songbookCatalogPath(slug)
}

/** `url_slug_songbook` for the Hidden Peels homepage spotlight. */
export const HOME_HIDDEN_PEELS_SLUG = 'hidden-peels'

/** Homepage spotlight: Hidden Peels by slug, else SC→SONGBOOK join row by `songbook_id` if slug alone fails. */
export function resolveHiddenPeelsSongbook(books: SongbookCatalogItem[]): SongbookCatalogItem | null {
  const slug = HOME_HIDDEN_PEELS_SLUG
  const bySlug = books.find((b) => (b.url_slug_songbook || '').trim().toLowerCase() === slug)
  if (bySlug && (bySlug.playlist_url || '').includes('/sets/')) return bySlug
  const byId = books.find((b) => (b.songbook_id || '').trim().toLowerCase() === 'g-gems')
  if (byId && (byId.playlist_url || '').includes('/sets/')) return byId
  return null
}

/** Small-caps kicker for featured songbook cards (type/sutra — never raw `songbook_id`). */
export function songbookFeaturedKickerLabel(b: SongbookCatalogItem): string {
  const st = (b.songbook_type || '').trim().toLowerCase()
  if (st === 'sutra') {
    const first = (b.sutras || '').split(',')[0]?.trim()
    return `SONGBOOK · ${first || 'SUTRA'}`
  }
  const label = st ? st.replace(/^\w/, (c) => c.toUpperCase()) : 'Set'
  return `SONGBOOK · ${label}`
}

export function songbookPopularity(b: SongbookCatalogItem): number {
  return b.playlist_total_plays + 40 * b.playlist_total_likes + b.songs_with_in_app_playback
}

function eligiblePlaylistSongbooksSorted(pool: SongbookCatalogItem[]): SongbookCatalogItem[] {
  return pool
    .filter((b) => (b.playlist_url || '').includes('/sets/'))
    .sort((a, b) => songbookPopularity(b) - songbookPopularity(a))
}

function eligiblePlaylistSongbooksForPick(
  pool: SongbookCatalogItem[],
  excludeSongbook: string | null,
): SongbookCatalogItem[] {
  let eligible = eligiblePlaylistSongbooksSorted(pool)
  if (!eligible.length) return eligible
  if (excludeSongbook) {
    const filtered = eligible.filter((b) => b.songbook !== excludeSongbook)
    if (filtered.length) eligible = filtered
  }
  return eligible
}

/**
 * Random SoundCloud `/sets/` playlist from `pool`, popularity-sorted then uniformly sampled.
 *
 * @param excludeSongbook — optional `songbook` display name to omit when another slot already shows it.
 */
export function pickRandomSongbookFromPool(
  pool: SongbookCatalogItem[],
  excludeSongbook: string | null = null,
): SongbookCatalogItem | null {
  const eligible = eligiblePlaylistSongbooksForPick(pool, excludeSongbook)
  if (!eligible.length) return null
  return eligible[Math.floor(Math.random() * eligible.length)]!
}

/** Random featured songbook for `/songbooks` hero strip (full in-app catalog, SoundCloud sets only). */
export function pickFeaturedSongbook(books: SongbookCatalogItem[]): SongbookCatalogItem | null {
  return pickRandomSongbookFromPool(books, null)
}
