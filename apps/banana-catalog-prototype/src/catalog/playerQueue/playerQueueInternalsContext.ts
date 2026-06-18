import { createContext, useContext } from 'react'

export type PlayerQueueInternals = {
  bindWidgetOnLoad: (wrap: HTMLElement | null) => void
  resetSession: () => void
}

export const PlayerQueueInternalsContext = createContext<PlayerQueueInternals | null>(null)

export function usePlayerQueueInternals(): PlayerQueueInternals {
  const ctx = useContext(PlayerQueueInternalsContext)
  if (!ctx) {
    throw new Error('usePlayerQueueInternals must be used within PlayerQueueProvider')
  }
  return ctx
}
