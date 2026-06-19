/**
 * W-023 — shared desktop player queue contract (CROSS-SONG-LISTENING-SPEC § implementation).
 * W-024 wires TracksPage + SongDetail; W-025 mounts provider + persistent iframe at App root.
 */

import type { TrackSortMode, TracksFilterState } from '../types'

/** Minimal track shape the queue engine needs (TrackCatalogItem / SongDetailTrack satisfy this). */
export type PlayableTrack = {
  track_id: string
  sc_url: string
  track_title: string
  lyrics_title: string
  lyrics_id: string
  sutra: string
  primary_genre: string
  /** Mini-bar single-track fallback copy when no queue source. */
  lyrics_extract?: string
  /** List / artwork thumbnail for persistent mini-bar. */
  cover_url?: string
  duration_sec?: number
  duration_raw?: string
  play_count?: number
  like_count?: number
  secondary_genres?: string[]
  /** Canonical `/songs/:slug` segment for mini-bar song link. */
  url_slug?: string
}

/** Discriminated queue origin — richer than analytics `QueueSource` string literals. */
export type PlayerQueueSource =
  | {
      type: 'tracks_filter'
      filters: TracksFilterState
      find: string
      sort: TrackSortMode
      /** Named saved collection (W-033 filter-URL collections). */
      collection_name?: string
    }
  | {
      type: 'songbook'
      songbook_slug: string
      songbook_name: string
    }
  | {
      type: 'song_variants'
      song_id: string
      song_title: string
      song_slug?: string
    }
  | {
      type: 'listen_lp'
    }
  | {
      type: 'single'
      track_id: string
    }

export type PlayerQueueState = {
  /** Null when idle or after stop. */
  source: PlayerQueueSource | null
  tracks: readonly PlayableTrack[]
  /** 0-indexed index into `tracks`. */
  position: number
  playing: boolean
  /** From SoundCloud widget.getPosition(); 0 when unknown. */
  currentPositionMs: number
  /** True during an active play-all session (TracksPage `playAllActive` parity). */
  playAllActive: boolean
}

export type PickTrackOptions = {
  /** Keep play-all session when picking another row in the same queue. */
  keepPlayAll?: boolean
  /**
   * Play All start (desktop): keep embed mounted when row already selected and call
   * widget.play() synchronously inside the click handler (Safari gesture chain).
   */
  fromPlayAllStart?: boolean
}

export type PlayerQueueActions = {
  /** Replace queue and start play-all from track 0 (desktop user gesture required for autoplay). */
  startPlayAll: (source: Exclude<PlayerQueueSource, { type: 'single' }>, tracks: readonly PlayableTrack[]) => void
  /** User picks a row; replaces queue unless `keepPlayAll` and play-all is active. */
  pickTrack: (track: PlayableTrack, options?: PickTrackOptions) => void
  /** Called from SC FINISH / near-end fallback (WidgetLoadQueueController.advance parity). */
  advance: () => void
  jump: (delta: -1 | 1) => void
  jumpTo: (position: number) => void
  pause: () => void
  resume: () => void
  /** Stop play-all, pause widget, clear queue source. */
  stop: () => void
  /** W-029c — songbook embed track tap hands off to persistent player. */
  handoffFromSongbookEmbed: (
    source: Extract<PlayerQueueSource, { type: 'songbook' }>,
    tracks: readonly PlayableTrack[],
    startPosition: number,
  ) => void
}

export type PlayerQueueContextValue = {
  state: PlayerQueueState
  actions: PlayerQueueActions
}

/**
 * URL sync rules (no queue keys in location.search):
 * - `tracks_filter`: queue list mirrors filtered `/tracks` rows at start time; filter URL updates do not auto-restart queue.
 * - `song_variants` / `listen_lp`: queue from page-local track list at start time.
 * - `songbook`: slug/name captured at handoff; route change does not clear queue (persistent player, W-025).
 * - Resume position (W-030): sessionStorage only, not URL.
 */

export function currentQueueTrack(state: PlayerQueueState): PlayableTrack | null {
  if (!state.tracks.length || state.position < 0 || state.position >= state.tracks.length) return null
  return state.tracks[state.position] ?? null
}

export function selectedTrackId(state: PlayerQueueState): string | null {
  return currentQueueTrack(state)?.track_id ?? null
}

export function selectedScUrl(state: PlayerQueueState): string | null {
  const url = currentQueueTrack(state)?.sc_url?.trim()
  return url || null
}

export function queueIsActive(state: PlayerQueueState): boolean {
  return state.playAllActive && state.tracks.length > 0 && state.source != null
}

/** True when any playback session is in flight (play-all, single pick, or paused queue). */
export function queueSessionActive(state: PlayerQueueState): boolean {
  return state.playAllActive || state.playing || state.source != null
}

export type PlayerQueuePageKind = 'tracks' | 'song_detail' | 'listen_lp' | 'songbook'

/** Whether the global queue `source` was started from this page (cross-route UI gating). */
export function queueSessionOwnsPage(state: PlayerQueueState, page: PlayerQueuePageKind): boolean {
  if (!state.source) return !state.playAllActive
  switch (page) {
    case 'tracks':
      return state.source.type === 'tracks_filter'
    case 'song_detail':
      return state.source.type === 'song_variants'
    case 'listen_lp':
      return state.source.type === 'listen_lp'
    case 'songbook':
      return state.source.type === 'songbook'
    default:
      return false
  }
}
