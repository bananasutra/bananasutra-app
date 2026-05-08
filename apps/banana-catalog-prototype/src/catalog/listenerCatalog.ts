import type { SongCatalogItem } from './types'

/** True when song has any listener media surface (SC or YT). */
export function hasAnyListenerMedia(song: SongCatalogItem): boolean {
  return Boolean(
    song.has_in_app_playback ||
      song.has_youtube_video ||
      song.has_sc_catalog_listen ||
      song.primary_ep_url?.trim(),
  )
}

/** Rows that belong on the listener `/songs` grid (curated SC, SC catalog track, linked EP, and/or YouTube on file). */
export function hasListenerCatalogMedia(song: SongCatalogItem): boolean {
  return hasAnyListenerMedia(song)
}

/** Lyrics-only row: no SC/YT media path in this snapshot. */
export function isLyricsOnlySong(song: SongCatalogItem): boolean {
  return !hasAnyListenerMedia(song)
}
