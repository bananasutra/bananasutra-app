import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type MutableRefObject } from 'react'
import type { PersistentScPlayerApi } from '../persistentPlayer/persistentScPlayerContext'
import {
  persistentScIframeIsWarm,
  persistentScNeedsExplicitLoad,
  requestPersistentScLoadSync,
} from '../persistentPlayer/persistentScBootstrap'
import { markPersistentGesturePlayWindow } from '../persistentPlayer/persistentGesturePlay'
import type { PlaybackIntent } from '../catalogAnalytics'
import { isPlayAllDesktopDevice } from '../playAllPlatform'
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
  getQueue: () => readonly PlayableTrack[]
  getCurrentKey: () => string | null
  widgetRef: MutableRefObject<SoundCloudWidget | null>
  analytics: PagePlayerQueueAnalytics
  buildPlayAllSource: () => Exclude<PlayerQueueSource, { type: 'single' }>
  onPlayTrack: (
    track: PlayableTrack,
    opts: { intent: PlaybackIntent; keepPlayAll: boolean; fromPlayAllStart?: boolean },
  ) => void
  onAdvanceToIndex?: (index: number) => void
  onStartPlayAll?: () => void
  onResume?: () => void
}

export type PagePlayerQueueRegistration = Omit<PagePlayerQueueConfig, 'widgetRef'>

function findTrackIndex(queue: readonly PlayableTrack[], key: string | null, mode: PlayableTrackSelectionMode): number {
  if (!key) return -1
  return queue.findIndex((t) => playableTrackKey(t, mode) === key)
}

/** Session list for a user pick: prefer live getQueue, always include click-time track metadata. */
function sessionQueueForPick(
  track: PlayableTrack,
  mode: PlayableTrackSelectionMode,
  getQueue: () => readonly PlayableTrack[],
): PlayableTrack[] {
  const key = playableTrackKey(track, mode)
  const queue = [...getQueue()]
  const idx = findTrackIndex(queue, key, mode)
  if (idx >= 0) {
    queue[idx] = track
    return queue
  }
  // Cross-page / empty / stale registration: chrome must still match the track we load.
  return [track]
}

export type UsePagePlayerQueueResult = PlayerQueueContextValue & {
  bindWidgetOnLoad: (wrap: HTMLElement | null) => void
  /** Clear play-all session without stop analytics (e.g. list became empty). */
  resetSession: () => void
  /** Wire FINISH / playing sync on the app-root persistent iframe (desktop W-025). */
  wirePersistentPlayer: (handlers: {
    setOnFinish: (handler: (() => void) | null) => void
    setOnPlayingChange: (handler: ((playing: boolean) => void) | null) => void
  }) => void
}

