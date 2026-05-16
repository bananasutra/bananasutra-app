import { useEffect, useRef, type RefObject } from 'react'
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
 * SoundCloud’s `Widget.pause()` / internal focus can scroll the playlist iframe into view.
 * When the embed sits above the YouTube block (songbook layout), that feels like an unwanted “jump back up”.
 *
 * We only correct when the viewport actually drifts, and we avoid a burst of `scrollTo` calls — those fight
 * YouTube’s own layout and read as a brief “jitter” on the video.
 */
const VIEWPORT_DRIFT_PX = 2

function restoreViewportScroll(left: number, top: number): void {
  try {
    window.scrollTo({ left, top, behavior: 'instant' })
  } catch {
    window.scrollTo(left, top)
  }
}

function viewportDrifted(left: number, top: number): boolean {
  return Math.abs(window.scrollX - left) > VIEWPORT_DRIFT_PX || Math.abs(window.scrollY - top) > VIEWPORT_DRIFT_PX
}

/** Restore scroll only if SoundCloud (or the browser) moved the page — skips redundant scrollTo. */
function patchViewportScrollIfDrifted(left: number, top: number): void {
  if (!viewportDrifted(left, top)) return
  restoreViewportScroll(left, top)
}

/**
 * Deferred scroll correction; `capturedSeq` must match live `stabilizeSeq` or the work is dropped so
 * stacked handlers from rapid YouTube `postMessage` bursts do not fight each other.
 */
function scheduleLightViewportScrollPatch(left: number, top: number, capturedSeq: number, getSeq: () => number): void {
  const run = () => {
    if (capturedSeq !== getSeq()) return
    patchViewportScrollIfDrifted(left, top)
  }
  queueMicrotask(run)
  requestAnimationFrame(() => {
    run()
    requestAnimationFrame(run)
  })
  window.setTimeout(run, 180)
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

export type ExclusiveYoutubeSoundcloudOptions = {
  youtubeIframeRef: RefObject<HTMLIFrameElement | null>
  /** Ancestors of each `.sc-embed-frame` iframe (e.g. featured EP wrap + lazy spotlight wrap). */
  soundcloudWrapRefs: ReadonlyArray<RefObject<HTMLElement | null>>
  /** When false, listeners and widget bindings are not installed. */
  enabled: boolean
  /** Bumps the effect when featured media URLs change (iframe nodes / lazy timing). */
  syncKey: string
}

/**
 * When a YouTube featured embed and one or more SoundCloud widgets share a page,
 * ensures only one plays at a time (SoundCloud `PLAY` vs YouTube `onStateChange`), and SoundCloud
 * widgets pause each other (R16 cacophony-proof, extended for multiple SC regions).
 *
 * Cross-origin iframe clicks do not bubble to the parent, so exclusivity is driven by
 * player APIs / `postMessage`, not wrapper click handlers.
 */
export function useExclusiveYoutubeSoundcloudPlayback({
  youtubeIframeRef,
  soundcloudWrapRefs,
  enabled,
  syncKey,
}: ExclusiveYoutubeSoundcloudOptions): void {
  const scBindSerialRef = useRef(0)

  useEffect(() => {
    if (!enabled) return

    /**
     * YouTube emits many `infoDelivery` / state messages in a short window. Each used to capture
     * `scrollX/Y` again after a partial jump, so restores targeted inconsistent coordinates — especially
     * on songbooks where the playlist sits above the video.
     */
    let scrollBurst: { left: number; top: number; until: number } | null = null
    let stabilizeSeq = 0

    const readFrozenScrollAnchor = (): { left: number; top: number } => {
      const now = performance.now()
      if (!scrollBurst || now > scrollBurst.until) {
        scrollBurst = { left: window.scrollX, top: window.scrollY, until: now + 800 }
      } else {
        scrollBurst.until = now + 800
      }
      return { left: scrollBurst.left, top: scrollBurst.top }
    }

    /** Pause every bound SoundCloud iframe except `excludeIframe` (omit arg to pause all). */
    const pauseSoundcloudWidgetsExcept = (excludeIframe: HTMLIFrameElement | null) => {
      stabilizeSeq += 1
      const seq = stabilizeSeq
      const { left, top } = readFrozenScrollAnchor()

      const targets = iframesFromSoundcloudWraps(soundcloudWrapRefs).filter((el) => el !== excludeIframe)
      if (!targets.length) {
        patchViewportScrollIfDrifted(left, top)
        return
      }

      patchViewportScrollIfDrifted(left, top)

      void loadSoundCloudWidgetApi()
        .then((SC) => {
          if (seq !== stabilizeSeq) return
          for (const iframe of targets) {
            if (!document.body.contains(iframe)) continue
            try {
              SC.Widget(iframe).pause()
            } catch {
              // ignore
            }
          }
          patchViewportScrollIfDrifted(left, top)
        })
        .catch(() => {
          // ignore
        })
        .finally(() => {
          if (seq !== stabilizeSeq) return
          scheduleLightViewportScrollPatch(left, top, seq, () => stabilizeSeq)
        })
    }

    const onWindowMessage = (event: MessageEvent) => {
      if (!messageIndicatesYoutubePlaying(event)) return
      pauseSoundcloudWidgetsExcept(null)
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

      const iframes = iframesFromSoundcloudWraps(soundcloudWrapRefs)
      if (!iframes.length) return

      void loadSoundCloudWidgetApi()
        .then((SC) => {
          if (cancelled || serial !== scBindSerialRef.current) return

          for (const iframe of iframes) {
            if (!document.body.contains(iframe)) continue

            const widget: SoundCloudWidget = SC.Widget(iframe)

            const onPlay = () => {
              postMessagePauseYoutubeEmbed(youtubeIframeRef.current)
              pauseSoundcloudWidgetsExcept(iframe)
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
    for (const wrapRef of soundcloudWrapRefs) {
      const wrap = wrapRef.current
      if (!wrap) continue
      const mo = new MutationObserver(() => tryBindAllSoundcloud())
      mo.observe(wrap, { childList: true, subtree: true })
      mos.push(mo)
    }
    tryBindAllSoundcloud()
    const scRetryId = window.setTimeout(tryBindAllSoundcloud, 600)

    return () => {
      cancelled = true
      window.removeEventListener('message', onWindowMessage)
      cleanupYt()
      window.clearTimeout(ytRetryId)
      window.clearTimeout(scRetryId)
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
  }, [enabled, syncKey, youtubeIframeRef, soundcloudWrapRefs])
}
