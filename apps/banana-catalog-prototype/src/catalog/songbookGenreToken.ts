/**
 * Derive tracks `primary_genre` token from SONGBOOK titles like "ROCKsutra (Best Of)" → ROCK.
 * Matches deployed facet casing (uppercase tokens in facets.json).
 */
export function primaryGenreTokenFromSongbookTitle(title: string): string | null {
  const m = /^(.+?)sutra\b/i.exec((title || '').trim())
  if (!m) return null
  const raw = (m[1] || '').trim().toUpperCase()
  return raw || null
}
