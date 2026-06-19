import { useCallback, useMemo, useRef, type ReactNode } from 'react'
import { usePlayAllDesktopAvailable } from '../playAllPlatform'
import {
  PersistentScPlayerContext,
  type PersistentScPlayerApi,
} from '../persistentPlayer/persistentScPlayerContext'
import { requestPersistentScLoad, resetAndPrimePersistentSc } from '../persistentPlayer/persistentScBootstrap'
import type { SoundCloudWidget } from '../soundcloudWidgetApi'
import { noopPlayerQueueAnalytics } from './noopPlayerQueueAnalytics'
import { PlayerQueueProvider } from './PlayerQueueProvider'
import {
  PlayerQueueRegistrarContext,
  type PagePlayerQueueRegistration,
} from './playerQueueRegistrarContext'

const IDLE_PAGE_REGISTRATION: PagePlayerQueueRegistration = {
  selectionMode: 'track_id',
  getQueue: () => [],
  getCurrentKey: () => null,
  analytics: noopPlayerQueueAnalytics,
  buildPlayAllSource: () => ({
    type: 'tracks_filter',
    filters: {
      sutra: new Set(),
      light_shadow: new Set(),
      primary_genre: new Set(),
      secondary_genre: new Set(),
      mood: new Set(),
      instrument: new Set(),
      tempo_feel: new Set(),
    },
    find: '',
    sort: 'likes',
  }),
  onPlayTrack: () => {},
}

/**
 * W-025 — app-root player queue + desktop persistent SoundCloud iframe.
 */
export function PlayerQueueRoot({ children }: { children: ReactNode }) {
  const playAllDesktop = usePlayAllDesktopAvailable()
  const mobileWidgetRef = useRef<SoundCloudWidget | null>(null)
  const persistentWidgetRef = useRef<SoundCloudWidget | null>(null)
  const persistentApiRef = useRef<PersistentScPlayerApi | null>(null)
  const persistentScEmbedWrapRef = useRef<HTMLDivElement | null>(null)

  const liveRegistrationRef = useRef<PagePlayerQueueRegistration>(IDLE_PAGE_REGISTRATION)
  const frozenRegistrationRef = useRef<PagePlayerQueueRegistration | null>(null)
  const registrationRef = useRef<PagePlayerQueueRegistration>(IDLE_PAGE_REGISTRATION)

  const widgetRef = playAllDesktop ? persistentWidgetRef : mobileWidgetRef

  if (playAllDesktop && !persistentApiRef.current) {
    persistentApiRef.current = {
      widgetRef: persistentWidgetRef,
      loadTrack: requestPersistentScLoad,
      syncPlayInGesture: () => {},
      setOnFinish: () => {},
      setOnPlayingChange: () => {},
      dismiss: () => resetAndPrimePersistentSc(),
    }
  } else if (!playAllDesktop) {
    persistentApiRef.current = null
  }

  const setPageRegistration = useCallback((config: PagePlayerQueueRegistration) => {
    liveRegistrationRef.current = config
    frozenRegistrationRef.current = null
    registrationRef.current = config
  }, [])

  const clearPageRegistration = useCallback(() => {
    if (liveRegistrationRef.current) {
      frozenRegistrationRef.current = liveRegistrationRef.current
    }
    liveRegistrationRef.current = IDLE_PAGE_REGISTRATION
    registrationRef.current =
      frozenRegistrationRef.current ?? IDLE_PAGE_REGISTRATION
  }, [])

  const registrarValue = useMemo(
    () => ({
      setPageRegistration,
      clearPageRegistration,
      widgetRef,
      persistentApiRef,
      persistentScEmbedWrapRef,
      usePersistentPlayback: playAllDesktop,
    }),
    [clearPageRegistration, playAllDesktop, setPageRegistration, widgetRef],
  )

  return (
    <PlayerQueueRegistrarContext.Provider value={registrarValue}>
      <PlayerQueueProvider
        registrationRef={registrationRef}
        widgetRef={widgetRef}
        persistentApiRef={persistentApiRef}
        persistentScEmbedWrapRef={persistentScEmbedWrapRef}
        usePersistentPlayback={playAllDesktop}
      >
        <PersistentScPlayerContext.Provider value={persistentApiRef.current}>
          {children}
        </PersistentScPlayerContext.Provider>
      </PlayerQueueProvider>
    </PlayerQueueRegistrarContext.Provider>
  )
}
