import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  type MutableRefObject,
} from 'react'
import { loadSoundCloudWidgetApi, type SoundCloudWidget } from '../soundcloudWidgetApi'
import {
  PERSISTENT_SC_PLAYER_HEIGHT_PX,
  PERSISTENT_SC_PLAYER_MODE,
  soundcloudPlayerSrc,
  soundcloudWidgetLoadOptions,
} from '../soundcloudPlayerUrl'
import { useTheme } from '../theme'
import {
  bindPersistentWidgetPlayback,
  PERSISTENT_SC_IFRAME_ALLOW,
  SC_FINISH_FALLBACK_LEAD_MS,
  type SoundCloudWidgetExtended,
  type SoundCloudWidgetGlobal,
  type SoundCloudWidgetLoadOptions,
} from './soundcloudWidgetExtended'
import {
  clearPersistentGesturePlayWindow,
  markPersistentGesturePlayWindow,
  persistentGesturePlayWindowActive,
} from './persistentGesturePlay'
import {
  resetAndPrimePersistentSc,
  requestPersistentScLoad,
  requestPersistentScLoadSync,
} from './persistentScBootstrap'
import type { PersistentScPlayerApi } from './persistentScPlayerContext'
import { usePersistentScBootstrap } from './usePersistentScBootstrap'
import './PersistentSoundCloudPlayer.css'

const POSITION_POLL_MS = 1500

export type PersistentSoundCloudPlayerProps = {
  apiRef: MutableRefObject<PersistentScPlayerApi | null>
  widgetRef: MutableRefObject<SoundCloudWidget | null>
}

function scApiFromWindow(): SoundCloudWidgetGlobal | null {
  if (typeof window === 'undefined') return null
  const sc = window.SC as SoundCloudWidgetGlobal | undefined
  return sc?.Widget ? sc : null
}

/**
 * App-root SoundCloud iframe (desktop). One embed; queue advances via widget.load().
 */
