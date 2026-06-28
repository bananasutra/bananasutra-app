import { catalogPathSlugFromTitleAndSlug } from './songPaths'

/** Use window.location.origin so dev/staging/prod all resolve correctly. */
function baseUrl(): string {
  if (typeof window !== 'undefined') return window.location.origin
  return 'https://bananasutra.com'
}

/**
 * Deep-link to a specific track on a song's audio tab.
 * Landing on this URL: song detail page opens audio tab + selects that track.
 * Format: /songs/:slug/?section=audio&t=:track_id
 */
export function trackShareUrl(
  lyricsTitle: string,
  urlSlug: string | null | undefined,
  trackId: string,
): string {
  const slug = catalogPathSlugFromTitleAndSlug(lyricsTitle, urlSlug)
  return `${baseUrl()}/songs/${slug}/?section=audio&t=${encodeURIComponent(trackId)}`
}

/** Share a song page (no specific track). */
export function songShareUrl(
  lyricsTitle: string,
  urlSlug: string | null | undefined,
): string {
  const slug = catalogPathSlugFromTitleAndSlug(lyricsTitle, urlSlug)
  return `${baseUrl()}/songs/${slug}/`
}

/** Share a songbook detail page. */
export function songbookShareUrl(slug: string): string {
  return `${baseUrl()}/songbooks/${slug.trim()}/`
}

/** Share the current page URL as-is (use for filtered /tracks lists). */
export function currentPageShareUrl(): string {
  if (typeof window !== 'undefined') return window.location.href
  return ''
}
