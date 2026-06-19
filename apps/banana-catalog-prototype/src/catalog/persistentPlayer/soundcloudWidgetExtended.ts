/**
 * Extended SoundCloud Widget API surface for persistent-player work (P3 spike + W-025).
 * Keeps `soundcloudWidgetApi.ts` unchanged until a later slice confirms the contract.
 */

import type { SoundCloudWidget, SoundCloudWidgetEvents } from '../soundcloudWidgetApi'

export type SoundCloudWidgetLoadOptions = {
  auto_play?: boolean
  color?: string
  hide_related?: boolean
  show_comments?: boolean
  show_user?: boolean
  show_reposts?: boolean
  show_teaser?: boolean
  show_artwork?: boolean
  show_playcount?: boolean
  visual?: boolean
  dnt?: boolean
  /** Fired when the newly loaded widget is ready (SC load options). */
  callback?: () => void
}

/** Widget handle with load/seek helpers used by persistent player queue logic. */
export type SoundCloudWidgetExtended = SoundCloudWidget & {
  load(url: string, options?: SoundCloudWidgetLoadOptions): void
  seekTo(ms: number): void
  getPosition(callback: (positionMs: number) => void): void
  getDuration(callback: (durationMs: number) => void): void
  getCurrentSound(callback: (sound: { permalink_url?: string } | null) => void): void
  isPaused(callback: (paused: boolean) => void): void
}

export type SoundCloudWidgetGlobal = {
  Widget: ((iframe: HTMLIFrameElement) => SoundCloudWidgetExtended) & {
    Events: SoundCloudWidgetEvents & {
      PLAY_PROGRESS: string
      READY: string
    }
  }
}

/** Shmobster #1 — persistent iframe must allow encrypted-media (not only autoplay). */
export const PERSISTENT_SC_IFRAME_ALLOW = 'autoplay; encrypted-media'

/** Near-end threshold for PLAY_PROGRESS / position-poll FINISH fallback (Shmobster #3). */
export const SC_FINISH_FALLBACK_LEAD_MS = 1200

export type WidgetPlaybackBindings = {
  onReady?: () => void
  onFinish?: () => void
  onPlayProgress?: (positionMs: number) => void
  onPlayingChange?: (playing: boolean) => void
}

/**
 * Shmobster #2 — FINISH must re-bind after every widget.load() via READY.
 * Shmobster #3 — PLAY_PROGRESS wired for near-end fallback when FINISH misfires.
 */
export function bindPersistentWidgetPlayback(
  widget: SoundCloudWidgetExtended,
  SC: SoundCloudWidgetGlobal,
  handlers: WidgetPlaybackBindings,
): void {
  const { onReady, onFinish, onPlayProgress, onPlayingChange } = handlers
  const events = SC.Widget.Events

  widget.unbind(events.READY)
  widget.unbind(events.PLAY)
  widget.unbind(events.PAUSE)
  widget.unbind(events.FINISH)
  widget.unbind(events.PLAY_PROGRESS)

  widget.bind(events.READY, () => {
    onReady?.()
    if (onFinish) {
      widget.unbind(events.FINISH)
      widget.bind(events.FINISH, onFinish)
    }
  })

  if (onPlayingChange) {
    widget.bind(events.PLAY, () => onPlayingChange(true))
    widget.bind(events.PAUSE, () => onPlayingChange(false))
  }

  if (onPlayProgress) {
    widget.bind(events.PLAY_PROGRESS, () => {
      widget.getPosition((positionMs) => onPlayProgress(positionMs))
    })
  }
}
