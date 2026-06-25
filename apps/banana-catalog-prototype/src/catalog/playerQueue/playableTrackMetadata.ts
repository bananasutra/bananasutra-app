import type { To } from 'react-router-dom'
import { formatDurationDisplay } from '../durationFormat'
import { songCatalogLinkTo, songCatalogPath } from '../songPaths'
import { sutraHrefFromSongSutraField } from '../sutraPageUtils'
import type { PlayableTrack } from './types'

/** Genre + duration only (no SC play/like counts in mini-bar). */
export function playableTrackGenreDuration(track: PlayableTrack): string {
  const parts: string[] = []
  const genres = [track.primary_genre, ...(track.secondary_genres ?? [])]
    .map((g) => g.trim())
    .filter(Boolean)
  const genreLine = [...new Set(genres)].slice(0, 3).join(' · ')
  if (genreLine) parts.push(genreLine)

  const duration = formatDurationDisplay(track.duration_sec ?? track.duration_raw)
  if (duration) parts.push(duration)

  return parts.join(' · ')
}

export function playableTrackSongLinkTo(track: PlayableTrack): To | null {
  const title = (track.lyrics_title || track.track_title || '').trim()
  if (!title || !track.lyrics_id?.trim()) return null
  return songCatalogLinkTo(title, track.url_slug, { section: 'audio' })
}

export function playableTrackSongLabel(track: PlayableTrack): string {
  return (track.lyrics_title || track.track_title || '').trim()
}

/** Normalized `/songs/:slug` path for the track's song page (no query/hash). */
export function playableTrackSongPagePath(track: PlayableTrack): string | null {
  const title = playableTrackSongLabel(track)
  if (!title || !track.lyrics_id?.trim()) return null
  return songCatalogPath(title, track.url_slug).replace(/\/$/, '') || null
}

export function normalizeCatalogPathname(pathname: string): string {
  return pathname.split('?')[0]?.split('#')[0]?.replace(/\/$/, '') || '/'
}

/** True when the app is already on this track's song detail page. */
export function isOnPlayableTrackSongPage(track: PlayableTrack, pathname: string): boolean {
  const songPath = playableTrackSongPagePath(track)
  if (!songPath) return false
  return normalizeCatalogPathname(pathname) === songPath
}

export function playableTrackSutraHref(track: PlayableTrack): string | null {
  const sutra = track.sutra?.trim()
  if (!sutra) return null
  return sutraHrefFromSongSutraField(sutra)
}

export function playableTrackSutraLabel(track: PlayableTrack): string {
  return track.sutra?.trim() ?? ''
}
