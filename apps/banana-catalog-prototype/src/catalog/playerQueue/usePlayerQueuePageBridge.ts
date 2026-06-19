import { useLayoutEffect, type MutableRefObject } from 'react'
import type { PersistentScPlayerApi } from '../persistentPlayer/persistentScPlayerContext'
import { usePlayerQueueRegistrar, type PagePlayerQueueRegistration } from './playerQueueRegistrarContext'

/**
 * Registers a page as the active queue consumer (TracksPage, SongDetail, …).
 * Updates a ref only — no provider re-render (navigation must stay responsive).
 */
export function usePlayerQueuePageBridge(
  id: string,
  registration: PagePlayerQueueRegistration,
  extras: {
    startPlayAllFromPage: () => void
    resetSession?: () => void
    bindWidgetOnLoad?: (wrap: HTMLElement | null) => void
  },
): {
  startPlayAllFromPage: () => void
  resetSession: () => void
  bindWidgetOnLoad: (wrap: HTMLElement | null) => void
} {
  const { setPageRegistration, clearPageRegistration } = usePlayerQueueRegistrar()

  useLayoutEffect(() => {
    void id
    setPageRegistration(registration)
    return () => clearPageRegistration()
  }, [clearPageRegistration, id, registration, setPageRegistration])

  return {
    startPlayAllFromPage: extras.startPlayAllFromPage,
    resetSession: extras.resetSession ?? (() => {}),
    bindWidgetOnLoad: extras.bindWidgetOnLoad ?? (() => {}),
  }
}

/** Internal — wires persistent iframe FINISH to queue advance. */
export function useWirePersistentPlayer(
  persistentApiRef: MutableRefObject<PersistentScPlayerApi | null>,
  wirePersistentPlayer: (handlers: {
    setOnFinish: PersistentScPlayerApi['setOnFinish']
    setOnPlayingChange: PersistentScPlayerApi['setOnPlayingChange']
  }) => void,
  enabled: boolean,
): void {
  useLayoutEffect(() => {
    if (!enabled) return
    let cancelled = false
    let raf = 0

    const tryWire = () => {
      if (cancelled) return
      const api = persistentApiRef.current
      if (!api) {
        raf = requestAnimationFrame(tryWire)
        return
      }
      wirePersistentPlayer({
        setOnFinish: api.setOnFinish,
        setOnPlayingChange: api.setOnPlayingChange,
      })
    }

    tryWire()
    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
      persistentApiRef.current?.setOnFinish(null)
      persistentApiRef.current?.setOnPlayingChange(null)
    }
  }, [enabled, persistentApiRef, wirePersistentPlayer])
}
