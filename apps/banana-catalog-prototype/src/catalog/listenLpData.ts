import type { SongCatalogItem, SongbookCatalogItem, TrackCatalogItem } from './types'
import { pickRandomSongbookFromPool, songbookPopularity } from './homePortalUtils'
import { SUTRA_CONTEXT, type SutraFamilyKey } from './sutraContext'

export const LISTEN_LP_TOP_TRACKS_LIMIT = 10
export const LISTEN_LP_TOP_EPS_LIMIT = 10
export const LISTEN_LP_LATEST_SONGS_LIMIT = 10
export const LISTEN_LP_SONGBOOK_GRID_INITIAL = 12

export type ListenLpSutraFilter = 'ALL' | string

export type ListenLpSongbookPick = SongbookCatalogItem & { slug: string }

export type ListenLpEpPick = {
  ep_url: string
  ep_title: string
  sutra: string
  primary_genre: string
  like_count: number
  cover_url: string
  url_slug: string
  lyrics_title: string
}

const SUTRA_FILTER_KEYS: { value: ListenLpSutraFilter; family: SutraFamilyKey }[] = [
  { value: 'KNOWsutra', family: 'KNOW' },
  { value: 'BLOWsutra', family: 'BLOW' },
  { value: 'SHOWsutra', family: 'SHOW' },
  { value: 'GROWsutra', family: 'GROW' },
  { value: 'FLOWsutra', family: 'FLOW' },
  { value: 'GLOWsutra', family: 'GLOW' },
  { value: 'BOWsutra', family: 'BOW' },
  { value: 'QUACKsutra', family: 'QUACK' },
]

export const LISTEN_LP_SUTRA_FILTER_OPTIONS: { value: ListenLpSutraFilter; label: string }[] = [
  { value: 'ALL', label: 'All questions' },
  ...SUTRA_FILTER_KEYS.map(({ value, family }) => ({
    value,
    label: SUTRA_CONTEXT[family].question,
  })),
]

function parsePublishedAt(raw: string): number {
  const n = Date.parse((raw || '').trim())
  return Number.isNaN(n) ? 0 : n
}

function primarySutraLabel(book: SongbookCatalogItem): string {
  return (book.sutras || '').split(',')[0]?.trim() || ''
}

function genreLabelFromSongbookName(name: string): string {
  return name
    .replace(/\s*\(Best Of\)\s*/gi, '')
    .replace(/\s*sutra\s*/gi, '')
    .trim()
}

function genreLabelForBook(book: SongbookCatalogItem): string {
  if ((book.songbook_type || '').trim().toLowerCase() === 'genre') {
    return genreLabelFromSongbookName(book.songbook)
  }
  return ''
}

function isSutraSongbook(book: SongbookCatalogItem): boolean {
  return (book.songbook_type || '').trim().toLowerCase() !== 'genre'
}

function isGenreSongbook(book: SongbookCatalogItem): boolean {
  return (book.songbook_type || '').trim().toLowerCase() === 'genre'
}

function matchesSutraFilter(book: SongbookCatalogItem, sutra: ListenLpSutraFilter): boolean {
  if (sutra === 'ALL') return true
  return primarySutraLabel(book).toUpperCase() === sutra.toUpperCase()
}

function matchesGenreFilter(book: SongbookCatalogItem, genre: string): boolean {
  if (genre === 'ALL') return true
  const label = genreLabelForBook(book)
  if (!label) return false
  return label.toUpperCase() === genre.toUpperCase()
}

function sortSongbooksByPopularity(pool: ListenLpSongbookPick[]): ListenLpSongbookPick[] {
  return [...pool].sort((a, b) => songbookPopularity(b) - songbookPopularity(a))
}

export function pickTopTracksForListenLp(catalog: TrackCatalogItem[] | null): TrackCatalogItem[] {
  if (!catalog?.length) return []
  const seen = new Set<string>()
  const pool: TrackCatalogItem[] = []
  for (const row of [...catalog].sort((a, b) => b.play_count - a.play_count)) {
    const slug = (row.url_slug || '').trim()
    if (!slug || !row.sc_url?.trim()) continue
    if (seen.has(slug)) continue
    seen.add(slug)
    pool.push(row)
    if (pool.length >= LISTEN_LP_TOP_TRACKS_LIMIT) break
  }
  return pool
}

