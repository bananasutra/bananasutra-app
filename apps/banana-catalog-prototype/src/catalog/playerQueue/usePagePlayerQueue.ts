import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PlaybackIntent } from '../catalogAnalytics'
import { PLAY_ALL_DESKTOP_MEDIA_QUERY } from '../playAllPlatform'
import { bindSoundCloudWidgetPlayback } from '../soundCloudWidgetPlayback'
import type { SoundCloudWidget } from '../soundcloudWidgetApi'
import type { PagePlayerQueueAnalytics } from './pagePlayerQueueAnalytics'
import { playableTrackKey, type PlayableTrackSelectionMode } from './playableTrackAdapters'
import type {
  PickTrackOptions,
  PlayableTrack,
  PlayerQueueActions,
  PlayerQueueContextValue,
  PlayerQueueSource,
  PlayerQueueState,
} from './types'

export type PagePlayerQueueConfig = {
  selectionMode: PlayableTrackSelectionMode
  /** Live queue list (filtered tracks or in-app song variants). */
  getQueue: () => readonly PlayableTrack[]
  getCurrentKey: () => string | null
  widgetRef: React.MutableRefObject<SoundCloudWidget | null>
  analytics: PagePlayerQueueAnalytics
  buildPlayAllSource: () => Exclude<PlayerQueueSource, { type: 'single' }>
  /** Embed remount / selection side effects owned by the page. */
  onPlayTrack: (track: PlayableTrack, opts: { intent: PlaybackIntent; keepPlayAll: boolean }) => void
  /** TracksPage: expand infinite scroll + scroll active row into view. */
  onAdvanceToIndex?: (index: number) => void
  /** TracksPage: reset visible slice when starting play all. */
  onStartPlayAll?: () => void
  /** TracksPage: keep scAutoplay true when resuming from pause. */
  onResume?: () => void
}

function findTrackIndex(queue: readonly PlayableTrack[], key: string | null, mode: PlayableTrackSelectionMode): number {
  if (!key) return -1
  return queue.findIndex((t) => playableTrackKey(t, mode) === key)
}

export type UsePagePlayerQueueResult = PlayerQueueContextValue & {
  bindWidgetOnLoad: (wrap: HTMLElement | null) => void
  /** Clear play-all session without stop analytics (e.g. list became empty). */
  resetSession: () => void
}

