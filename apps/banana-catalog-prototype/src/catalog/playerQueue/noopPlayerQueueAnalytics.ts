import type { PagePlayerQueueAnalytics } from './pagePlayerQueueAnalytics'

export const noopPlayerQueueAnalytics: PagePlayerQueueAnalytics = {
  onPlayStarted: () => {},
  onPlayAllStarted: () => {},
  onPlayAllStopped: () => {},
  onQueueAdvanced: () => {},
  onQueueSkipped: () => {},
}
