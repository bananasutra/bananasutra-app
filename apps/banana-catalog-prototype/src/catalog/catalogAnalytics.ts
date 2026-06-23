/**
 * W-004 — GA4 P0 instrumentation helpers for catalog routes.
 */

import {
  trackFilterApplied,
  trackFilterCleared,
  trackPlayAllStarted,
  trackPlayAllStopped,
  trackPlayCompleted,
  trackPlayStarted,
  trackTrackAdvanced,
  trackTrackSkipped,
  type AnalyticsMode,
  type FilterRoute,
  type PlayAllQueueSource,
  type PlayAllStopReason,
  type QueueSource,
} from '../lib/analytics'
import type { FilterFacetKey, FilterState, SongDetailTrack, TrackCatalogItem, TracksFacetFilterKey, TracksFilterState } from './types'

export type PlaybackIntent = 'user_pick' | 'play_all_start' | 'queue_advance' | 'queue_skip'

function firstSetValue(set: Set<string>): string | undefined {
  const [v] = set
  return v
}

function countSetSelections(state: Record<string, Set<string>>, keys: readonly string[]): number {
  let n = 0
  for (const key of keys) {
    n += state[key]?.size ?? 0
  }
  return n
}

function reportAddedFacets(
  route: FilterRoute,
  prev: Record<string, Set<string>>,
  next: Record<string, Set<string>>,
  keys: readonly string[],
): void {
  for (const key of keys) {
    for (const value of next[key] ?? []) {
      if (!prev[key]?.has(value)) {
        trackFilterApplied({ route, facet: key, value })
      }
    }
  }
}

export function reportSongsFilterPatch(prev: FilterState, next: FilterState): void {
  const keys = Object.keys(prev) as FilterFacetKey[]
  const prevCount = countSetSelections(prev, keys)
  const nextCount = countSetSelections(next, keys)
  if (nextCount === 0 && prevCount > 0) {
    trackFilterCleared({ route: '/songs', facets_cleared_count: prevCount })
    return
  }
  reportAddedFacets('/songs', prev, next, keys)
}

export function reportTracksFilterPatch(prev: TracksFilterState, next: TracksFilterState): void {
  const keys = Object.keys(prev) as TracksFacetFilterKey[]
  const prevCount = countSetSelections(prev, keys)
  const nextCount = countSetSelections(next, keys)
  if (nextCount === 0 && prevCount > 0) {
    trackFilterCleared({ route: '/tracks', facets_cleared_count: prevCount })
    return
  }
  reportAddedFacets('/tracks', prev, next, keys)
}

export function reportWordsFilterPatch(prev: FilterState, next: FilterState): void {
  const keys = Object.keys(prev) as FilterFacetKey[]
  const prevCount = countSetSelections(prev, keys)
  const nextCount = countSetSelections(next, keys)
  if (nextCount === 0 && prevCount > 0) {
    trackFilterCleared({ route: '/words', facets_cleared_count: prevCount })
    return
  }
  reportAddedFacets('/words', prev, next, keys)
}

export type VideosFilterSnapshot = {
  sutra: string
  topic: string
  intention: string
  media: string
  linkTarget: string
}

const VIDEO_FACET_KEYS = ['sutra', 'topic', 'intention', 'media', 'linkTarget'] as const

function countVideoFacets(f: VideosFilterSnapshot): number {
  let n = 0
  if (f.sutra) n += 1
  if (f.topic) n += 1
  if (f.intention) n += 1
  if (f.media && f.media !== 'all') n += 1
  if (f.linkTarget && f.linkTarget !== 'all') n += 1
  return n
}

export function reportVideosFilterTransition(prev: VideosFilterSnapshot, next: VideosFilterSnapshot): void {
  const prevCount = countVideoFacets(prev)
  const nextCount = countVideoFacets(next)
  if (nextCount === 0 && prevCount > 0) {
    trackFilterCleared({ route: '/videos', facets_cleared_count: prevCount })
    return
  }
  for (const key of VIDEO_FACET_KEYS) {
    const p = prev[key]
    const n = next[key]
    const prevActive = key === 'media' || key === 'linkTarget' ? p && p !== 'all' : Boolean(p)
    const nextActive = key === 'media' || key === 'linkTarget' ? n && n !== 'all' : Boolean(n)
    if (nextActive && (!prevActive || p !== n)) {
      trackFilterApplied({ route: '/videos', facet: key, value: n })
    }
  }
}

