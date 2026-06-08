import { useEffect } from 'react'
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

/**
 * When multiple YouTube embeds share a page (e.g. /watch spotlight + playlist),
 * pause every other iframe when one starts playing.
 */
export function useExclusiveYoutubeEmbedsPlayback(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return

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
    }

    window.addEventListener('message', onWindowMessage)
    return () => window.removeEventListener('message', onWindowMessage)
  }, [enabled])
}
