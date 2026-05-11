import { useEffect, useRef, type RefObject } from 'react'
import { loadSoundCloudWidgetApi, type SoundCloudWidget } from './soundcloudWidgetApi'

const YT_MESSAGE_ORIGINS = new Set(['https://www.youtube-nocookie.com', 'https://www.youtube.com'])
const YT_POST_TARGET = 'https://www.youtube-nocookie.com'

/** YouTube IFrame API player states (subset). */
const YT_PLAYER_STATE_PLAYING = 1
const YT_PLAYER_STATE_BUFFERING = 3

function postMessagePauseYoutubeEmbed(iframe: HTMLIFrameElement | null): void {
  if (!iframe?.contentWindow) return
  const payload = JSON.stringify({ event: 'command', func: 'pauseVideo', args: '' })
  try {
    iframe.contentWindow.postMessage(payload, YT_POST_TARGET)
  } catch {
    // ignore
  }
}

function postMessageYoutubeListeningHandshake(iframe: HTMLIFrameElement | null): void {
  if (!iframe?.contentWindow) return
  /** Modern embeds often emit `infoDelivery` / `playerState` only after a `listening` handshake. */
  const payloads = [
    JSON.stringify({ event: 'listening' }),
    JSON.stringify({ event: 'listening', id: 1, channel: 'widget' }),
  ]
  for (const payload of payloads) {
    try {
      iframe.contentWindow.postMessage(payload, YT_POST_TARGET)
    } catch {
      // ignore
    }
  }
}

function payloadIndicatesYoutubePlaying(parsed: Record<string, unknown>): boolean {
  if (parsed.event === 'onStateChange') {
    const st = Number(parsed.info)
    if (st === YT_PLAYER_STATE_PLAYING || st === YT_PLAYER_STATE_BUFFERING) return true
  }
  if (parsed.event === 'infoDelivery' && parsed.info && typeof parsed.info === 'object') {
    const ps = Number((parsed.info as Record<string, unknown>).playerState)
    if (ps === YT_PLAYER_STATE_PLAYING || ps === YT_PLAYER_STATE_BUFFERING) return true
  }
  return false
}

/**
 * Detect “YouTube is playing” from embed postMessage.
 * Do not require `event.source === iframe.contentWindow`: the player often posts from an inner frame,
 * so `source` may not match the outer embed’s `contentWindow`.
 */
/**
 * SoundCloud’s `Widget.pause()` / internal focus can scroll the playlist iframe into view.
 * When the embed sits above the YouTube block (songbook layout), that feels like an unwanted “jump back up”.
 */
function restoreViewportScroll(left: number, top: number): void {
  try {
    window.scrollTo({ left, top, behavior: 'instant' })
  } catch {
    window.scrollTo(left, top)
  }
}

function scheduleViewportScrollRestores(left: number, top: number): void {
  const go = () => restoreViewportScroll(left, top)
  go()
  queueMicrotask(go)
  requestAnimationFrame(go)
  requestAnimationFrame(() => requestAnimationFrame(go))
  window.setTimeout(go, 0)
  window.setTimeout(go, 80)
  window.setTimeout(go, 200)
}

function messageIndicatesYoutubePlaying(event: MessageEvent): boolean {
  if (!YT_MESSAGE_ORIGINS.has(event.origin)) return false
  const raw = event.data
  if (raw == null) return false
  let parsed: unknown = raw
  if (typeof raw === 'string') {
    if (!raw.startsWith('{')) return false
    try {
      parsed = JSON.parse(raw) as unknown
    } catch {
      return false
    }
  }
  if (!parsed || typeof parsed !== 'object') return false
  return payloadIndicatesYoutubePlaying(parsed as Record<string, unknown>)
}

export type ExclusiveYoutubeSoundcloudOptions = {
  youtubeIframeRef: RefObject<HTMLIFrameElement | null>
  soundcloudWrapRef: RefObject<HTMLElement | null>
  /** When false, listeners and widget bindings are not installed. */
  enabled: boolean
  /** Bumps the effect when featured media URLs change (iframe nodes / lazy timing). */
  syncKey: string
}

/**
 * When both a YouTube featured embed and a SoundCloud widget exist on the same page,
 * ensures only one plays at a time (SoundCloud Widget `PLAY` vs YouTube `onStateChange`).
 *
 * Cross-origin iframe clicks do not bubble to the parent, so exclusivity is driven by
 * player APIs / `postMessage`, not wrapper click handlers.
 */
