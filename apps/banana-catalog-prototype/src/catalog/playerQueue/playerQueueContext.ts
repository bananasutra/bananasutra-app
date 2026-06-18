import { createContext } from 'react'
import type { PlayerQueueContextValue } from './types'

export const PlayerQueueContext = createContext<PlayerQueueContextValue | null>(null)
