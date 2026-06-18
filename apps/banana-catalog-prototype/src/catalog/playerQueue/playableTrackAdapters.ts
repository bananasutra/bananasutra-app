import type { SongDetailTrack, TrackCatalogItem } from '../types'
import type { PlayableTrack } from './types'

export type PlayableTrackSelectionMode = 'track_id' | 'sc_url'

export function songDetailTrackToPlayable(track: SongDetailTrack, lyricsExtract?: string): PlayableTrack {
  return {
    track_id: track.track_id,
    sc_url: track.sc_url,
    track_title: track.track_title,
    lyrics_title: track.lyrics_title,
    lyrics_id: track.lyrics_id,
    sutra: track.sutra ?? '',
    primary_genre: track.primary_genre ?? '',
    lyrics_extract: lyricsExtract?.trim() || undefined,
  }
}

export function trackCatalogItemToPlayable(track: TrackCatalogItem): PlayableTrack {
  return songDetailTrackToPlayable(track)
}

export function playableTrackKey(track: PlayableTrack, mode: PlayableTrackSelectionMode): string {
  if (mode === 'sc_url') return track.sc_url.trim()
  return track.track_id
}

export function normScUrl(url: string): string {
  return url.trim()
}
