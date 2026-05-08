/**
 * URL segment from display title. Song pages live at `/songs/:slug` (this value); data
 * is still keyed by `lyrics_id` in JSON. Normalized on load when the path segment drifts.
 */
export function lyricsTitleToUrlSlug(title: string): string {
  const base = title
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72)
  return base || 'song'
}

/** Resolved `/about/:slug` segment when sutra pages use JSON context (Airtable slug or slugified label). */
export function sutraCatalogUrlSlug(row: { sutra: string; url_slug_sutra?: string }): string {
  const raw = (row.url_slug_sutra || '').trim()
  if (raw) return raw
  return lyricsTitleToUrlSlug(row.sutra)
}

/** URL segment for songbook names (cosmetic, resolved by lookup map). */
export function songbookToUrlSlug(songbook: string): string {
  const base = songbook
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72)
  return base || 'songbook'
}
