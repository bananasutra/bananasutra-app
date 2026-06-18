/**
 * Mini-bar queue context line (CROSS-SONG-LISTENING-SPEC Rule 5).
 * Under 50 chars where possible; no em-dashes per voice guide.
 */

import type { PlayerQueueSource, PlayerQueueState, PlayableTrack } from './types'
import { currentQueueTrack } from './types'

function firstSetValue(set: Set<string> | undefined): string | undefined {
  if (!set?.size) return undefined
  return set.values().next().value
}

function tracksFilterContextLine(
  source: Extract<PlayerQueueSource, { type: 'tracks_filter' }>,
  position: number,
  total: number,
): string {
  const n = position + 1
  if (source.collection_name?.trim()) {
    return `Playing track ${n} of ${total} from ${source.collection_name.trim()}`
  }
  const sutra = firstSetValue(source.filters.sutra)
  const genre = firstSetValue(source.filters.primary_genre)
  if (sutra && genre) return `Playing track ${n} of ${total} from ${sutra}sutra · ${genre}`
  if (sutra) return `Playing track ${n} of ${total} from ${sutra}sutra`
  if (genre) return `Playing track ${n} of ${total} from ${genre}`
  return `Playing track ${n} of ${total} from filtered tracks`
}

function singleTrackContextLine(track: PlayableTrack): string {
  const excerpt = track.lyrics_extract?.trim()
  if (excerpt) return excerpt
  const sutra = track.sutra?.trim()
  const genre = track.primary_genre?.trim()
  if (sutra && genre) return `${sutra} · ${genre}`
  if (sutra) return sutra
  if (genre) return genre
  return track.lyrics_title?.trim() || track.track_title?.trim() || ''
}

/** Second line of the persistent mini-bar while a queue or single track is active. */
export function queueContextLine(state: PlayerQueueState): string {
  const { source, position, tracks } = state
  const total = tracks.length
  const current = currentQueueTrack(state)
  if (!current) return ''

  if (!source || source.type === 'single') {
    return singleTrackContextLine(current)
  }

  switch (source.type) {
    case 'tracks_filter':
      return tracksFilterContextLine(source, position, total)
    case 'songbook':
      return `Playing from ${source.songbook_name}`
    case 'song_variants':
      return `Playing track ${position + 1} of ${total} from ${source.song_title}`
    case 'listen_lp':
      return `Playing track ${position + 1} of ${total} from top tracks`
    default:
      return singleTrackContextLine(current)
  }
}

/** Resume cue after bfcache / iOS unlock (W-028 / W-029). */
export function queueResumeContextLine(positionSec: number): string {
  const m = Math.floor(positionSec / 60)
  const s = Math.floor(positionSec % 60)
  return `Resume from ${m}:${String(s).padStart(2, '0')} ↻`
}

export const QUEUE_PAUSED_RECOVERY_COPY = 'Queue paused. Tap to resume'
