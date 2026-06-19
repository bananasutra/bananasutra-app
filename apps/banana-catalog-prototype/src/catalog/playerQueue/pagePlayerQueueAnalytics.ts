import type { PlayAllStopReason } from '../../lib/analytics'
import type { PlaybackIntent } from '../catalogAnalytics'
import type { PlayableTrack } from './types'

/** Page-specific GA4 bridges injected into usePagePlayerQueue (W-024). */
export type PagePlayerQueueAnalytics = {
  onPlayStarted: (track: PlayableTrack, intent: PlaybackIntent, playAllActive: boolean) => void
  onPlayAllStarted: (total: number) => void
  onPlayAllStopped: (tracksPlayed: number, total: number, reason: PlayAllStopReason) => void
  onQueueAdvanced: (from: PlayableTrack, to: PlayableTrack, position: number, total: number) => void
  onQueueSkipped: (
    from: PlayableTrack,
    to: PlayableTrack,
    direction: 'next' | 'previous',
    playAllActive: boolean,
  ) => void
}