export function usePagePlayerQueue(config: PagePlayerQueueConfig): UsePagePlayerQueueResult {
  const {
    selectionMode,
    getQueue,
    getCurrentKey,
    widgetRef,
    analytics,
    onPlayTrack,
    onAdvanceToIndex,
    onStartPlayAll,
    onResume,
  } = config

  const configRef = useRef(config)
  useEffect(() => {
    configRef.current = config
  }, [config])

  const [source, setSource] = useState<PlayerQueueSource | null>(null)
  const [playAllActive, setPlayAllActive] = useState(false)
  const [playing, setPlaying] = useState(false)
  const playAllActiveRef = useRef(false)
  const playingRef = useRef(false)
  const playbackIntentRef = useRef<PlaybackIntent>('user_pick')
  const advanceRef = useRef<() => void>(() => {})

  useEffect(() => {
    playAllActiveRef.current = playAllActive
  }, [playAllActive])
  useEffect(() => {
    playingRef.current = playing
  }, [playing])

  const pause = useCallback(() => {
    try {
      widgetRef.current?.pause()
    } catch {
      // Ignore widget pause failures and keep UI state responsive.
    }
    setPlaying(false)
  }, [widgetRef])

  const resume = useCallback(() => {
    try {
      widgetRef.current?.play()
      onResume?.()
    } catch {
      // Ignore widget play failures.
    }
  }, [widgetRef, onResume])

  const pickTrack = useCallback(
    (track: PlayableTrack, options: PickTrackOptions = {}) => {
      const { keepPlayAll = false } = options
      const key = playableTrackKey(track, selectionMode)
      const currentKey = getCurrentKey()

      if (key && key === currentKey && widgetRef.current) {
        if (playingRef.current) {
          pause()
          return
        }
        resume()
        return
      }

      if (!keepPlayAll && playAllActiveRef.current) {
        const queue = getQueue()
        const idx = findTrackIndex(queue, currentKey, selectionMode)
        analytics.onPlayAllStopped(idx >= 0 ? idx + 1 : 0, queue.length, 'replaced_by_new_queue')
        setPlayAllActive(false)
        playAllActiveRef.current = false
      }

      analytics.onPlayStarted(track, playbackIntentRef.current, playAllActiveRef.current)
      playbackIntentRef.current = 'user_pick'
      onPlayTrack(track, { intent: playbackIntentRef.current, keepPlayAll })
    },
    [analytics, getCurrentKey, getQueue, onPlayTrack, pause, resume, selectionMode, widgetRef],
  )

  const stop = useCallback(() => {
    const queue = getQueue()
    const idx = findTrackIndex(queue, getCurrentKey(), selectionMode)
    analytics.onPlayAllStopped(idx >= 0 ? idx + 1 : 0, queue.length, 'user_stop')
    setPlayAllActive(false)
    playAllActiveRef.current = false
    setSource(null)
    pause()
  }, [analytics, getCurrentKey, getQueue, pause, selectionMode])

  const advance = useCallback(() => {
    const queue = getQueue()
    const currentKey = getCurrentKey()
    if (!queue.length || !currentKey) {
      setPlayAllActive(false)
      playAllActiveRef.current = false
      return
    }
    const idx = findTrackIndex(queue, currentKey, selectionMode)
    if (idx < 0) {
      setPlayAllActive(false)
      playAllActiveRef.current = false
      return
    }
    const next = queue[idx + 1]
    if (!next) {
      analytics.onPlayAllStopped(queue.length, queue.length, 'queue_exhausted')
      setPlayAllActive(false)
      playAllActiveRef.current = false
      return
    }
    const current = queue[idx]
    if (current) {
      analytics.onQueueAdvanced(current, next, idx + 2, queue.length)
    }
    playbackIntentRef.current = 'queue_advance'
    onAdvanceToIndex?.(idx + 1)
    pickTrack(next, { keepPlayAll: true })
  }, [analytics, getCurrentKey, getQueue, onAdvanceToIndex, pickTrack, selectionMode])

  useEffect(() => {
    advanceRef.current = advance
  }, [advance])

  const jump = useCallback(
    (delta: -1 | 1) => {
      const queue = getQueue()
      const currentKey = getCurrentKey()
      if (!queue.length || !currentKey) return
      const idx = findTrackIndex(queue, currentKey, selectionMode)
      if (idx < 0) return
      const nextIdx = idx + delta
      if (nextIdx < 0 || nextIdx >= queue.length) return
      const next = queue[nextIdx]
      const current = queue[idx]
      if (current && next) {
        analytics.onQueueSkipped(current, next, delta === 1 ? 'next' : 'previous', playAllActiveRef.current)
      }
      playbackIntentRef.current = 'queue_skip'
      onAdvanceToIndex?.(nextIdx)
      pickTrack(next, { keepPlayAll: playAllActiveRef.current })
    },
    [analytics, getCurrentKey, getQueue, onAdvanceToIndex, pickTrack, selectionMode],
  )

  const startPlayAll = useCallback(
    (playAllSource: Exclude<PlayerQueueSource, { type: 'single' }>, tracks: readonly PlayableTrack[]) => {
      if (!window.matchMedia(PLAY_ALL_DESKTOP_MEDIA_QUERY).matches) return
      if (!tracks.length) return
      setSource(playAllSource)
      analytics.onPlayAllStarted(tracks.length)
      playbackIntentRef.current = 'play_all_start'
      setPlayAllActive(true)
      playAllActiveRef.current = true
      onStartPlayAll?.()
      const first = tracks[0]
      if (first) pickTrack(first, { keepPlayAll: true })
    },
    [analytics, onStartPlayAll, pickTrack],
  )

  const actions: PlayerQueueActions = useMemo(
    () => ({
      startPlayAll: (playAllSource, tracks) => startPlayAll(playAllSource, tracks),
      pickTrack,
      advance,
      jump,
      jumpTo: (position) => {
        const queue = getQueue()
        const track = queue[position]
        if (!track) return
        playbackIntentRef.current = 'queue_skip'
        onAdvanceToIndex?.(position)
        pickTrack(track, { keepPlayAll: playAllActiveRef.current })
      },
      pause,
      resume,
      stop,
      handoffFromSongbookEmbed: () => {
        if (import.meta.env.DEV) {
          console.warn('[PlayerQueue] handoffFromSongbookEmbed not wired until W-029c')
        }
      },
    }),
    [advance, getQueue, jump, onAdvanceToIndex, pause, pickTrack, resume, startPlayAll, stop],
  )

  const state: PlayerQueueState = useMemo(() => {
    const tracks = getQueue()
    const position = findTrackIndex(tracks, getCurrentKey(), selectionMode)
    return {
      source,
      tracks,
      position: position >= 0 ? position : 0,
      playing,
      currentPositionMs: 0,
      playAllActive,
    }
  }, [getCurrentKey, getQueue, playAllActive, playing, selectionMode, source])

  const bindWidgetOnLoad = useCallback(
    (wrap: HTMLElement | null) => {
      if (!wrap) return
      setPlaying(false)
      const iframe = wrap.querySelector<HTMLIFrameElement>('iframe.sc-embed-frame')
      if (!iframe) return
      void import('../soundcloudWidgetApi')
        .then(({ loadSoundCloudWidgetApi }) => loadSoundCloudWidgetApi())
        .then((SC) => {
          if (!document.body.contains(iframe)) return
          const widget = SC.Widget(iframe)
          widgetRef.current = widget
          bindSoundCloudWidgetPlayback(widget, SC, {
            onPlayingChange: setPlaying,
            onFinish: () => {
              if (!playAllActiveRef.current) return
              advanceRef.current()
            },
          })
        })
        .catch(() => {
          // Widget API failed to load; Play All becomes effectively manual.
        })
    },
    [widgetRef],
  )

  const resetSession = useCallback(() => {
    setPlayAllActive(false)
    playAllActiveRef.current = false
    setSource(null)
    setPlaying(false)
  }, [])

  return useMemo(
    () => ({
      state,
      actions,
      bindWidgetOnLoad,
      resetSession,
    }),
    [actions, bindWidgetOnLoad, resetSession, state],
  )
}