export function tracksFilterContext(filters: TracksFilterState): {
  filter_sutra?: string
  filter_genre?: string
} {
  return {
    filter_sutra: firstSetValue(filters.sutra),
    filter_genre: firstSetValue(filters.primary_genre),
  }
}

export function trackCatalogPlayStarted(
  track: TrackCatalogItem,
  source: QueueSource,
  intent: PlaybackIntent,
  mode?: AnalyticsMode,
): void {
  if (intent === 'queue_advance' || intent === 'queue_skip') return
  trackPlayStarted({
    track_id: track.track_id,
    song_id: track.lyrics_id,
    sutra: track.sutra?.trim() || '',
    primary_genre: track.primary_genre?.trim() || '',
    source,
    mode,
  })
}

export function trackCatalogPlayAllStarted(
  source: PlayAllQueueSource,
  total: number,
  ctx?: { filter_sutra?: string; filter_genre?: string },
  mode?: AnalyticsMode,
): void {
  trackPlayAllStarted({
    source,
    total,
    mode,
    ...ctx,
  })
}

export function trackCatalogPlayAllStopped(
  source: PlayAllQueueSource,
  tracksPlayed: number,
  total: number,
  reason: PlayAllStopReason,
  mode?: AnalyticsMode,
): void {
  trackPlayAllStopped({
    source,
    tracks_played: Math.max(0, tracksPlayed),
    total,
    reason,
    mode,
  })
}

export function trackCatalogQueueAdvanced(p: {
  from: TrackCatalogItem
  to: TrackCatalogItem
  position: number
  total: number
  source: QueueSource
  mode?: AnalyticsMode
}): void {
  trackTrackAdvanced({
    from_track_id: p.from.track_id,
    to_track_id: p.to.track_id,
    position: p.position,
    total: p.total,
    source: p.source,
    mode: p.mode,
  })
}

export function trackCatalogQueueSkipped(p: {
  from: TrackCatalogItem
  to: TrackCatalogItem
  direction: 'next' | 'previous'
  source: QueueSource
}): void {
  trackTrackSkipped({
    from_track_id: p.from.track_id,
    to_track_id: p.to.track_id,
    direction: p.direction,
    source: p.source,
  })
}

export function findTrackByScUrl(tracks: SongDetailTrack[], url: string): SongDetailTrack | undefined {
  const u = url.trim()
  return tracks.find((t) => t.sc_url.trim() === u)
}

export function trackSongDetailPlayStarted(track: SongDetailTrack, intent: PlaybackIntent): void {
  if (intent === 'queue_advance' || intent === 'queue_skip') return
  trackPlayStarted({
    track_id: track.track_id,
    song_id: track.lyrics_id,
    sutra: track.sutra?.trim() || '',
    primary_genre: track.primary_genre?.trim() || '',
    source: 'song_variants',
  })
}

export function trackSongDetailPlayAllStarted(total: number): void {
  trackPlayAllStarted({ source: 'song_variants', total })
}

export function trackSongDetailPlayAllStopped(
  tracksPlayed: number,
  total: number,
  reason: PlayAllStopReason,
): void {
  trackPlayAllStopped({
    source: 'song_variants',
    tracks_played: Math.max(0, tracksPlayed),
    total,
    reason,
  })
}

export function trackSongDetailQueueAdvanced(p: {
  from: SongDetailTrack
  to: SongDetailTrack
  position: number
  total: number
}): void {
  trackTrackAdvanced({
    from_track_id: p.from.track_id,
    to_track_id: p.to.track_id,
    position: p.position,
    total: p.total,
    source: 'song_variants',
  })
}

export function trackSongDetailQueueSkipped(p: {
  from: SongDetailTrack
  to: SongDetailTrack
  direction: 'next' | 'previous'
}): void {
  trackTrackSkipped({
    from_track_id: p.from.track_id,
    to_track_id: p.to.track_id,
    direction: p.direction,
    source: 'song_variants',
  })
}

export function trackCatalogPlayCompleted(
  track: TrackCatalogItem,
  source: QueueSource,
  mode?: AnalyticsMode,
): void {
  trackPlayCompleted({
    track_id: track.track_id,
    song_id: track.lyrics_id,
    sutra: track.sutra?.trim() || '',
    primary_genre: track.primary_genre?.trim() || '',
    source,
    mode,
  })
}

export function trackSongDetailPlayCompleted(track: SongDetailTrack): void {
  trackPlayCompleted({
    track_id: track.track_id,
    song_id: track.lyrics_id,
    sutra: track.sutra?.trim() || '',
    primary_genre: track.primary_genre?.trim() || '',
    source: 'song_variants',
  })
}