export function usePagePlayerQueue(
  registrationRef: MutableRefObject<PagePlayerQueueRegistration>,
  widgetRef: MutableRefObject<SoundCloudWidget | null>,
  persistentApiRef: MutableRefObject<PersistentScPlayerApi | null>,
  usePersistentPlayback: boolean,
): UsePagePlayerQueueResult {
  const configRef = useRef<PagePlayerQueueConfig>({ ...registrationRef.current, widgetRef })

  useLayoutEffect(() => {
    configRef.current = { ...registrationRef.current, widgetRef }
  })

  const [source, setSource] = useState<PlayerQueueSource | null>(null)
  const [playAllActive, setPlayAllActive] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [sessionTracks, setSessionTracks] = useState<readonly PlayableTrack[]>([])
  const [activeTrackKey, setActiveTrackKey] = useState<string | null>(null)
  const playAllActiveRef = useRef(false)
  const playingRef = useRef(false)
  const playbackIntentRef = useRef<PlaybackIntent>('user_pick')
  const advanceRef = useRef<() => void>(() => {})
  const pendingGesturePlayRef = useRef(false)

  const resolveQueue = useCallback((): readonly PlayableTrack[] => {
    if (sessionTracks.length > 0 && (playAllActiveRef.current || source != null)) {
      return sessionTracks
    }
    return configRef.current.getQueue()
  }, [source])

  const resolveCurrentKey = useCallback((): string | null => {
    return activeTrackKey ?? configRef.current.getCurrentKey()
  }, [activeTrackKey])

  useEffect(() => {
    playAllActiveRef.current = playAllActive
  }, [playAllActive])
  useEffect(() => {
    playingRef.current = playing
  }, [playing])

  const pause = useCallback(() => {
    try {
      if (usePersistentPlayback) {
        persistentApiRef.current?.widgetRef.current?.pause()
      } else {
        widgetRef.current?.pause()
      }
    } catch {
      // Ignore widget pause failures and keep UI state responsive.
    }
    setPlaying(false)
  }, [persistentApiRef, usePersistentPlayback, widgetRef])

  const resume = useCallback(() => {
    try {
      if (usePersistentPlayback) {
        const api = persistentApiRef.current
        const widget = api?.widgetRef.current
        if (widget) {
          markPersistentGesturePlayWindow()
          api?.syncPlayInGesture()
        } else {
          const key = resolveCurrentKey()
          const queue = resolveQueue()
          const idx = findTrackIndex(queue, key, configRef.current.selectionMode)
          const track = idx >= 0 ? queue[idx] : null
          const url = track?.sc_url.trim() ?? ''
          if (url) {
            requestPersistentScLoadSync(url, { autoPlay: true })
          }
          api?.syncPlayInGesture()
        }
      } else {
        widgetRef.current?.play()
        setPlaying(true)
      }
      configRef.current.onResume?.()
    } catch {
      // Ignore widget play failures.
    }
  }, [persistentApiRef, resolveCurrentKey, resolveQueue, usePersistentPlayback, widgetRef])

  /** Safari: widget.play() must run inside the user-gesture call stack (Play All start). */
  const syncPlayInGesture = useCallback(() => {
    if (usePersistentPlayback) {
      persistentApiRef.current?.syncPlayInGesture()
      return
    }
    void import('../soundcloudWidgetApi').then(({ loadSoundCloudWidgetApi }) => loadSoundCloudWidgetApi())
    const widget = widgetRef.current
    if (widget) {
      pendingGesturePlayRef.current = false
      try {
        widget.play()
        setPlaying(true)
      } catch {
        // Widget play failed; bindWidgetOnLoad may retry when API attaches.
      }
      return
    }
    pendingGesturePlayRef.current = true
  }, [persistentApiRef, usePersistentPlayback, widgetRef])

  const pickTrack = useCallback(
    (track: PlayableTrack, options: PickTrackOptions = {}) => {
      // Registration is ref-only (no provider re-render). Refresh before acting so
      // song→Tracks picks don't keep a frozen prior page's getQueue / onPlayTrack.
      configRef.current = { ...registrationRef.current, widgetRef }

      const { keepPlayAll = false, fromPlayAllStart = false } = options
      const { selectionMode: mode, analytics: pageAnalytics, onPlayTrack: playTrackSideEffect } = configRef.current
      const key = playableTrackKey(track, mode)
      const currentKey = resolveCurrentKey()

      if (fromPlayAllStart) {
        if (!keepPlayAll && playAllActiveRef.current) {
          const queue = resolveQueue()
          const idx = findTrackIndex(queue, currentKey, mode)
          pageAnalytics.onPlayAllStopped(idx >= 0 ? idx + 1 : 0, queue.length, 'replaced_by_new_queue')
          setPlayAllActive(false)
          playAllActiveRef.current = false
        }
        pageAnalytics.onPlayStarted(track, playbackIntentRef.current, playAllActiveRef.current)
        playbackIntentRef.current = 'user_pick'
        setActiveTrackKey(key)
        // Engine-owned bootstrap: page onPlayTrack can be stale (frozen Tracks registration)
        // after route changes — must not rely on it for first iframe mount on Play All.
        if (usePersistentPlayback) {
          const scUrl = track.sc_url.trim()
          if (scUrl) {
            markPersistentGesturePlayWindow()
            const api = persistentApiRef.current
            const widgetReady = Boolean(api?.widgetRef.current)
            if (widgetReady && api) {
              // beginWidgetLoad handles autoplay; syncPlayInGesture here would replay primer audio (#116).
              api.loadTrack(scUrl, { autoPlay: true, remount: false })
            } else if (persistentScIframeIsWarm()) {
              requestPersistentScLoadSync(scUrl, { autoPlay: true, remount: false })
              api?.syncPlayInGesture()
            } else {
              requestPersistentScLoadSync(scUrl, { autoPlay: true, remount: true })
              api?.syncPlayInGesture()
            }
          }
        }
        configRef.current.onPlayTrack(track, {
          intent: playbackIntentRef.current,
          keepPlayAll,
          fromPlayAllStart: true,
        })
        if (!usePersistentPlayback) {
          syncPlayInGesture()
        }
        return
      }

      if (key && key === currentKey) {
        const targetUrl = track.sc_url.trim()
        const persistentUrlDrift =
          usePersistentPlayback && targetUrl && persistentScNeedsExplicitLoad(targetUrl)

        if (persistentUrlDrift) {
          // Fall through — load the requested track (never resume primer / stale iframe URL). R64 #129.
        } else {
          const activeWidget = usePersistentPlayback
            ? persistentApiRef.current?.widgetRef.current
            : widgetRef.current
          if (!activeWidget) {
            if (!usePersistentPlayback) {
              playTrackSideEffect(track, {
                intent: playbackIntentRef.current,
                keepPlayAll: playAllActiveRef.current,
              })
              return
            }
            // Persistent + no widget yet: fall through — first click must bootstrap + set source.
          } else if (playingRef.current) {
            pause()
            return
          } else {
            resume()
            return
          }
        }
      }

      if (!keepPlayAll && playAllActiveRef.current) {
        const queue = resolveQueue()
        const idx = findTrackIndex(queue, currentKey, mode)
        pageAnalytics.onPlayAllStopped(idx >= 0 ? idx + 1 : 0, queue.length, 'replaced_by_new_queue')
        setPlayAllActive(false)
        playAllActiveRef.current = false
        setSessionTracks(sessionQueueForPick(track, mode, () => configRef.current.getQueue()))
      }

      if (!keepPlayAll || !playAllActiveRef.current) {
        // Audio loads from `track`; chrome reads sessionTracks[position] — keep them aligned.
        setSessionTracks(sessionQueueForPick(track, mode, () => configRef.current.getQueue()))
      }

      pageAnalytics.onPlayStarted(track, playbackIntentRef.current, playAllActiveRef.current)
      playbackIntentRef.current = 'user_pick'
      setActiveTrackKey(key)
      if (!keepPlayAll || !playAllActiveRef.current) {
        setSource({ type: 'single', track_id: track.track_id })
      }
      if (usePersistentPlayback && !fromPlayAllStart) {
        const scUrl = track.sc_url.trim()
        if (scUrl) {
          markPersistentGesturePlayWindow()
          const api = persistentApiRef.current
          if (api?.widgetRef.current) {
            api.loadTrack(scUrl, { autoPlay: true, remount: false })
          } else if (persistentScIframeIsWarm()) {
            requestPersistentScLoadSync(scUrl, { autoPlay: true, remount: false })
            api?.syncPlayInGesture()
          } else {
            requestPersistentScLoadSync(scUrl, { autoPlay: true, remount: true })
            api?.syncPlayInGesture()
          }
        }
      }
      playTrackSideEffect(track, { intent: playbackIntentRef.current, keepPlayAll })
    },
    [
      pause,
      persistentApiRef,
      registrationRef,
      resolveCurrentKey,
      resolveQueue,
      resume,
      syncPlayInGesture,
      usePersistentPlayback,
      widgetRef,
    ],
  )

  const stop = useCallback(() => {
    const { analytics: pageAnalytics, selectionMode: mode } = configRef.current
    const queue = resolveQueue()
    const idx = findTrackIndex(queue, resolveCurrentKey(), mode)
    pageAnalytics.onPlayAllStopped(idx >= 0 ? idx + 1 : 0, queue.length, 'user_stop')
    setPlayAllActive(false)
    playAllActiveRef.current = false
    setSource(null)
    setSessionTracks([])
    setActiveTrackKey(null)
    if (usePersistentPlayback) {
      persistentApiRef.current?.dismiss()
    }
    pause()
  }, [pause, persistentApiRef, resolveCurrentKey, resolveQueue, usePersistentPlayback])

  const advance = useCallback(() => {
    const { analytics: pageAnalytics, selectionMode: mode, onAdvanceToIndex: scrollToIndex } = configRef.current
    const queue = resolveQueue()
    const currentKey = resolveCurrentKey()
    if (!queue.length || !currentKey) {
      setPlayAllActive(false)
      playAllActiveRef.current = false
      return
    }
    const idx = findTrackIndex(queue, currentKey, mode)
    if (idx < 0) {
      setPlayAllActive(false)
      playAllActiveRef.current = false
      return
    }
    const next = queue[idx + 1]
    if (!next) {
      pageAnalytics.onPlayAllStopped(queue.length, queue.length, 'queue_exhausted')
      setPlayAllActive(false)
      playAllActiveRef.current = false
      return
    }
    const current = queue[idx]
    if (current) {
      pageAnalytics.onQueueAdvanced(current, next, idx + 2, queue.length)
    }
    playbackIntentRef.current = 'queue_advance'
    scrollToIndex?.(idx + 1)
    pickTrack(next, { keepPlayAll: true })
  }, [pickTrack, resolveCurrentKey, resolveQueue])

  useEffect(() => {
    advanceRef.current = advance
  }, [advance])

  const jump = useCallback(
    (delta: -1 | 1) => {
      const { analytics: pageAnalytics, selectionMode: mode, onAdvanceToIndex: scrollToIndex } = configRef.current
      const queue = resolveQueue()
      const currentKey = resolveCurrentKey()
      if (!queue.length || !currentKey) return
      const idx = findTrackIndex(queue, currentKey, mode)
      if (idx < 0) return
      const nextIdx = idx + delta
      if (nextIdx < 0 || nextIdx >= queue.length) return
      const next = queue[nextIdx]
      const current = queue[idx]
      if (current && next) {
        pageAnalytics.onQueueSkipped(current, next, delta === 1 ? 'next' : 'previous', playAllActiveRef.current)
      }
      playbackIntentRef.current = 'queue_skip'
      scrollToIndex?.(nextIdx)
      pickTrack(next, { keepPlayAll: playAllActiveRef.current })
    },
    [pickTrack, resolveCurrentKey, resolveQueue],
  )

  const startPlayAll = useCallback(
    (playAllSource: Exclude<PlayerQueueSource, { type: 'single' }>, tracks: readonly PlayableTrack[]) => {
      if (!isPlayAllDesktopDevice()) return
      if (!tracks.length) return
      setSessionTracks(tracks)
      setSource(playAllSource)
      configRef.current.analytics.onPlayAllStarted(tracks.length)
      playbackIntentRef.current = 'play_all_start'
      setPlayAllActive(true)
      playAllActiveRef.current = true
      const first = tracks[0]
      if (first) pickTrack(first, { keepPlayAll: true, fromPlayAllStart: true })
      configRef.current.onStartPlayAll?.()
    },
    [pickTrack],
  )

  const actions: PlayerQueueActions = useMemo(
    () => ({
      startPlayAll: (playAllSource, tracks) => startPlayAll(playAllSource, tracks),
      pickTrack,
      advance,
      jump,
      jumpTo: (position) => {
        const queue = resolveQueue()
        const track = queue[position]
        if (!track) return
        playbackIntentRef.current = 'queue_skip'
        configRef.current.onAdvanceToIndex?.(position)
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
    [advance, jump, pause, pickTrack, resolveQueue, resume, startPlayAll, stop],
  )

  const state: PlayerQueueState = useMemo(() => {
    const tracks = sessionTracks.length > 0 ? sessionTracks : configRef.current.getQueue()
    const position = findTrackIndex(tracks, resolveCurrentKey(), configRef.current.selectionMode)
    return {
      source,
      tracks,
      position: position >= 0 ? position : 0,
      playing,
      currentPositionMs: 0,
      playAllActive,
    }
  }, [playAllActive, playing, resolveCurrentKey, sessionTracks, source])

  const bindWidgetOnLoad = useCallback(
    (wrap: HTMLElement | null) => {
      if (!wrap) return
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
              // Fire play_completed for every natural track finish, regardless of play-all mode.
              const queue = resolveQueue()
              const key = resolveCurrentKey()
              const idx = findTrackIndex(queue, key, configRef.current.selectionMode)
              const current = idx >= 0 ? queue[idx] : null
              if (current) {
                configRef.current.analytics.onTrackCompleted?.(current)
              }
              if (!playAllActiveRef.current) return
              advanceRef.current()
            },
          })
          if (pendingGesturePlayRef.current) {
            pendingGesturePlayRef.current = false
            try {
              widget.play()
            } catch {
              // Play All may need an explicit Resume tap if autoplay is blocked.
            }
          }
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
    setSessionTracks([])
    setActiveTrackKey(null)
    setPlaying(false)
    if (usePersistentPlayback) {
      persistentApiRef.current?.dismiss()
    }
  }, [persistentApiRef, usePersistentPlayback])

  const wirePersistentPlayer = useCallback(
    (handlers: {
      setOnFinish: (handler: (() => void) | null) => void
      setOnPlayingChange: (handler: ((playing: boolean) => void) | null) => void
    }) => {
      handlers.setOnFinish(() => {
        // Fire play_completed for every natural track finish, regardless of play-all mode.
        const queue = resolveQueue()
        const key = resolveCurrentKey()
        const idx = findTrackIndex(queue, key, configRef.current.selectionMode)
        const current = idx >= 0 ? queue[idx] : null
        if (current) {
          configRef.current.analytics.onTrackCompleted?.(current)
        }
        if (!playAllActiveRef.current) return
        advanceRef.current()
      })
      handlers.setOnPlayingChange(setPlaying)
    },
    [],
  )

  return useMemo(
    () => ({
      state,
      actions,
      bindWidgetOnLoad,
      resetSession,
      wirePersistentPlayer,
    }),
    [actions, bindWidgetOnLoad, resetSession, state, wirePersistentPlayer],
  )
}
