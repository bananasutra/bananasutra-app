import { YOUTUBE_EMBED_POST_MESSAGE_ORIGINS } from './youtubeEmbedUrl'

/** Pause a YouTube embed iframe via postMessage (works across origins). */
export function pauseYoutubeEmbed(iframe: HTMLIFrameElement | null): void {
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

/** Pause every YouTube embed iframe on the page except `except`. */
export function pauseAllYoutubeEmbedsExcept(except: HTMLIFrameElement | null): void {
  document.querySelectorAll<HTMLIFrameElement>('iframe.yt-embed-frame').forEach((el) => {
    if (el !== except) pauseYoutubeEmbed(el)
  })
}
