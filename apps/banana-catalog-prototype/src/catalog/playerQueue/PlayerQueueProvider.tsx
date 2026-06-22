import { useEffect, useMemo, type MutableRefObject, type ReactNode, type RefObject } from 'react'
import type { PersistentScPlayerApi } from '../persistentPlayer/persistentScPlayerContext'
import { primePersistentScIframe } from '../persistentPlayer/persistentScBootstrap'
import { usePlaybackWakeLock } from '../persistentPlayer/usePlaybackWakeLock'
import { loadSoundCloudWidgetApi } from '../soundcloudWidgetApi'
import { PersistentPlayerShell } from '../persistentPlayer/PersistentPlayerShell'
import type { SoundCloudWidget } from '../soundcloudWidgetApi'
import { IDLE_PLAYER_QUEUE_STATE, noopPlayerQueueActions } from './idleState'
import { PlayerQueueContext } from './playerQueueContext'
import { PlayerQueueInternalsContext } from './playerQueueInternalsContext'
import type { PagePlayerQueueRegistration } from './playerQueueRegistrarContext'
import type { PlayerQueueContextValue } from './types'
import { usePagePlayerQueue } from './usePagePlayerQueue'
import { useWirePersistentPlayer } from './usePlayerQueuePageBridge'

export type PlayerQueueProviderProps = {
  children: ReactNode
  registrationRef: MutableRefObject<PagePlayerQueueRegistration>
  widgetRef: MutableRefObject<SoundCloudWidget | null>
  persistentApiRef: MutableRefObject<PersistentScPlayerApi | null>
  persistentScEmbedWrapRef: RefObject<HTMLDivElement | null>
  usePersistentPlayback: boolean
  /** Override for tests. */
  value?: PlayerQueueContextValue
}

/**
 * App-root provider (W-025). Runs the shared queue engine; pages register via `usePlayerQueuePageBridge`.
 */
export function PlayerQueueProvider({
  children,
  registrationRef,
  widgetRef,
  persistentApiRef,
  persistentScEmbedWrapRef,
  usePersistentPlayback,
  value,
}: PlayerQueueProviderProps) {
  const engine = usePagePlayerQueue(registrationRef, widgetRef, persistentApiRef, usePersistentPlayback)

  useEffect(() => {
    if (!usePersistentPlayback) return
    primePersistentScIframe()
    void loadSoundCloudWidgetApi()
  }, [usePersistentPlayback])

  usePlaybackWakeLock(engine.state.playing, usePersistentPlayback)

  useWirePersistentPlayer(persistentApiRef, engine.wirePersistentPlayer, usePersistentPlayback)

  const resolved: PlayerQueueContextValue =
    value ??
    ({
      state: engine.state,
      actions: engine.actions,
    } satisfies PlayerQueueContextValue)

  const internals = useMemo(
    () => ({
      bindWidgetOnLoad: engine.bindWidgetOnLoad,
      resetSession: engine.resetSession,
    }),
    [engine.bindWidgetOnLoad, engine.resetSession],
  )

  return (
    <PlayerQueueContext.Provider value={resolved}>
      <PlayerQueueInternalsContext.Provider value={internals}>
        {children}
        {usePersistentPlayback ? (
          <PersistentPlayerShell
            apiRef={persistentApiRef}
            widgetRef={widgetRef}
            embedWrapRef={persistentScEmbedWrapRef}
          />
        ) : null}
      </PlayerQueueInternalsContext.Provider>
    </PlayerQueueContext.Provider>
  )
}

/** Idle provider for tests / storybook. */
export function IdlePlayerQueueProvider({ children }: { children: ReactNode }) {
  return (
    <PlayerQueueContext.Provider
      value={{
        state: IDLE_PLAYER_QUEUE_STATE,
        actions: noopPlayerQueueActions,
      }}
    >
      <PlayerQueueInternalsContext.Provider
        value={{
          bindWidgetOnLoad: () => {},
          resetSession: () => {},
        }}
      >
        {children}
      </PlayerQueueInternalsContext.Provider>
    </PlayerQueueContext.Provider>
  )
}
