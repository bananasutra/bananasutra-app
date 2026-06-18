import { type ReactNode } from 'react'
import { IDLE_PLAYER_QUEUE_STATE, noopPlayerQueueActions } from './idleState'
import { PlayerQueueContext } from './playerQueueContext'
import type { PlayerQueueContextValue } from './types'

export type PlayerQueueProviderProps = {
  children: ReactNode
  /** Override for tests or W-024/W-025 implementation wiring. Defaults to idle no-ops. */
  value?: PlayerQueueContextValue
}

/**
 * App-root provider (W-025). W-023 ships the contract only; default value is idle until wired.
 */
export function PlayerQueueProvider({ children, value }: PlayerQueueProviderProps) {
  const resolved: PlayerQueueContextValue =
    value ??
    ({
      state: IDLE_PLAYER_QUEUE_STATE,
      actions: noopPlayerQueueActions,
    } satisfies PlayerQueueContextValue)

  return <PlayerQueueContext.Provider value={resolved}>{children}</PlayerQueueContext.Provider>
}