export function PersistentSoundCloudPlayer({ apiRef, widgetRef }: PersistentSoundCloudPlayerProps) {
  const { theme } = useTheme()
  const { url: bootstrapUrl, autoPlay: bootstrapAutoPlay, generation: bootstrapGeneration } =
    usePersistentScBootstrap()
  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const widgetRefInternal = useRef<SoundCloudWidgetExtended | null>(null)
  const scRef = useRef<SoundCloudWidgetGlobal | null>(null)
  const onFinishRef = useRef<(() => void) | null>(null)
  const onPlayingChangeRef = useRef<((playing: boolean) => void) | null>(null)
  const pendingGesturePlayRef = useRef(false)
  const loadedUrlRef = useRef<string | null>(null)
  const advancedForCurrentTrackRef = useRef(false)
  const durationMsRef = useRef<number | null>(null)
  const pollTimerRef = useRef<number | null>(null)
  const initPromiseRef = useRef<Promise<boolean> | null>(null)

  const stopPositionPoll = useCallback(() => {
    if (pollTimerRef.current == null) return
    window.clearInterval(pollTimerRef.current)
    pollTimerRef.current = null
  }, [])

  const startPositionPoll = useCallback(() => {
    if (pollTimerRef.current != null) return
    pollTimerRef.current = window.setInterval(() => {
      const widget = widgetRefInternal.current
      if (!widget || advancedForCurrentTrackRef.current) return
      widget.getPosition((positionMs) => {
        const durationMs = durationMsRef.current
        if (durationMs == null || advancedForCurrentTrackRef.current) return
        if (positionMs >= durationMs - SC_FINISH_FALLBACK_LEAD_MS) {
          advancedForCurrentTrackRef.current = true
          onFinishRef.current?.()
        }
      })
      if (durationMsRef.current == null) {
        widget.getDuration((ms) => {
          if (ms > 0) durationMsRef.current = ms
        })
      }
    }, POSITION_POLL_MS)
  }, [])

  const syncPlayingStateFromWidget = useCallback(
    (widget: SoundCloudWidgetExtended | null | undefined) => {
      if (!widget) return
      widget.isPaused((paused) => {
        onPlayingChangeRef.current?.(!paused)
      })
    },
    [],
  )

  const tryPlayWidget = useCallback(
    (widget: SoundCloudWidgetExtended | null | undefined, opts: { notify?: boolean } = {}) => {
      if (!widget) return false
      const notify = opts.notify ?? true
      try {
        widget.play()
        pendingGesturePlayRef.current = false
        if (notify) onPlayingChangeRef.current?.(true)
        return true
      } catch {
        pendingGesturePlayRef.current = true
        return false
      }
    },
    [],
  )

  const handleReady = useCallback(() => {
    advancedForCurrentTrackRef.current = false
    durationMsRef.current = null
    const widget = widgetRefInternal.current
    widget?.getDuration((ms) => {
      durationMsRef.current = ms > 0 ? ms : null
    })
    syncPlayingStateFromWidget(widget)
    if (pendingGesturePlayRef.current || persistentGesturePlayWindowActive()) {
      tryPlayWidget(widget)
    }
  }, [syncPlayingStateFromWidget, tryPlayWidget])

  const handleFinish = useCallback(() => {
    if (advancedForCurrentTrackRef.current) return
    advancedForCurrentTrackRef.current = true
    onFinishRef.current?.()
  }, [])

  const bindWidgetFromIframe = useCallback(
    (iframe: HTMLIFrameElement): boolean => {
      const sc = scRef.current ?? scApiFromWindow()
      if (!sc?.Widget || !document.body.contains(iframe)) return false

      scRef.current = sc
      const widget = sc.Widget(iframe)
      widgetRefInternal.current = widget
      widgetRef.current = widget
      bindPersistentWidgetPlayback(widget, sc, {
        onReady: handleReady,
        onFinish: handleFinish,
        onPlayProgress: (positionMs) => {
          const durationMs = durationMsRef.current
          if (durationMs == null || advancedForCurrentTrackRef.current) return
          if (positionMs >= durationMs - SC_FINISH_FALLBACK_LEAD_MS) {
            handleFinish()
          }
        },
        onPlayingChange: (playing) => {
          onPlayingChangeRef.current?.(playing)
          if (playing) {
            clearPersistentGesturePlayWindow()
            startPositionPoll()
          } else {
            stopPositionPoll()
          }
        },
      })
      syncPlayingStateFromWidget(widget)
      if (pendingGesturePlayRef.current || persistentGesturePlayWindowActive()) {
        tryPlayWidget(widget)
      }
      return true
    },
    [handleFinish, handleReady, startPositionPoll, stopPositionPoll, syncPlayingStateFromWidget, tryPlayWidget, widgetRef],
  )

  const ensureWidgetReady = useCallback(async (): Promise<boolean> => {
    if (widgetRefInternal.current && scRef.current) return true
    const iframe = iframeRef.current
    if (!iframe) return false

    if (bindWidgetFromIframe(iframe)) return true
    if (initPromiseRef.current) return initPromiseRef.current

    initPromiseRef.current = (async () => {
      try {
        await loadSoundCloudWidgetApi()
        if (!iframeRef.current || !document.body.contains(iframeRef.current)) return false
        return bindWidgetFromIframe(iframeRef.current)
      } catch {
        initPromiseRef.current = null
        return false
      }
    })()

    return initPromiseRef.current
  }, [bindWidgetFromIframe])

  const beginWidgetLoad = useCallback(
    (widget: SoundCloudWidgetExtended, trimmed: string, autoPlay: boolean) => {
      advancedForCurrentTrackRef.current = false
      durationMsRef.current = null
      loadedUrlRef.current = trimmed
      if (autoPlay) {
        pendingGesturePlayRef.current = true
        markPersistentGesturePlayWindow()
      }

      const loadOptions: SoundCloudWidgetLoadOptions = {
        ...soundcloudWidgetLoadOptions(theme, autoPlay, PERSISTENT_SC_PLAYER_MODE),
        callback: () => {
          syncPlayingStateFromWidget(widget)
          if (pendingGesturePlayRef.current || persistentGesturePlayWindowActive()) {
            tryPlayWidget(widget)
          }
        },
      }
      widget.load(trimmed, loadOptions)
      if (autoPlay) {
        tryPlayWidget(widget, { notify: false })
      }
    },
    [syncPlayingStateFromWidget, theme, tryPlayWidget],
  )

  const dismiss = useCallback(() => {
    stopPositionPoll()
    pendingGesturePlayRef.current = false
    clearPersistentGesturePlayWindow()
    loadedUrlRef.current = null
    advancedForCurrentTrackRef.current = false
    durationMsRef.current = null
    initPromiseRef.current = null
    try {
      widgetRefInternal.current?.pause()
    } catch {
      // Ignore pause failures during teardown.
    }
    widgetRefInternal.current = null
    widgetRef.current = null
    scRef.current = null
    resetAndPrimePersistentSc()
  }, [stopPositionPoll, widgetRef])

  const loadTrack = useCallback(
    (scUrl: string, opts: { autoPlay?: boolean; remount?: boolean } = {}) => {
      const trimmed = scUrl.trim()
      if (!trimmed) return
      const autoPlay = opts.autoPlay ?? false
      const remount = opts.remount ?? false
      void loadSoundCloudWidgetApi()
      if (autoPlay) markPersistentGesturePlayWindow()

      if (remount) {
        widgetRefInternal.current = null
        widgetRef.current = null
        scRef.current = null
        initPromiseRef.current = null
        loadedUrlRef.current = trimmed
        if (autoPlay) pendingGesturePlayRef.current = true
        if (autoPlay) {
          requestPersistentScLoadSync(trimmed, { autoPlay, remount: true })
        } else {
          requestPersistentScLoad(trimmed, { autoPlay, remount: true })
        }
        return
      }

      const iframeMounted = Boolean(bootstrapUrl)
      const sameAsBootstrap = bootstrapUrl === trimmed
      const widget = widgetRefInternal.current

      if (!iframeMounted || !widget) {
        loadedUrlRef.current = trimmed
        if (autoPlay) pendingGesturePlayRef.current = true
        if (autoPlay) {
          requestPersistentScLoadSync(trimmed, { autoPlay, remount: sameAsBootstrap && iframeMounted })
        } else {
          requestPersistentScLoad(trimmed, { autoPlay, remount: sameAsBootstrap && iframeMounted })
        }
        return
      }

      if (loadedUrlRef.current === trimmed) {
        if (autoPlay) {
          beginWidgetLoad(widget, trimmed, autoPlay)
        }
        return
      }

      beginWidgetLoad(widget, trimmed, autoPlay)
    },
    [beginWidgetLoad, bootstrapUrl, widgetRef],
  )

  const syncPlayInGesture = useCallback(() => {
    markPersistentGesturePlayWindow()
    pendingGesturePlayRef.current = true
    void loadSoundCloudWidgetApi()

    const widget = widgetRefInternal.current
    if (widget) {
      tryPlayWidget(widget)
      return
    }

    const iframe = iframeRef.current
    if (iframe && bindWidgetFromIframe(iframe)) return

    void ensureWidgetReady()
  }, [bindWidgetFromIframe, ensureWidgetReady, tryPlayWidget])

  useLayoutEffect(() => {
    const api = apiRef.current
    if (!api) return
    api.loadTrack = loadTrack
    api.syncPlayInGesture = syncPlayInGesture
    api.dismiss = dismiss
    api.setOnFinish = (handler) => {
      onFinishRef.current = handler
    }
    api.setOnPlayingChange = (handler) => {
      onPlayingChangeRef.current = handler
    }
  }, [apiRef, dismiss, loadTrack, syncPlayInGesture])

  useEffect(() => {
    if (bootstrapAutoPlay) {
      pendingGesturePlayRef.current = true
      markPersistentGesturePlayWindow()
    }
  }, [bootstrapAutoPlay, bootstrapGeneration, bootstrapUrl])

  useLayoutEffect(() => {
    if (!bootstrapUrl) return
    initPromiseRef.current = null
    widgetRefInternal.current = null
    widgetRef.current = null
    scRef.current = null
  }, [bootstrapGeneration, bootstrapUrl, widgetRef])

  const handleIframeLoad = useCallback(() => {
    initPromiseRef.current = null
    widgetRefInternal.current = null
    widgetRef.current = null
    scRef.current = null
    const iframe = iframeRef.current
    if (iframe && bindWidgetFromIframe(iframe)) return
    void ensureWidgetReady()
  }, [bindWidgetFromIframe, ensureWidgetReady, widgetRef])

  useEffect(() => () => stopPositionPoll(), [stopPositionPoll])

  useEffect(() => {
    void loadSoundCloudWidgetApi()
  }, [])

  if (!bootstrapUrl) return null

  return (
    <div className="persistent-sc-player">
      <iframe
        key={`persistent-sc-${bootstrapGeneration}`}
        ref={iframeRef}
        className="sc-embed-frame sc-embed-frame--persistent persistent-sc-player__iframe"
        title="SoundCloud player"
        width="100%"
        height={PERSISTENT_SC_PLAYER_HEIGHT_PX}
        scrolling="no"
        allow={PERSISTENT_SC_IFRAME_ALLOW}
        src={soundcloudPlayerSrc(bootstrapUrl, PERSISTENT_SC_PLAYER_MODE, bootstrapAutoPlay, theme)}
        onLoad={handleIframeLoad}
      />
    </div>
  )
}
