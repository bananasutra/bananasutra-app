import { useContext } from 'react'
import { PlayerQueueContext } from './playerQueueContext'
import type { PlayerQueueContextValue } from './types'

/** Requires PlayerQueueProvider (throws when missing). */
export function usePlayerQueue(): PlayerQueueContextValue {
  const ctx = useContext(PlayerQueueContext)
  if (!ctx) {
    throw new Error('usePlayerQueue must be used within PlayerQueueProvider')
  }
  return ctx
}

/** Optional access for surfaces that work with or without persistent player (W-024 migration). */
export function usePlayerQueueOptional(): PlayerQueueContextValue | null {
  return useContext(PlayerQueueContext)
}
