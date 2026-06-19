import type { SongbookCatalogItem } from './types'
import { songbookCatalogPath } from './songPaths'
import { songbookToUrlSlug } from './slugify'

export function songbookHrefFromCatalogItem(b: SongbookCatalogItem): string {
  const slug = (b.url_slug_songbook || '').trim() || songbookToUrlSlug(b.songbook)
  return songbookCatalogPath(slug)
}

/** `url_slug_songbook` for the Hidden Peels homepage spotlight. */
export const HOME_HIDDEN_PEELS_SLUG = 'hidden-peels'

/** Topic/sutra card in the songbooks corner (wireframe §5). */
export const HOME_REVOLT_SONGBOOK_SLUG = 'speak-revolt-now'

/** Language card in the songbooks corner (wireframe §5). */
export const HOME_FRENCH_SONGBOOK_SLUG = 'lang-french'

export type HomeSongbookCornerSlot = 'topic' | 'genre' | 'language'

export type HomeSongbookCornerCard = {
  slot: HomeSongbookCornerSlot
  book: SongbookCatalogItem
}

function songbookBySlug(books: SongbookCatalogItem[], slug: string): SongbookCatalogItem | null {
  const normalized = slug.trim().toLowerCase()
  const match = books.find((b) => (b.url_slug_songbook || '').trim().toLowerCase() === normalized)
  if (!match || !(match.playlist_url || '').includes('/sets/')) return null
  return match
}

/** Three playlist types for homepage corner: topic/sutra, genre best-of, language — random per reload. */
export function pickRandomHomeSongbookCorner(books: SongbookCatalogItem[]): HomeSongbookCornerCard[] {
  const used = new Set<string>()
  const cards: HomeSongbookCornerCard[] = []

  const markUsed = (book: SongbookCatalogItem) => {
    used.add((book.songbook_id || book.songbook || '').trim())
  }

  const isUsed = (book: SongbookCatalogItem) => used.has((book.songbook_id || book.songbook || '').trim())

  const poolForSlot = (slot: HomeSongbookCornerSlot): SongbookCatalogItem[] =>
    books.filter((b) => {
      if (!(b.playlist_url || '').includes('/sets/')) return false
      if (isUsed(b)) return false
      const type = (b.songbook_type || '').trim().toLowerCase()
      if (slot === 'topic') return type === 'sutra'
      if (slot === 'genre') return type === 'genre' || type === 'collection'
      if (slot === 'language') return type === 'language'
      return false
    })

  for (const slot of ['topic', 'genre', 'language'] as const) {
    const pick = pickRandomSongbookFromPool(poolForSlot(slot), null)
    if (pick) {
      markUsed(pick)
      cards.push({ slot, book: pick })
    }
  }

  return cards
}

/** @deprecated Fixed picks — use {@link pickRandomHomeSongbookCorner} on home. */
export function resolveHomeSongbookCorner(books: SongbookCatalogItem[]): HomeSongbookCornerCard[] {
  const topic = songbookBySlug(books, HOME_REVOLT_SONGBOOK_SLUG)
  const genre = resolveHiddenPeelsSongbook(books)
  const language = songbookBySlug(books, HOME_FRENCH_SONGBOOK_SLUG)
  const cards: HomeSongbookCornerCard[] = []
  if (topic) cards.push({ slot: 'topic', book: topic })
  if (genre) cards.push({ slot: 'genre', book: genre })
  if (language) cards.push({ slot: 'language', book: language })
  return cards
}

/** Kicker line for homepage songbook corner cards (wireframe §5). */
export function homeSongbookCornerKicker(slot: HomeSongbookCornerSlot, book: SongbookCatalogItem): string {
  if (slot === 'topic') {
    const sutra = (book.sutras || '').split(',')[0]?.trim()
    return sutra ? `TOPIC · ${sutra}` : 'TOPIC'
  }
  if (slot === 'genre') return 'GENRE · Best-of'
  const lang = (book.songbook || '').replace(/^World:\s*/i, '').trim()
  return lang ? `LANGUAGE · ${lang}` : 'LANGUAGE'
}

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
