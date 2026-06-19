/**
 * Mini-bar queue context line (CROSS-SONG-LISTENING-SPEC Rule 5).
 * Under 50 chars where possible; no em-dashes per voice guide.
 */

import type { TracksFilterState } from '../types'
import { TRACKS_BROWSER_FACET_ORDER } from '../catalogFacetConfig'
import type { PlayerQueueSource, PlayerQueueState, PlayableTrack } from './types'
import { currentQueueTrack } from './types'

function sutraFilterLabel(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ''
  return /sutra$/i.test(trimmed) ? trimmed : `${trimmed}sutra`
}

function tracksFilterHasContext(filters: TracksFilterState, find: string): boolean {
  if (find.trim()) return true
  return TRACKS_BROWSER_FACET_ORDER.some((key) => filters[key].size > 0)
}

export function tracksFilterCollectionLabel(filters: TracksFilterState, find: string): string {
  const parts: string[] = []
  const findTrim = find.trim()
  if (findTrim) parts.push(`search “${findTrim}”`)

  for (const key of TRACKS_BROWSER_FACET_ORDER) {
    for (const value of filters[key]) {
      parts.push(key === 'sutra' ? sutraFilterLabel(value) : value)
    }
  }

  if (parts.length === 0) return ''
  if (parts.length <= 3) return parts.join(' · ')
  return `${parts.length} filters`
}

function tracksFilterContextLine(
  source: Extract<PlayerQueueSource, { type: 'tracks_filter' }>,
  position: number,
  total: number,
): string {
  const n = position + 1
  if (!tracksFilterHasContext(source.filters, source.find) && !source.collection_name?.trim()) {
    return `Playing top track ${n} of ${total}`
  }
  const collection =
    source.collection_name?.trim() || tracksFilterCollectionLabel(source.filters, source.find)
  return collection
    ? `Playing top track ${n} of ${total} from ${collection}`
    : `Playing top track ${n} of ${total}`
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
      return `Playing top track ${position + 1} of ${total} from ${source.songbook_name}`
    case 'song_variants':
      return `Playing song top track ${position + 1} of ${total}`
    case 'listen_lp':
      return `Playing top track ${position + 1} of ${total}`
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
