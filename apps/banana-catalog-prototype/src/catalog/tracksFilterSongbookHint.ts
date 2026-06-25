import { TRACKS_BROWSER_FACET_ORDER } from './catalogFacetConfig'
import { allSongbooks } from './songbooks'
import { primaryGenreTokenFromSongbookTitle } from './songbookGenreToken'
import { primarySutraKeyForSongbook, sutraFamilyKeyFromSongField } from './sutraPageUtils'
import type { SongbookCatalogItem } from './types'
import type { TracksFilterState } from './types'
import { songbookCatalogPath } from './songPaths'

export type TracksSongbookHint = {
  songbook: string
  href: string
}

function songbookHasPlaylist(book: SongbookCatalogItem): boolean {
  return Boolean((book.playlist_url || '').trim())
}

function songbookPopularityScore(book: SongbookCatalogItem): number {
  return book.playlist_total_plays + 40 * book.playlist_total_likes + book.songs_with_in_app_playback
}

function pickBestSongbook(candidates: SongbookCatalogItem[]): TracksSongbookHint | null {
  const playable = candidates.filter((b) => b.songbook_in_app && songbookHasPlaylist(b))
  if (playable.length === 0) return null
  playable.sort(
    (a, b) =>
      songbookPopularityScore(b) - songbookPopularityScore(a) ||
      a.songbook.localeCompare(b.songbook, undefined, { sensitivity: 'base' }),
  )
  const best = playable[0]!
  const slug = (best.url_slug_songbook || '').trim()
  if (!slug) return null
  return { songbook: best.songbook, href: songbookCatalogPath(slug) }
}

function activeFilterCount(filters: TracksFilterState, find: string): number {
  let n = find.trim() ? 1 : 0
  for (const key of TRACKS_BROWSER_FACET_ORDER) {
    n += filters[key].size
  }
  return n
}

function genreSongbookForToken(token: string): TracksSongbookHint | null {
  const normalized = token.trim().toUpperCase()
  if (!normalized) return null
  const books = allSongbooks().filter((b) => {
    if ((b.songbook_type || '').trim().toLowerCase() !== 'genre') return false
    return primaryGenreTokenFromSongbookTitle(b.songbook) === normalized
  })
  return pickBestSongbook(books)
}

function sutraSongbookForFilter(sutraValue: string): TracksSongbookHint | null {
  const family = sutraFamilyKeyFromSongField(sutraValue)
  if (!family) return null
  const books = allSongbooks().filter((b) => {
    if ((b.songbook_type || '').trim().toLowerCase() !== 'sutra') return false
    const key = primarySutraKeyForSongbook(b)
    if (family === 'QUACK') return key === 'QUACK'
    return key === family
  })
  return pickBestSongbook(books)
}

function songbookForFindQuery(find: string): TracksSongbookHint | null {
  const q = find.trim().toLowerCase()
  if (q.length < 2) return null
  const books = allSongbooks().filter((b) => b.songbook.toLowerCase().includes(q))
  return pickBestSongbook(books)
}

/**
 * Suggest one in-app songbook playlist when /tracks filters map cleanly to catalog taxonomy.
 * Returns null when filters are ambiguous — caller falls back to /songbooks browse.
 */
export function songbookHintForTracksFilters(
  filters: TracksFilterState,
  find: string,
): TracksSongbookHint | null {
  if (activeFilterCount(filters, find) !== 1) return null

  if (filters.primary_genre.size === 1) {
    const [genre] = filters.primary_genre
    return genreSongbookForToken(genre)
  }

  if (filters.sutra.size === 1) {
    const [sutra] = filters.sutra
    return sutraSongbookForFilter(sutra)
  }

  if (find.trim()) {
    return songbookForFindQuery(find)
  }

  return null
}
