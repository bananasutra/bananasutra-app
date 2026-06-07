/**
 * Typed GA4 event wrapper (W-002). gtag is installed in index.html;
 * SPA page_view stays in useAnalyticsPageView.ts.
 */

export type AnalyticsEventName =
  | 'page_view'
  | 'play_started'
  | 'play_all_started'
  | 'play_all_stopped'
  | 'track_advanced'
  | 'track_skipped'
  | 'queue_paused_cue_shown'
  | 'queue_resumed'
  | 'video_started'
  | 'video_advanced'
  | 'mode_changed'
  | 'mini_bar_dismissed'
  | 'lyrics_scroll'
  | 'lyrics_expand'
  | 'lyrics_extract_viewed'
  | 'songbook_promo_click'
  | 'songbook_track_tap'
  | 'bertrand_open'
  | 'bertrand_message_sent'
  | 'bertrand_recommendation_clicked'
  | 'bertrand_session_complete'
  | 'filter_applied'
  | 'filter_cleared'
  | 'collection_saved'

export type AnalyticsMode = 'read' | 'listen' | 'watch'

/** Until mode-toggle ships (P1), send this on all P0 events. */
export const ANALYTICS_MODE_PRE_TOGGLE: AnalyticsMode = 'read'

export type QueueSource = 'tracks_filter' | 'songbook' | 'song_variants' | 'single' | 'listen_lp'

export type PlayAllQueueSource = Exclude<QueueSource, 'single'>

export type BertrandSurface =
  | 'home_hero'
  | 'learn_lp_tail'
  | 'listen_lp_tail'
  | 'songs_browse_inline'
  | 'songs_detail_below_lyrics'
  | 'tracks_empty_state'
  | 'videos_empty_state'
  | 'words_inline'
  | 'about_footer'
  | 'mini_bar_icon'
  | 'videos_queue_inline'
  | 'floating_button'

export type FilterRoute = '/songs' | '/tracks' | '/videos' | '/words'

export type PlayAllStopReason = 'user_stop' | 'replaced_by_new_queue' | 'queue_exhausted'

export type EventParams = Record<string, string | number | boolean | undefined>

const MEASUREMENT_ID = 'G-MJLGTXTE5W'

function isDevBuild(): boolean {
  return import.meta.env?.DEV === true
}

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void
    dataLayer?: unknown[]
  }
}

function stripUndefined(params: EventParams): Record<string, string | number | boolean> {
  return Object.fromEntries(
    Object.entries(params).filter((entry): entry is [string, string | number | boolean] => {
      const value = entry[1]
      return value !== undefined
    }),
  )
}

const DEBUG_SEARCH = /(?:^|[?&])debug_mode=1(?:&|$)/

function enableDebugModeOnGtag(): boolean {
  if (!window.gtag) return false
  window.gtag('config', MEASUREMENT_ID, { debug_mode: true })
  if (isDevBuild()) console.debug('[analytics] debug_mode enabled for DebugView')
  return true
}

/** Enable GA4 DebugView when URL includes ?debug_mode=1 (retries until gtag loads). */
export function applyAnalyticsDebugFromSearch(search: string): void {
  if (typeof window === 'undefined') return
  if (!DEBUG_SEARCH.test(search)) return
  if (enableDebugModeOnGtag()) return
  let attempts = 0
  const id = window.setInterval(() => {
    attempts += 1
    if (enableDebugModeOnGtag() || attempts >= 40) {
      window.clearInterval(id)
    }
  }, 250)
}

export function track(name: AnalyticsEventName, params: EventParams = {}): void {
  if (typeof window === 'undefined') return
  if (!window.gtag) {
    if (isDevBuild()) console.warn(`[analytics] gtag not loaded; dropping ${name}`, params)
    return
  }
  const clean = stripUndefined(params)
  if (isDevBuild()) console.debug(`[analytics] ${name}`, clean)
  window.gtag('event', name, clean)
}

// --- P0 listening (current player; Session 3 wires call sites) ---

export function trackPlayStarted(p: {
  track_id: string
  song_id: string
  sutra: string
  primary_genre: string
  source: QueueSource
  mode?: AnalyticsMode
  from_resume?: boolean
}): void {
  track('play_started', {
    ...p,
    mode: p.mode ?? ANALYTICS_MODE_PRE_TOGGLE,
  })
}

export function trackPlayAllStarted(p: {
  source: PlayAllQueueSource
  total: number
  mode?: AnalyticsMode
  filter_sutra?: string
  filter_genre?: string
  songbook_slug?: string
  collection_name?: string
}): void {
  track('play_all_started', {
    ...p,
    mode: p.mode ?? ANALYTICS_MODE_PRE_TOGGLE,
  })
}

export function trackPlayAllStopped(p: {
  source: PlayAllQueueSource
  tracks_played: number
  total: number
  reason: PlayAllStopReason
  mode?: AnalyticsMode
}): void {
  track('play_all_stopped', {
    ...p,
    mode: p.mode ?? ANALYTICS_MODE_PRE_TOGGLE,
  })
}

export function trackTrackAdvanced(p: {
  from_track_id: string
  to_track_id: string
  position: number
  total: number
  source: QueueSource
  mode?: AnalyticsMode
}): void {
  track('track_advanced', {
    ...p,
    mode: p.mode ?? ANALYTICS_MODE_PRE_TOGGLE,
  })
}

export function trackTrackSkipped(p: {
  from_track_id: string
  to_track_id: string
  direction: 'next' | 'previous'
  source: QueueSource
  mode?: AnalyticsMode
}): void {
  track('track_skipped', {
    ...p,
    mode: p.mode ?? ANALYTICS_MODE_PRE_TOGGLE,
  })
}

export function trackFilterApplied(p: {
  route: FilterRoute
  facet: string
  value: string
  mode?: AnalyticsMode
}): void {
  track('filter_applied', {
    ...p,
    mode: p.mode ?? ANALYTICS_MODE_PRE_TOGGLE,
  })
}

export function trackFilterCleared(p: {
  route: FilterRoute
  facets_cleared_count: number
}): void {
  track('filter_cleared', p)
}

// --- P1+ helpers (typed for upcoming slices) ---

export function trackModeChanged(p: { from: AnalyticsMode; to: AnalyticsMode; surface: string }): void {
  track('mode_changed', p)
}

export function trackBertrandOpen(p: {
  surface: BertrandSurface
  mode?: AnalyticsMode
  song_id?: string
  sutra?: string
}): void {
  track('bertrand_open', {
    ...p,
    mode: p.mode ?? ANALYTICS_MODE_PRE_TOGGLE,
  })
}