export function useExclusiveYoutubeSoundcloudPlayback({
  youtubeIframeRef,
  soundcloudWrapRef,
  enabled,
  syncKey,
}: ExclusiveYoutubeSoundcloudOptions): void {
  const scWidgetRef = useRef<SoundCloudWidget | null>(null)
  const scCleanupRef = useRef<(() => void) | null>(null)
  const scBindSerialRef = useRef(0)

  useEffect(() => {
    if (!enabled) return

    const pauseSoundcloudFromDom = () => {
      const wrap = soundcloudWrapRef.current
      const iframe = wrap?.querySelector<HTMLIFrameElement>('iframe.sc-embed-frame')
      if (!iframe) return

      const left = window.scrollX
      const top = window.scrollY

      const w = scWidgetRef.current
      if (w) {
        try {
          w.pause()
        } catch {
          // ignore
        }
      }
      scheduleViewportScrollRestores(left, top)

      void loadSoundCloudWidgetApi()
        .then((SC) => {
          if (!document.body.contains(iframe)) return
          try {
            SC.Widget(iframe).pause()
          } catch {
            // ignore
          }
          scheduleViewportScrollRestores(left, top)
        })
        .catch(() => {
          // ignore
        })
    }

    const onWindowMessage = (event: MessageEvent) => {
      if (!messageIndicatesYoutubePlaying(event)) return
      pauseSoundcloudFromDom()
    }
    window.addEventListener('message', onWindowMessage)

    const onYtLoad = () => postMessageYoutubeListeningHandshake(youtubeIframeRef.current)

    const attachYtHandshake = (): (() => void) => {
      const el = youtubeIframeRef.current
      if (!el) return () => {}
      el.addEventListener('load', onYtLoad)
      queueMicrotask(onYtLoad)
      return () => el.removeEventListener('load', onYtLoad)
    }

    let cleanupYt = attachYtHandshake()
    const ytRetryId = window.setTimeout(() => {
      cleanupYt()
      cleanupYt = attachYtHandshake()
    }, 500)

    let cancelled = false

    const tryBindSoundcloud = () => {
      if (cancelled) return
      const wrap = soundcloudWrapRef.current
      if (!wrap) return
      const iframe = wrap.querySelector<HTMLIFrameElement>('iframe.sc-embed-frame')
      if (!iframe) return

      scCleanupRef.current?.()
      scCleanupRef.current = null
      scWidgetRef.current = null

      scBindSerialRef.current += 1
      const serial = scBindSerialRef.current

      void loadSoundCloudWidgetApi()
        .then((SC) => {
          if (cancelled || serial !== scBindSerialRef.current || !document.body.contains(iframe)) return
          const widget = SC.Widget(iframe)
          scWidgetRef.current = widget

          const onPlay = () => {
            postMessagePauseYoutubeEmbed(youtubeIframeRef.current)
          }

          const onReady = () => {
            widget.bind(SC.Widget.Events.PLAY, onPlay)
          }

          widget.bind(SC.Widget.Events.READY, onReady)

          scCleanupRef.current = () => {
            try {
              widget.unbind(SC.Widget.Events.READY)
            } catch {
              /* ignore */
            }
            try {
              widget.unbind(SC.Widget.Events.PLAY)
            } catch {
              /* ignore */
            }
            if (scWidgetRef.current === widget) scWidgetRef.current = null
          }
        })
        .catch(() => {
          // Widget API unavailable — embeds still work, exclusivity degrades gracefully.
        })
    }

    const wrap = soundcloudWrapRef.current
    let mo: MutationObserver | null = null
    if (wrap) {
      mo = new MutationObserver(() => tryBindSoundcloud())
      mo.observe(wrap, { childList: true, subtree: true })
    }
    tryBindSoundcloud()
    const scRetryId = window.setTimeout(tryBindSoundcloud, 600)

    return () => {
      cancelled = true
      window.removeEventListener('message', onWindowMessage)
      cleanupYt()
      window.clearTimeout(ytRetryId)
      window.clearTimeout(scRetryId)
      mo?.disconnect()
      scCleanupRef.current?.()
      scCleanupRef.current = null
    }
  }, [enabled, syncKey, youtubeIframeRef, soundcloudWrapRef])
}
