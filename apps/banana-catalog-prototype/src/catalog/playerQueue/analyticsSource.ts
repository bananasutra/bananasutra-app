/**
 * Bridge PlayerQueueSource → GA4 QueueSource (W-004 / catalogAnalytics parity).
 */

import type { QueueSource as AnalyticsQueueSource } from '../../lib/analytics'
import type { TracksFilterState } from '../types'
import type { PlayerQueueSource } from './types'

export function analyticsQueueSource(source: PlayerQueueSource | null): AnalyticsQueueSource {
  if (!source) return 'single'
  return source.type
}

export function tracksFilterAnalyticsContext(filters: TracksFilterState): {
  filter_sutra?: string
  filter_genre?: string
} {
  const [sutra] = filters.sutra ?? []
  const [genre] = filters.primary_genre ?? []
  return {
    filter_sutra: sutra,
    filter_genre: genre,
  }
}