export function pickLatestSongsForListenLp(catalog: SongCatalogItem[] | null): SongCatalogItem[] {
  if (!catalog?.length) return []
  return [...catalog]
    .filter((s) => (s.url_slug || '').trim() && (s.cover_image_url || '').trim())
    .sort((a, b) => parsePublishedAt(b.published_at) - parsePublishedAt(a.published_at))
    .slice(0, LISTEN_LP_LATEST_SONGS_LIMIT)
}

export function pickFeaturedListenSongbook(books: ListenLpSongbookPick[]): ListenLpSongbookPick | null {
  const pool = books.filter((b) => isSutraSongbook(b) && (b.playlist_url || '').includes('/sets/'))
  return pickRandomSongbookFromPool(pool, null) as ListenLpSongbookPick | null
}

export function pickSutraSongbooksForListenLp(
  books: ListenLpSongbookPick[],
  activeSutra: ListenLpSutraFilter,
): ListenLpSongbookPick[] {
  const pool = books.filter(
    (b) => isSutraSongbook(b) && (b.url_slug_songbook || '').trim() && matchesSutraFilter(b, activeSutra),
  )
  return sortSongbooksByPopularity(pool)
}

export function pickGenreSongbooksForListenLp(
  books: ListenLpSongbookPick[],
  activeGenre: string,
): ListenLpSongbookPick[] {
  const pool = books.filter(
    (b) => isGenreSongbook(b) && (b.url_slug_songbook || '').trim() && matchesGenreFilter(b, activeGenre),
  )
  return sortSongbooksByPopularity(pool)
}

/** Unified songbook list for explore grid (sutra OR genre filter, not both). */
export function pickExploreSongbooksForListenLp(
  books: ListenLpSongbookPick[],
  activeSutra: ListenLpSutraFilter,
  activeGenre: string,
): ListenLpSongbookPick[] {
  if (activeGenre !== 'ALL') return pickGenreSongbooksForListenLp(books, activeGenre)
  return pickSutraSongbooksForListenLp(books, activeSutra)
}

export function pickTopEpsForListenLp(catalog: SongCatalogItem[] | null): ListenLpEpPick[] {
  if (!catalog?.length) return []
  const byUrl = new Map<string, ListenLpEpPick>()
  for (const row of catalog) {
    const epUrl = (row.primary_ep_url || '').trim()
    if (!epUrl.includes('/sets/')) continue
    const slug = (row.url_slug || '').trim()
    if (!slug) continue
    const likes = row.aggregate_like_count || 0
    const existing = byUrl.get(epUrl)
    if (!existing || likes > existing.like_count) {
      byUrl.set(epUrl, {
        ep_url: epUrl,
        ep_title: (row.primary_ep_title || row.lyrics_title || 'EP').trim(),
        sutra: (row.sutra || '').trim(),
        primary_genre: (row.track_genres?.[0] || row.discovery_top_track_genres || '').trim(),
        like_count: likes,
        cover_url: (row.cover_image_url || '').trim(),
        url_slug: slug,
        lyrics_title: (row.lyrics_title || '').trim(),
      })
    }
  }
  return [...byUrl.values()]
    .sort((a, b) => b.like_count - a.like_count)
    .slice(0, LISTEN_LP_TOP_EPS_LIMIT)
}

export function listenLpGenreFilterOptions(books: ListenLpSongbookPick[]): { value: string; label: string }[] {
  const seen = new Set<string>()
  const options: { value: string; label: string }[] = [{ value: 'ALL', label: 'All' }]
  for (const book of books) {
    if (!isGenreSongbook(book)) continue
    const label = genreLabelForBook(book)
    if (!label || seen.has(label.toUpperCase())) continue
    seen.add(label.toUpperCase())
    options.push({ value: label, label })
  }
  return options.sort((a, b) => {
    if (a.value === 'ALL') return -1
    if (b.value === 'ALL') return 1
    return a.label.localeCompare(b.label)
  })
}

export function listenLpFacetStatusText(p: {
  activeSutra: ListenLpSutraFilter
  activeGenre: string
  shownCount: number
  totalCount: number
}): string {
  const parts: string[] = []
  if (p.activeSutra !== 'ALL') {
    const opt = LISTEN_LP_SUTRA_FILTER_OPTIONS.find((o) => o.value === p.activeSutra)
    parts.push(opt?.label ?? p.activeSutra)
  }
  if (p.activeGenre !== 'ALL') parts.push(p.activeGenre)
  const countLabel =
    p.totalCount > p.shownCount
      ? `${p.shownCount} songbooks shown of ${p.totalCount}`
      : `${p.shownCount} songbooks`
  if (parts.length) return `${parts.join(' · ')} · ${countLabel}`
  return countLabel
}
