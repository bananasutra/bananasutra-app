import songSlugIndexJson from '../data/generated/song_slug_index.json'
import { lyricsTitleToUrlSlug } from './slugify'

type SongSlugIndexPayload = { bySlug: Record<string, string> }

const slugToLyricsId = new Map<string, string>(Object.entries((songSlugIndexJson as SongSlugIndexPayload).bySlug))

/** Public path segment: Airtable `url_slug` when non-empty, else slug from title. */
export function catalogPathSlugFromTitleAndSlug(lyricsTitle: string, urlSlug?: string | null): string {
  const s = (urlSlug ?? '').trim()
  if (s) return s
  return lyricsTitleToUrlSlug((lyricsTitle || '').trim())
}

/** `/songs/:slug` path for a song given title + optional Airtable slug. */
export function songCatalogPath(lyricsTitle: string, urlSlug?: string | null): string {
  return `/songs/${catalogPathSlugFromTitleAndSlug(lyricsTitle, urlSlug)}`
}

/** Resolve `lyrics_id` from the URL slug segment, or `undefined` if unknown. */
export function lyricsIdFromSongUrlSlug(urlSlug: string): string | undefined {
  const trimmed = decodeURIComponent(urlSlug).trim()
  if (!trimmed) return undefined
  return slugToLyricsId.get(trimmed) ?? slugToLyricsId.get(lyricsTitleToUrlSlug(trimmed))
}
