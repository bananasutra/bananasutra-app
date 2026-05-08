import type { YouTubeCatalogVideo } from './types'
import { songCatalogPath } from './songPaths'

/** `/songs/:slug` when this catalog video row maps to an in-app song; otherwise null. */
export function featuredYoutubeSongPageHref(
  video: Pick<YouTubeCatalogVideo, 'lyrics_id' | 'lyrics_title' | 'title' | 'url_slug'> | null | undefined,
  songInCatalog: boolean,
): string | null {
  if (!video || !songInCatalog) return null
  const id = (video.lyrics_id || '').trim()
  if (!id) return null
  const title = (video.lyrics_title || video.title || '').trim()
  if (!title) return null
  return songCatalogPath(title, video.url_slug)
}
