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
import { resetPersistentScBootstrap, requestPersistentScLoad, setPersistentScBootstrap } from './persistentScBootstrap'
import type { PersistentScPlayerApi } from './persistentScPlayerContext'
import { usePersistentScBootstrap } from './usePersistentScBootstrap'
import './PersistentSoundCloudPlayer.css'

const POSITION_POLL_MS = 1500

export type PersistentSoundCloudPlayerProps = {
  apiRef: MutableRefObject<PersistentScPlayerApi | null>
  widgetRef: MutableRefObject<SoundCloudWidget | null>
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

  const tryPlayWidget = useCallback((widget: SoundCloudWidgetExtended | null | undefined) => {
    if (!widget) return false
    try {
      widget.play()
      onPlayingChangeRef.current?.(true)
      pendingGesturePlayRef.current = false
      return true
    } catch {
      pendingGesturePlayRef.current = true
      return false
    }
  }, [])

  const handleReady = useCallback(() => {
    advancedForCurrentTrackRef.current = false
    durationMsRef.current = null
    const widget = widgetRefInternal.current
    widget?.getDuration((ms) => {
      durationMsRef.current = ms > 0 ? ms : null
    })
    if (pendingGesturePlayRef.current) {
      tryPlayWidget(widget)
    }
  }, [tryPlayWidget])

  const handleFinish = useCallback(() => {
    if (advancedForCurrentTrackRef.current) return
    advancedForCurrentTrackRef.current = true
    onFinishRef.current?.()
  }, [])

  const ensureWidgetReady = useCallback(async (): Promise<boolean> => {
    if (widgetRefInternal.current && scRef.current) return true
    const iframe = iframeRef.current
    if (!iframe) return false
    if (initPromiseRef.current) return initPromiseRef.current

    initPromiseRef.current = (async () => {
      try {
        const sc = (await loadSoundCloudWidgetApi()) as unknown as SoundCloudWidgetGlobal
        if (!iframeRef.current || !document.body.contains(iframeRef.current)) return false
        scRef.current = sc
        const widget = sc.Widget(iframeRef.current)
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
            if (playing) startPositionPoll()
            else stopPositionPoll()
          },
        })
        if (pendingGesturePlayRef.current) {
          tryPlayWidget(widget)
        }
        return true
      } catch {
        initPromiseRef.current = null
        return false
      }
    })()

    return initPromiseRef.current
  }, [handleFinish, handleReady, startPositionPoll, stopPositionPoll, widgetRef])

  const beginWidgetLoad = useCallback(
    (widget: SoundCloudWidgetExtended, trimmed: string, autoPlay: boolean) => {
      advancedForCurrentTrackRef.current = false
      durationMsRef.current = null
      loadedUrlRef.current = trimmed
      if (autoPlay) pendingGesturePlayRef.current = true

      const loadOptions: SoundCloudWidgetLoadOptions = {
        ...soundcloudWidgetLoadOptions(theme, autoPlay, PERSISTENT_SC_PLAYER_MODE),
        callback: () => {
          if (pendingGesturePlayRef.current) {
            tryPlayWidget(widget)
          }
        },
      }
      widget.load(trimmed, loadOptions)
    },
    [theme, tryPlayWidget],
  )

  const dismiss = useCallback(() => {
    stopPositionPoll()
    pendingGesturePlayRef.current = false
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
    resetPersistentScBootstrap()
  }, [stopPositionPoll, widgetRef])

  const loadTrack = useCallback(
    (scUrl: string, opts: { autoPlay?: boolean; remount?: boolean } = {}) => {
      const trimmed = scUrl.trim()
      if (!trimmed) return
      const autoPlay = opts.autoPlay ?? false
      const remount = opts.remount ?? false
      void loadSoundCloudWidgetApi()

      if (remount) {
        widgetRefInternal.current = null
        widgetRef.current = null
        scRef.current = null
        initPromiseRef.current = null
        loadedUrlRef.current = trimmed
        if (autoPlay) pendingGesturePlayRef.current = true
        requestPersistentScLoad(trimmed, { autoPlay, remount: true })
        return
      }

      const iframeMounted = Boolean(bootstrapUrl)
      const sameAsBootstrap = bootstrapUrl === trimmed
      const widget = widgetRefInternal.current

      if (!iframeMounted || !widget) {
        loadedUrlRef.current = trimmed
        if (autoPlay) pendingGesturePlayRef.current = true
        requestPersistentScLoad(trimmed, { autoPlay, remount: sameAsBootstrap && iframeMounted })
        return
      }

      if (loadedUrlRef.current === trimmed) {
        if (autoPlay) {
          beginWidgetLoad(widget, trimmed, autoPlay)
        }
        return
      }

      if (!sameAsBootstrap) {
        setPersistentScBootstrap(trimmed, autoPlay)
      }
      beginWidgetLoad(widget, trimmed, autoPlay)
    },
    [beginWidgetLoad, bootstrapUrl, widgetRef],
  )

  const syncPlayInGesture = useCallback(() => {
    void loadSoundCloudWidgetApi()
    const widget = widgetRefInternal.current
    if (widget) {
      pendingGesturePlayRef.current = true
      tryPlayWidget(widget)
      return
    }
    pendingGesturePlayRef.current = true
    void ensureWidgetReady()
  }, [ensureWidgetReady, tryPlayWidget])

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
    if (bootstrapAutoPlay) pendingGesturePlayRef.current = true
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
    void ensureWidgetReady()
  }, [ensureWidgetReady, widgetRef])

  useEffect(() => () => stopPositionPoll(), [stopPositionPoll])

  useEffect(() => {
    void loadSoundCloudWidgetApi()
  }, [])

  if (!bootstrapUrl) return null

  return (
    <div className="persistent-sc-player">
      <iframe
        key={`${bootstrapGeneration}:${bootstrapUrl}`}
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
