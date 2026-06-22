import { useEffect } from 'react'

type WakeLockNavigator = Navigator & {
  wakeLock?: {
    request: (type: 'screen') => Promise<WakeLockSentinel>
  }
}

/**
 * Keep the screen awake while audio plays in the active tab (R56 #118).
 * Browsers may still sleep on low battery or when wake lock is denied.
 */
export function usePlaybackWakeLock(playing: boolean, enabled: boolean): void {
  useEffect(() => {
    if (!enabled || !playing) return
    if (typeof document === 'undefined') return

    const nav = navigator as WakeLockNavigator
    if (!nav.wakeLock?.request) return

    let lock: WakeLockSentinel | null = null
    let cancelled = false

    const acquire = async () => {
      if (cancelled || document.visibilityState !== 'visible') return
      try {
        if (lock && !lock.released) return
        lock = await nav.wakeLock!.request('screen')
        lock.addEventListener('release', () => {
          lock = null
        })
      } catch {
        // Permission denied, unsupported, or low power — playback continues without wake lock.
      }
    }

    void acquire()

    const onVisibilityChange = () => {
      if (cancelled || document.visibilityState !== 'visible' || !playing) return
      void acquire()
    }

    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisibilityChange)
      void lock?.release().catch(() => {
        // Ignore release failures during teardown.
      })
      lock = null
    }
  }, [enabled, playing])
}
