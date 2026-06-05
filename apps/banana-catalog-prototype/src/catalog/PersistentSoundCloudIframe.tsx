import { useCallback, useEffect, useImperativeHandle, useRef, forwardRef } from 'react'
import { soundcloudPlayerSrc } from './soundcloudPlayerUrl'
import { useTheme } from './theme'
import {
  loadSoundCloudWidgetApi,
  type SoundCloudWidget,
  type SoundCloudWidgetEvents,
} from './soundcloudWidgetApi'

export type PersistentSoundCloudHandle = {
  /** Load a track on the existing iframe (call from user-gesture handlers when possible). */
  loadTrack: (scUrl: string, options?: { autoPlay?: boolean }) => void
  pause: () => void
  getWidget: () => SoundCloudWidget | null
}

export type PersistentSoundCloudIframeProps = {
  /** Initial iframe `src` only; subsequent tracks use `widget.load()`. */
  initialScUrl: string
  title?: string
  height?: number
  mode?: 'visual' | 'list'
  onLoad?: () => void
  onWidgetReady?: (widget: SoundCloudWidget, events: SoundCloudWidgetEvents) => void
}

type PendingLoad = { scUrl: string; autoPlay: boolean }

export const PersistentSoundCloudIframe = forwardRef<PersistentSoundCloudHandle, PersistentSoundCloudIframeProps>(
  function PersistentSoundCloudIframe(
    { initialScUrl, title = 'SoundCloud player', height = 300, mode = 'visual', onLoad, onWidgetReady },
    ref,
  ) {
    const { theme } = useTheme()
    const iframeRef = useRef<HTMLIFrameElement>(null)
    const widgetRef = useRef<SoundCloudWidget | null>(null)
    const pendingLoadRef = useRef<PendingLoad | null>(null)
    const onWidgetReadyRef = useRef(onWidgetReady)
    useEffect(() => {
      onWidgetReadyRef.current = onWidgetReady
    }, [onWidgetReady])

    const flushPendingLoad = useCallback(() => {
      const widget = widgetRef.current
      const pending = pendingLoadRef.current
      if (!widget || !pending) return
      pendingLoadRef.current = null
      widget.load(pending.scUrl, { auto_play: pending.autoPlay })
    }, [])

    const loadTrack = useCallback(
      (scUrl: string, options?: { autoPlay?: boolean }) => {
        const autoPlay = options?.autoPlay ?? false
        const widget = widgetRef.current
        if (!widget) {
          pendingLoadRef.current = { scUrl, autoPlay }
          return
        }
        widget.load(scUrl, { auto_play: autoPlay })
      },
      [],
    )

    const pause = useCallback(() => {
      try {
        widgetRef.current?.pause()
      } catch {
        // Ignore widget pause failures.
      }
    }, [])

    useImperativeHandle(
      ref,
      () => ({
        loadTrack,
        pause,
        getWidget: () => widgetRef.current,
      }),
      [loadTrack, pause],
    )

    const bindWidget = useCallback(() => {
      const iframe = iframeRef.current
      if (!iframe) return
      void loadSoundCloudWidgetApi()
        .then((SC) => {
          if (!iframeRef.current || !document.body.contains(iframeRef.current)) return
          const widget = SC.Widget(iframeRef.current)
          widgetRef.current = widget
          onWidgetReadyRef.current?.(widget, SC.Widget.Events)
          flushPendingLoad()
        })
        .catch(() => {
          widgetRef.current = null
        })
    }, [flushPendingLoad])

    return (
      <iframe
        ref={iframeRef}
        className="sc-embed-frame"
        title={title}
        width="100%"
        height={height}
        loading="eager"
        scrolling="no"
        allow="autoplay"
        src={soundcloudPlayerSrc(initialScUrl, mode, false, theme)}
        onLoad={() => {
          onLoad?.()
          bindWidget()
        }}
      />
    )
  },
)
