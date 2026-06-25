import { createContext, useContext, type MutableRefObject } from 'react'
import type { SoundCloudWidget } from '../soundcloudWidgetApi'

export type PersistentScLoadOptions = {
  autoPlay?: boolean
  /** Bump iframe generation so Play All remounts when the page already holds the same SC URL. */
  remount?: boolean
}

export type PersistentScPlayerApi = {
  widgetRef: MutableRefObject<SoundCloudWidget | null>
  /** Load a track via widget.load() (desktop persistent player). */
  loadTrack: (scUrl: string, opts?: PersistentScLoadOptions) => void
  /** Safari: widget.play() inside the user-gesture call stack. */
  syncPlayInGesture: () => void
  /** Bind FINISH / near-end fallback to queue advance. */
  setOnFinish: (handler: (() => void) | null) => void
  setOnPlayingChange: (handler: ((playing: boolean) => void) | null) => void
  /** Fired during playback with widget position (ms) — used for loading UI. */
  setOnPlayProgress: (handler: ((positionMs: number) => void) | null) => void
  /** Fired when SC widget READY fires after a load (autoplay-blocked vs playing). */
  setOnWidgetReady: (handler: (() => void) | null) => void
  /** Tear down iframe and hide host (Stop / reset). */
  dismiss: () => void
}

export const PersistentScPlayerContext = createContext<PersistentScPlayerApi | null>(null)

export function usePersistentScPlayer(): PersistentScPlayerApi {
  const ctx = useContext(PersistentScPlayerContext)
  if (!ctx) {
    throw new Error('usePersistentScPlayer must be used within PlayerQueueRoot')
  }
  return ctx
}

/** Returns null when persistent player is not mounted (e.g. mobile). */
export function usePersistentScPlayerOptional(): PersistentScPlayerApi | null {
  return useContext(PersistentScPlayerContext)
}
