import type { SongbookCatalogItem, YouTubePlaylistCatalogItem } from './types'

/** Mirrors listen LP genre labels: `ROCKsutra (Best Of)` and `ROCKsutra` → `ROCK`. */
export function genreLabelFromName(name: string): string {
  return name
    .replace(/\s*\(Best Of\)\s*/gi, '')
    .replace(/\s*sutra\s*/gi, '')
    .trim()
    .toUpperCase()
}

function isGenreSongbookType(songbookType: string): boolean {
  return songbookType.trim().toLowerCase() === 'genre'
}

function isGenreAllPlaylist(playlist: YouTubePlaylistCatalogItem): boolean {
  return (playlist.playlist_type || '').trim().toLowerCase() === 'genre (all)'
}

function isSongbookPlaylist(playlist: YouTubePlaylistCatalogItem): boolean {
  return (playlist.playlist_type || '').trim().toLowerCase() === 'songbook'
}

function subtitleAfterColon(value: string): string {
  const idx = value.indexOf(':')
  return idx >= 0 ? value.slice(idx + 1).trim() : value.trim()
}

function matchTokens(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/\(best of\)/gi, '')
    .replace(/sutra/gi, '')
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 2)
}

function tokenOverlapScore(left: string, right: string): number {
  const a = new Set(matchTokens(left))
  const b = new Set(matchTokens(right))
  if (!a.size || !b.size) return 0
  let overlap = 0
  for (const token of a) {
    if (b.has(token)) overlap += 1
  }
  return overlap / Math.max(a.size, b.size)
}

function genrePlaylistForSongbook(
  book: Pick<SongbookCatalogItem, 'songbook'>,
  playlists: readonly YouTubePlaylistCatalogItem[],
): YouTubePlaylistCatalogItem | null {
  const label = genreLabelFromName(book.songbook)
  if (!label) return null
  return playlists.find((row) => isGenreAllPlaylist(row) && genreLabelFromName(row.playlist_name) === label) ?? null
}

/** Best-effort SC songbook → YT playlist pairing (genre label or fuzzy subtitle overlap). */
export function youtubePlaylistForSongbook(
  book: Pick<SongbookCatalogItem, 'songbook' | 'songbook_type'>,
  playlists: readonly YouTubePlaylistCatalogItem[],
): YouTubePlaylistCatalogItem | null {
  const songbookType = (book.songbook_type || '').trim().toLowerCase()
  if (isGenreSongbookType(songbookType)) {
    return genrePlaylistForSongbook(book, playlists)
  }

  const pool = playlists.filter(isSongbookPlaylist)
  if (!pool.length) return null

  const bookKey = subtitleAfterColon((book.songbook || '').trim())
  let best: YouTubePlaylistCatalogItem | null = null
  let bestScore = 0

  for (const playlist of pool) {
    const score = tokenOverlapScore(bookKey, subtitleAfterColon((playlist.playlist_name || '').trim()))
    if (score > bestScore) {
      bestScore = score
      best = playlist
    }
  }

  return bestScore >= 0.34 ? best : null
}

/** Genre YT playlist → `/songbooks/:slug` when a genre best-of row exists. */
export function songbookSlugForYoutubePlaylist(
  playlist: Pick<YouTubePlaylistCatalogItem, 'playlist_name' | 'playlist_type'>,
  books: readonly Pick<SongbookCatalogItem, 'songbook' | 'songbook_type' | 'url_slug_songbook'>[],
): string | null {
  if (!isGenreAllPlaylist(playlist as YouTubePlaylistCatalogItem)) return null
  const label = genreLabelFromName(playlist.playlist_name)
  if (!label) return null
  const book = books.find(
    (row) => isGenreSongbookType(row.songbook_type || '') && genreLabelFromName(row.songbook) === label,
  )
  return (book?.url_slug_songbook || '').trim() || null
}
