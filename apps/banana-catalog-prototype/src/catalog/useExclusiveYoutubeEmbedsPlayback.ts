import { useEffect, useRef, type RefObject } from 'react'
import { loadSoundCloudWidgetApi, type SoundCloudWidget } from './soundcloudWidgetApi'
import { pauseSoundcloudWidgetsInWraps } from './useExclusiveYoutubeSoundcloudPlayback'
import { YOUTUBE_EMBED_POST_MESSAGE_ORIGINS } from './youtubeEmbedUrl'
import { pauseAllYoutubeEmbedsExcept } from './youtubeEmbedControl'

const YT_MESSAGE_ORIGINS = new Set<string>([...YOUTUBE_EMBED_POST_MESSAGE_ORIGINS])

const YT_PLAYER_STATE_PLAYING = 1
const YT_PLAYER_STATE_BUFFERING = 3

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

export type ExclusiveYoutubeEmbedsPlaybackOptions = {
  /** Desktop persistent player — pause when any page YouTube embed plays (W-029 /watch). */
  persistentScWrapRef?: RefObject<HTMLElement | null>
}

/**
 * When multiple YouTube embeds share a page (e.g. /watch spotlight + playlist),
 * pause every other iframe when one starts playing. Optionally pauses the app-root
 * persistent SoundCloud player and binds its PLAY to pause all YouTube embeds.
 */
export function useExclusiveYoutubeEmbedsPlayback(
  enabled: boolean,
  options: ExclusiveYoutubeEmbedsPlaybackOptions = {},
): void {
  const persistentScWrapRefRef = useRef(options.persistentScWrapRef)
  useEffect(() => {
    persistentScWrapRefRef.current = options.persistentScWrapRef
  }, [options.persistentScWrapRef])

  useEffect(() => {
    if (!enabled) return

    const persistentWraps = (): ReadonlyArray<RefObject<HTMLElement | null>> => {
      const persistent = persistentScWrapRefRef.current
      return persistent ? [persistent] : []
    }

    const pausePersistentSoundcloud = () => {
      const wraps = persistentWraps()
      if (wraps.length) pauseSoundcloudWidgetsInWraps(wraps)
    }

    const onWindowMessage = (event: MessageEvent) => {
      if (!messageIndicatesYoutubePlaying(event)) return
      const sourceWin = event.source
      let except: HTMLIFrameElement | null = null
      if (sourceWin && typeof sourceWin === 'object') {
        document.querySelectorAll<HTMLIFrameElement>('iframe.yt-embed-frame').forEach((iframe) => {
          if (iframe.contentWindow === sourceWin) except = iframe
        })
      }
      pauseAllYoutubeEmbedsExcept(except)
      pausePersistentSoundcloud()
    }

    window.addEventListener('message', onWindowMessage)

    let cancelled = false
    const scCleanups: Array<() => void> = []
    let bindSerial = 0

    const tryBindPersistentSoundcloud = () => {
      const persistent = persistentScWrapRefRef.current
      if (!persistent?.current || cancelled) return

      for (const c of scCleanups) {
        try {
          c()
        } catch {
          /* ignore */
        }
      }
      scCleanups.length = 0

      bindSerial += 1
      const serial = bindSerial

      const wrap = persistent.current
      const iframe = wrap.querySelector<HTMLIFrameElement>('iframe.sc-embed-frame')
      if (!iframe || !document.body.contains(iframe)) return

      void loadSoundCloudWidgetApi()
        .then((SC) => {
          if (cancelled || serial !== bindSerial) return

          const widget: SoundCloudWidget = SC.Widget(iframe)

          const onPlay = () => {
            pauseAllYoutubeEmbedsExcept(null)
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
        })
        .catch(() => {
          // Widget API unavailable — embeds still work, exclusivity degrades gracefully.
        })
    }

    const mos: MutationObserver[] = []
    const observedWraps = new WeakSet<HTMLElement>()

    const attachPersistentObservers = () => {
      const persistent = persistentScWrapRefRef.current
      const wrap = persistent?.current
      if (!wrap || observedWraps.has(wrap)) return
      observedWraps.add(wrap)
      const mo = new MutationObserver(() => tryBindPersistentSoundcloud())
      mo.observe(wrap, { childList: true, subtree: true })
      mos.push(mo)
    }

    attachPersistentObservers()
    tryBindPersistentSoundcloud()
    const scRetryIds = [400, 1200, 2000, 3200].map((ms) =>
      window.setTimeout(tryBindPersistentSoundcloud, ms),
    )
    const persistentWrapPollId = window.setInterval(() => {
      attachPersistentObservers()
      tryBindPersistentSoundcloud()
    }, 250)

    return () => {
      cancelled = true
      window.removeEventListener('message', onWindowMessage)
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
  }, [enabled])
}
