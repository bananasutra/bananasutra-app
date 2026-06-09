import type { To } from 'react-router-dom'
import songSlugIndexJson from '../data/generated/song_slug_index.json'
import { canonicalPathForRoute } from './seoPaths'
import { lyricsTitleToUrlSlug } from './slugify'

type SongSlugIndexPayload = { bySlug: Record<string, string> }

const slugToLyricsId = new Map<string, string>(Object.entries((songSlugIndexJson as SongSlugIndexPayload).bySlug))

/** Public path segment: Airtable `url_slug` when non-empty, else slug from title. */
export function catalogPathSlugFromTitleAndSlug(lyricsTitle: string, urlSlug?: string | null): string {
  const s = (urlSlug ?? '').trim()
  if (s) return s
  return lyricsTitleToUrlSlug((lyricsTitle || '').trim())
}

/** `/songs/:slug/` path for a song given title + optional Airtable slug. */
export function songCatalogPath(lyricsTitle: string, urlSlug?: string | null): string {
  return `/songs/${catalogPathSlugFromTitleAndSlug(lyricsTitle, urlSlug)}/`
}

/** `/songbooks/:slug/` detail path. */
export function songbookCatalogPath(slug: string): string {
  const s = slug.trim()
  return s ? `/songbooks/${s}/` : canonicalPathForRoute('/songbooks')
}

/** `/sutras/:slug/` sutra detail path (W-074 flat routes; not `/sutras/` hub). */
export function sutraDetailPath(slug: string): string {
  const s = slug.trim().toLowerCase()
  return s ? `/sutras/${s}/` : canonicalPathForRoute('/sutras')
}

/** Fresh song detail link — never inherits listing query params. */
export function songCatalogLinkTo(
  lyricsTitle: string,
  urlSlug?: string | null,
  opts?: { section?: 'audio' | 'video' },
): To {
  const pathname = songCatalogPath(lyricsTitle, urlSlug)
  if (!opts?.section) return pathname
  return { pathname, search: `?section=${opts.section}` }
}

/** Browse row has a listen path worth opening with `?section=audio`. */
export function browseRowHasAudioSection(song: {
  has_sc_catalog_listen?: boolean
  has_in_app_playback?: boolean
}): boolean {
  return Boolean(song.has_sc_catalog_listen || song.has_in_app_playback)
}

/** Resolve `lyrics_id` from the URL slug segment, or `undefined` if unknown. */
export function lyricsIdFromSongUrlSlug(urlSlug: string): string | undefined {
  const trimmed = decodeURIComponent(urlSlug).trim().replace(/\/+$/, '')
  if (!trimmed) return undefined
  return slugToLyricsId.get(trimmed) ?? slugToLyricsId.get(lyricsTitleToUrlSlug(trimmed))
}
