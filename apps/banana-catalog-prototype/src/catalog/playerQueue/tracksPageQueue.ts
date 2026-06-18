import { useCallback, useMemo, type MutableRefObject } from 'react'
import type { TrackSortMode, TrackCatalogItem, TracksFilterState } from '../types'
import {
  trackCatalogPlayAllStarted,
  trackCatalogPlayAllStopped,
  trackCatalogPlayStarted,
  trackCatalogQueueAdvanced,
  trackCatalogQueueSkipped,
  tracksFilterContext,
} from '../catalogAnalytics'
import type { SoundCloudWidget } from '../soundcloudWidgetApi'
import type { PagePlayerQueueAnalytics } from './pagePlayerQueueAnalytics'
import { trackCatalogItemToPlayable } from './playableTrackAdapters'
import type { PlayableTrack, PlayerQueueSource } from './types'
import { usePagePlayerQueue, type UsePagePlayerQueueResult } from './usePagePlayerQueue'

export type UseTracksPagePlayerQueueArgs = {
  filteredRef: MutableRefObject<TrackCatalogItem[]>
  selectedIdRef: MutableRefObject<string | null>
  filtersRef: MutableRefObject<TracksFilterState>
  urlFindRef: MutableRefObject<string>
  urlSortRef: MutableRefObject<TrackSortMode>
  scWidgetRef: MutableRefObject<SoundCloudWidget | null>
  onBeforePlayTrack: () => void
  ensureVisibleThroughIndex: (index: number) => void
  resetVisible: () => void
  scrollActiveRowOnNextPaintRef: MutableRefObject<boolean>
  setScAutoplay: (value: boolean) => void
  setSelectedId: (id: string) => void
  setEmbedReloadKey: React.Dispatch<React.SetStateAction<number>>
}

export function useTracksPagePlayerQueue(
  args: UseTracksPagePlayerQueueArgs,
): UsePagePlayerQueueResult & { startPlayAllFromPage: () => void } {
  const {
    filteredRef,
    selectedIdRef,
    filtersRef,
    urlFindRef,
    urlSortRef,
    scWidgetRef,
    onBeforePlayTrack,
    ensureVisibleThroughIndex,
    resetVisible,
    scrollActiveRowOnNextPaintRef,
    setScAutoplay,
    setSelectedId,
    setEmbedReloadKey,
  } = args

  const findCatalogTrack = useCallback(
    (trackId: string): TrackCatalogItem | undefined => filteredRef.current.find((t) => t.track_id === trackId),
    [filteredRef],
  )

  const analytics: PagePlayerQueueAnalytics = useMemo(
    () => ({
      onPlayStarted: (track, intent, playAllActive) => {
        const row = findCatalogTrack(track.track_id)
        if (!row) return
        const source = playAllActive ? 'tracks_filter' : 'single'
        trackCatalogPlayStarted(row, source, intent)
      },
      onPlayAllStarted: (total) => {
        trackCatalogPlayAllStarted('tracks_filter', total, tracksFilterContext(filtersRef.current))
      },
      onPlayAllStopped: (tracksPlayed, total, reason) => {
        trackCatalogPlayAllStopped('tracks_filter', tracksPlayed, total, reason)
      },
      onQueueAdvanced: (from, to, position, total) => {
        const fromRow = findCatalogTrack(from.track_id)
        const toRow = findCatalogTrack(to.track_id)
        if (!fromRow || !toRow) return
        trackCatalogQueueAdvanced({
          from: fromRow,
          to: toRow,
          position,
          total,
          source: 'tracks_filter',
        })
      },
      onQueueSkipped: (from, to, direction, playAllActive) => {
        const fromRow = findCatalogTrack(from.track_id)
        const toRow = findCatalogTrack(to.track_id)
        if (!fromRow || !toRow) return
        trackCatalogQueueSkipped({
          from: fromRow,
          to: toRow,
          direction,
          source: playAllActive ? 'tracks_filter' : 'single',
        })
      },
    }),
    [findCatalogTrack, filtersRef],
  )

  const onPlayTrack = useCallback(
    (track: PlayableTrack, opts: { fromPlayAllStart?: boolean }) => {
      const sameRow = track.track_id === selectedIdRef.current
      if (opts.fromPlayAllStart && sameRow) {
        // Safari: scAutoplay=true changes iframe key and remounts outside the gesture chain.
        onBeforePlayTrack()
        return
      }
      onBeforePlayTrack()
      setScAutoplay(true)
      if (sameRow) {
        setEmbedReloadKey((k) => k + 1)
        return
      }
      setSelectedId(track.track_id)
      setEmbedReloadKey((k) => k + 1)
    },
    [onBeforePlayTrack, selectedIdRef, setEmbedReloadKey, setScAutoplay, setSelectedId],
  )

  const buildPlayAllSource = useCallback((): Extract<PlayerQueueSource, { type: 'tracks_filter' }> => {
    return {
      type: 'tracks_filter',
      filters: filtersRef.current,
      find: urlFindRef.current,
      sort: urlSortRef.current,
    }
  }, [filtersRef, urlFindRef, urlSortRef])

  const getQueue = useCallback(() => filteredRef.current.map(trackCatalogItemToPlayable), [filteredRef])

  const queue = usePagePlayerQueue({
    selectionMode: 'track_id',
    getQueue,
    getCurrentKey: () => selectedIdRef.current,
    widgetRef: scWidgetRef,
    analytics,
    buildPlayAllSource,
    onPlayTrack,
    onAdvanceToIndex: (index) => {
      ensureVisibleThroughIndex(index)
      scrollActiveRowOnNextPaintRef.current = true
    },
    onStartPlayAll: () => resetVisible(),
    onResume: () => setScAutoplay(true),
  })

  const startPlayAllFromPage = useCallback(() => {
    queue.actions.startPlayAll(buildPlayAllSource(), getQueue())
  }, [buildPlayAllSource, getQueue, queue.actions])

  return useMemo(
    () => ({
      ...queue,
      startPlayAllFromPage,
    }),
    [queue, startPlayAllFromPage],
  )
}
