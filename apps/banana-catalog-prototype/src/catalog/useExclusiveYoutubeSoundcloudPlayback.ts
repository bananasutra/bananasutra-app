import { useEffect, useRef, type MutableRefObject, type RefObject } from 'react'
import { loadSoundCloudWidgetApi, type SoundCloudWidget } from './soundcloudWidgetApi'
import { YOUTUBE_EMBED_POST_MESSAGE_ORIGINS } from './youtubeEmbedUrl'

const YT_MESSAGE_ORIGINS = new Set<string>([...YOUTUBE_EMBED_POST_MESSAGE_ORIGINS])

/** YouTube IFrame API player states (subset). */
const YT_PLAYER_STATE_PLAYING = 1
const YT_PLAYER_STATE_BUFFERING = 3

function postMessagePauseYoutubeEmbed(iframe: HTMLIFrameElement | null): void {
  if (!iframe?.contentWindow) return
  const payload = JSON.stringify({ event: 'command', func: 'pauseVideo', args: '' })
  for (const origin of YOUTUBE_EMBED_POST_MESSAGE_ORIGINS) {
    try {
      iframe.contentWindow.postMessage(payload, origin)
    } catch {
      // ignore
    }
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
    for (const origin of YOUTUBE_EMBED_POST_MESSAGE_ORIGINS) {
      try {
        iframe.contentWindow.postMessage(payload, origin)
      } catch {
        // ignore
      }
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

function iframesFromSoundcloudWraps(
  soundcloudWrapRefs: ReadonlyArray<RefObject<HTMLElement | null>>,
): HTMLIFrameElement[] {
  const out: HTMLIFrameElement[] = []
  for (const r of soundcloudWrapRefs) {
    const wrap = r.current
    if (!wrap) continue
    const iframe = wrap.querySelector<HTMLIFrameElement>('iframe.sc-embed-frame')
    if (iframe) out.push(iframe)
  }
  return out
}

/** Imperative pause for SoundCloud widgets under embed wrap refs (inline + persistent). */
export function pauseSoundcloudWidgetsInWraps(
  wrapRefs: ReadonlyArray<RefObject<HTMLElement | null>>,
  excludeIframe: HTMLIFrameElement | null = null,
  preserveViewport = true,
): void {
  const targets = iframesFromSoundcloudWraps(wrapRefs).filter((el) => el !== excludeIframe)
  if (!targets.length) return

  const anchor = { left: window.scrollX, top: window.scrollY }

  void loadSoundCloudWidgetApi()
    .then((SC) => {
      for (const iframe of targets) {
        if (!document.body.contains(iframe)) continue
        try {
          SC.Widget(iframe).pause()
        } catch {
          // ignore
        }
      }
      if (preserveViewport) restoreViewportAfterSoundcloudPause(anchor.left, anchor.top)
    })
    .catch(() => {
      // ignore
    })
}

function pauseSoundcloudIframesExcept(
  iframes: HTMLIFrameElement[],
  excludeIframe: HTMLIFrameElement | null,
  preserveViewport: boolean,
  isStale: () => boolean,
): void {
  const targets = iframes.filter((el) => el !== excludeIframe)
  if (!targets.length) return

  const anchor = { left: window.scrollX, top: window.scrollY }

  void loadSoundCloudWidgetApi()
    .then((SC) => {
      if (isStale()) return
      for (const iframe of targets) {
        if (!document.body.contains(iframe)) continue
        try {
          SC.Widget(iframe).pause()
        } catch {
          // ignore
        }
      }
      if (preserveViewport && !isStale()) restoreViewportAfterSoundcloudPause(anchor.left, anchor.top)
    })
    .catch(() => {
      // ignore
    })
}

/** SoundCloud pause() scrolls the playlist into view; restore the pre-pause viewport briefly. */
function restoreViewportAfterSoundcloudPause(left: number, top: number): void {
  const run = () => {
    try {
      window.scrollTo({ left, top, behavior: 'instant' })
    } catch {
      window.scrollTo(left, top)
    }
  }
  run()
  queueMicrotask(run)
  requestAnimationFrame(run)
  window.setTimeout(run, 0)
  window.setTimeout(run, 50)
  window.setTimeout(run, 150)
}

export type ExclusiveYoutubeSoundcloudControls = {
  /** Pause every SoundCloud widget on the page (e.g. before releasing a click-to-load YouTube facade). */
  pauseAllSoundcloud: () => void
}

export type ExclusiveYoutubeSoundcloudOptions = {
  youtubeIframeRef: RefObject<HTMLIFrameElement | null>
  /** Ancestors of each `.sc-embed-frame` iframe (e.g. featured EP wrap + lazy spotlight wrap). */
  soundcloudWrapRefs: ReadonlyArray<RefObject<HTMLElement | null>>
  /** Desktop persistent player embed host (app-root). Pauses/binds with inline SC widgets. */
  persistentScWrapRef?: RefObject<HTMLElement | null>
  /** When false, listeners and widget bindings are not installed. */
  enabled: boolean
  /** Bumps the effect when featured media URLs change (iframe nodes / lazy timing). */
  syncKey: string
  /** Optional imperative handle for parent-driven pause (facade tap before iframe exists). */
  controlsRef?: MutableRefObject<ExclusiveYoutubeSoundcloudControls | null>
}

/**
 * When a YouTube featured embed and one or more SoundCloud widgets share a page,
 * ensures only one plays at a time (SoundCloud `PLAY` vs YouTube `onStateChange`), and SoundCloud
 * widgets pause each other (R16 cacophony-proof, extended for multiple SC regions + desktop persistent player).
 *
 * Cross-origin iframe clicks do not bubble to the parent, so exclusivity is driven by
 * player APIs / `postMessage`, not wrapper click handlers.
 */
export function useExclusiveYoutubeSoundcloudPlayback({
  youtubeIframeRef,
  soundcloudWrapRefs,
  persistentScWrapRef,
  enabled,
  syncKey,
  controlsRef,
}: ExclusiveYoutubeSoundcloudOptions): void {
  const scBindSerialRef = useRef(0)
  const soundcloudWrapRefsRef = useRef(soundcloudWrapRefs)
  const persistentScWrapRefRef = useRef(persistentScWrapRef)
  useEffect(() => {
    soundcloudWrapRefsRef.current = soundcloudWrapRefs
  }, [soundcloudWrapRefs])
  useEffect(() => {
    persistentScWrapRefRef.current = persistentScWrapRef
  }, [persistentScWrapRef])

  useEffect(() => {
    if (!enabled) {
      if (controlsRef) controlsRef.current = null
      return
    }

    const wraps = (): ReadonlyArray<RefObject<HTMLElement | null>> => {
      const base = soundcloudWrapRefsRef.current
      const persistent = persistentScWrapRefRef.current
      if (!persistent) return base
      return [...base, persistent]
    }

    let stabilizeSeq = 0

    const pauseSoundcloudWidgetsExcept = (
      excludeIframe: HTMLIFrameElement | null,
      preserveViewport: boolean,
    ) => {
      stabilizeSeq += 1
      const seq = stabilizeSeq
      pauseSoundcloudIframesExcept(
        iframesFromSoundcloudWraps(wraps()),
        excludeIframe,
        preserveViewport,
        () => seq !== stabilizeSeq,
      )
    }

    const pauseAllSoundcloud = () => pauseSoundcloudWidgetsExcept(null, true)
    if (controlsRef) controlsRef.current = { pauseAllSoundcloud }

    const onWindowMessage = (event: MessageEvent) => {
      if (!messageIndicatesYoutubePlaying(event)) return
      pauseAllSoundcloud()
    }
    window.addEventListener('message', onWindowMessage)

    const onYtLoad = () => postMessageYoutubeListeningHandshake(youtubeIframeRef.current)

    let ytLoadCleanup: (() => void) | null = null

    const attachYtHandshake = (): void => {
      ytLoadCleanup?.()
      ytLoadCleanup = null
      const el = youtubeIframeRef.current
      if (!el) return
      el.addEventListener('load', onYtLoad)
      queueMicrotask(onYtLoad)
      ytLoadCleanup = () => el.removeEventListener('load', onYtLoad)
    }

    attachYtHandshake()
    /** Facade embeds mount the iframe only after tap — poll until the ref exists. */
    const ytPollId = window.setInterval(attachYtHandshake, 250)

    let cancelled = false
    const scCleanups: Array<() => void> = []

    const tryBindAllSoundcloud = () => {
      if (cancelled) return
      for (const c of scCleanups) {
        try {
          c()
        } catch {
          /* ignore */
        }
      }
      scCleanups.length = 0

      scBindSerialRef.current += 1
      const serial = scBindSerialRef.current

      const iframes = iframesFromSoundcloudWraps(wraps())
      if (!iframes.length) return

      void loadSoundCloudWidgetApi()
        .then((SC) => {
          if (cancelled || serial !== scBindSerialRef.current) return

          for (const iframe of iframes) {
            if (!document.body.contains(iframe)) continue

            const widget: SoundCloudWidget = SC.Widget(iframe)

            const onPlay = () => {
              postMessagePauseYoutubeEmbed(youtubeIframeRef.current)
              pauseSoundcloudWidgetsExcept(iframe, false)
            }

            const onReady = () => {
              widget.bind(SC.Widget.Events.PLAY, onPlay)
            }

            widget.bind(SC.Widget.Events.READY, onReady)

            scCleanups.push(() => {
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
            })
          }
        })
        .catch(() => {
          // Widget API unavailable — embeds still work, exclusivity degrades gracefully.
        })
    }

    const mos: MutationObserver[] = []
    const observedWraps = new WeakSet<HTMLElement>()

    const attachSoundcloudWrapObservers = () => {
      for (const wrapRef of wraps()) {
        const wrap = wrapRef.current
        if (!wrap || observedWraps.has(wrap)) continue
        observedWraps.add(wrap)
        const mo = new MutationObserver(() => tryBindAllSoundcloud())
        mo.observe(wrap, { childList: true, subtree: true })
        mos.push(mo)
      }
    }

    attachSoundcloudWrapObservers()
    tryBindAllSoundcloud()
    const scRetryIds = [400, 1200, 2000, 3200].map((ms) => window.setTimeout(tryBindAllSoundcloud, ms))
    /** Persistent shell mounts after page children — poll until embed host exists. */
    const persistentWrapPollId = window.setInterval(() => {
      attachSoundcloudWrapObservers()
      tryBindAllSoundcloud()
    }, 250)

    return () => {
      cancelled = true
      if (controlsRef) controlsRef.current = null
      window.removeEventListener('message', onWindowMessage)
      ytLoadCleanup?.()
      window.clearInterval(ytPollId)
      window.clearInterval(persistentWrapPollId)
      for (const id of scRetryIds) window.clearTimeout(id)
      for (const m of mos) m.disconnect()
      for (const c of scCleanups) {
        try {
          c()
        } catch {
          /* ignore */
        }
      }
      scCleanups.length = 0
    }
  }, [enabled, syncKey, youtubeIframeRef, controlsRef])
}
