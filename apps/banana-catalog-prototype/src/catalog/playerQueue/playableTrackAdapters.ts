import { coverImageUrl } from '../../seo/imageUrl'
import type { SongDetailTrack, TrackCatalogItem } from '../types'
import type { PlayableTrack } from './types'

function soundcloudThumbUrl(url: string, size = 't200x200'): string {
  const u = url.trim()
  if (!u) return ''
  return u
    .replace(/-t\d+x\d+\./i, `-${size}.`)
    .replace(/-toriginal\./i, `-${size}.`)
}

export function playableTrackCoverImage(track: PlayableTrack, width = 96): string {
  const raw = track.cover_url?.trim() ?? ''
  if (!raw) return ''
  return coverImageUrl(soundcloudThumbUrl(raw), { width })
}

export type PlayableTrackSelectionMode = 'track_id' | 'sc_url'

export function songDetailTrackToPlayable(
  track: SongDetailTrack,
  lyricsExtract?: string,
  urlSlug?: string,
): PlayableTrack {
  const cover = track.artwork_url?.trim() || undefined
  const slug = urlSlug?.trim() || undefined
  return {
    track_id: track.track_id,
    sc_url: track.sc_url,
    track_title: track.track_title,
    lyrics_title: track.lyrics_title,
    lyrics_id: track.lyrics_id,
    sutra: track.sutra ?? '',
    primary_genre: track.primary_genre ?? '',
    lyrics_extract: lyricsExtract?.trim() || undefined,
    cover_url: cover,
    duration_sec: track.duration_sec,
    duration_raw: track.duration_raw,
    play_count: track.play_count,
    like_count: track.like_count,
    secondary_genres: track.secondary_genres,
    url_slug: slug,
  }
}

export function trackCatalogItemToPlayable(track: TrackCatalogItem): PlayableTrack {
  const base = songDetailTrackToPlayable(track, undefined, track.url_slug)
  const cover = track.list_cover_url?.trim() || track.artwork_url?.trim() || undefined
  return { ...base, cover_url: cover ?? base.cover_url }
}

export function playableTrackKey(track: PlayableTrack, mode: PlayableTrackSelectionMode): string {
  if (mode === 'sc_url') return track.sc_url.trim()
  return track.track_id
}

export function normScUrl(url: string): string {
  return url.trim()
}
