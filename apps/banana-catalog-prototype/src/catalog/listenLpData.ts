import type { SongCatalogItem, SongbookCatalogItem, TrackCatalogItem } from './types'
import { pickRandomSongbookFromPool, songbookPopularity } from './homePortalUtils'

export const LISTEN_LP_TOP_TRACKS_LIMIT = 10
export const LISTEN_LP_LATEST_SONGS_LIMIT = 10

export type ListenLpSutraFilter = 'ALL' | string

export type ListenLpSongbookPick = SongbookCatalogItem & { slug: string }

export const LISTEN_LP_SUTRA_FILTER_OPTIONS: { value: ListenLpSutraFilter; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'KNOWsutra', label: 'KNOWsutra' },
  { value: 'BLOWsutra', label: 'BLOWsutra' },
  { value: 'SHOWsutra', label: 'SHOWsutra' },
  { value: 'GROWsutra', label: 'GROWsutra' },
  { value: 'FLOWsutra', label: 'FLOWsutra' },
  { value: 'GLOWsutra', label: 'GLOWsutra' },
  { value: 'BOWsutra', label: 'BOWsutra' },
  { value: 'QUACKsutra', label: 'QUACKsutra' },
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
  sutraCount: number
  genreCount: number
}): string {
  const parts: string[] = []
  if (p.activeSutra !== 'ALL') parts.push(p.activeSutra)
  if (p.activeGenre !== 'ALL') parts.push(p.activeGenre)
  if (parts.length) {
    return `${parts.join(' · ')} · ${p.sutraCount} in sutra list · ${p.genreCount} in genre list`
  }
  return `${p.sutraCount} story songbooks · ${p.genreCount} genre songbooks in the lists below`
}
