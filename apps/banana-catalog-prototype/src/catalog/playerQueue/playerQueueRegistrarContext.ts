import { createContext, useContext, type MutableRefObject } from 'react'
import type { PersistentScPlayerApi } from '../persistentPlayer/persistentScPlayerContext'
import type { SoundCloudWidget } from '../soundcloudWidgetApi'
import type { PagePlayerQueueConfig } from './usePagePlayerQueue'

export type PagePlayerQueueRegistration = Omit<PagePlayerQueueConfig, 'widgetRef'>

export type PlayerQueueRegistrarValue = {
  /** Ref-only registration — never triggers parent re-renders (fixes nav lock). */
  setPageRegistration: (config: PagePlayerQueueRegistration) => void
  clearPageRegistration: () => void
  widgetRef: MutableRefObject<SoundCloudWidget | null>
  persistentApiRef: MutableRefObject<PersistentScPlayerApi | null>
  usePersistentPlayback: boolean
}

export const PlayerQueueRegistrarContext = createContext<PlayerQueueRegistrarValue | null>(null)

export function usePlayerQueueRegistrar(): PlayerQueueRegistrarValue {
  const ctx = useContext(PlayerQueueRegistrarContext)
  if (!ctx) {
    throw new Error('usePlayerQueueRegistrar must be used within PlayerQueueRoot')
  }
  return ctx
}
