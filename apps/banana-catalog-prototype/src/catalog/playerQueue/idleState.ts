import type { PlayerQueueActions, PlayerQueueState } from './types'

export const IDLE_PLAYER_QUEUE_STATE: PlayerQueueState = {
  source: null,
  tracks: [],
  position: 0,
  playing: false,
  currentPositionMs: 0,
  playAllActive: false,
}

function warnUnwired(action: string): void {
  if (import.meta.env.DEV) {
    console.warn(`[PlayerQueue] ${action} called before W-024/W-025 wiring`)
  }
}

/** No-op actions until W-024 implements usePlayerQueue or W-025 mounts the provider. */
export const noopPlayerQueueActions: PlayerQueueActions = {
  startPlayAll: () => warnUnwired('startPlayAll'),
  pickTrack: () => warnUnwired('pickTrack'),
  advance: () => warnUnwired('advance'),
  jump: () => warnUnwired('jump'),
  jumpTo: () => warnUnwired('jumpTo'),
  pause: () => warnUnwired('pause'),
  resume: () => warnUnwired('resume'),
  stop: () => warnUnwired('stop'),
  handoffFromSongbookEmbed: () => warnUnwired('handoffFromSongbookEmbed'),
}
