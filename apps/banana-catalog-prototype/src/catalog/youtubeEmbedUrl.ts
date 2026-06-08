/** Poster image for click-to-load facade (official CDN). */
export function youtubePosterThumbnailUrl(videoId: string): string {
  const id = videoId.trim()
  if (!id) return ''
  return `https://i.ytimg.com/vi/${encodeURIComponent(id)}/hqdefault.jpg`
}

/** Canonical watch URL for this upload (same video as the embed). */
export function youtubeWatchPageUrl(videoId: string): string {
  const id = videoId.trim()
  if (!id) return ''
  return `https://www.youtube.com/watch?v=${encodeURIComponent(id)}`
}

export type YoutubePrivacyEmbedOptions = {
  /**
   * Adds `enablejsapi=1` (+ `origin` in the browser) so the parent can receive
   * `postMessage` playback events and send `pauseVideo` — used with SoundCloud
   * exclusivity on sutra / songbook pages.
   */
  enableJsApi?: boolean
  /**
   * Start playback as soon as the embed iframe loads. Only pass after an explicit viewer action
   * (e.g. facade tap)—not ambient page autoplay. Bridges parent gesture → iframe (separate context).
   */
  autoplay?: boolean
}

/** Origins used by catalog embeds + SoundCloud exclusivity `postMessage` targets. */
export const YOUTUBE_EMBED_POST_MESSAGE_ORIGINS = ['https://www.youtube.com', 'https://www.youtube-nocookie.com'] as const

/**
 * Standard YouTube iframe embed (`www.youtube.com`).
 *
 * Note: We intentionally avoid `youtube-nocookie.com` here — it tends to interact badly with
 * Google’s embedded sign-in / bot interstitials (broken flows inside iframes).
 *
 * `rel=0` limits post-play suggestions to the same channel where supported;
 * YouTube does not expose a supported way to remove all recommendations inside the
 * standard embed player.
 */
export function youtubePrivacyEmbedSrc(videoId: string, options?: YoutubePrivacyEmbedOptions): string {
  const id = videoId.trim()
  if (!id) return ''
  const q = new URLSearchParams({
    rel: '0',
    modestbranding: '1',
    iv_load_policy: '3',
    playsinline: '1',
  })
  if (options?.enableJsApi) {
    q.set('enablejsapi', '1')
    if (typeof window !== 'undefined' && window.location?.origin) {
      q.set('origin', window.location.origin)
    }
  }
  if (options?.autoplay) q.set('autoplay', '1')
  return `https://www.youtube.com/embed/${encodeURIComponent(id)}?${q}`
}

/** Standard YouTube playlist iframe embed (`videoseries?list=`). */
export function youtubePlaylistEmbedSrc(playlistId: string, options?: Pick<YoutubePrivacyEmbedOptions, 'autoplay'>): string {
  const id = playlistId.trim()
  if (!id) return ''
  const q = new URLSearchParams({
    list: id,
    rel: '0',
    modestbranding: '1',
    iv_load_policy: '3',
    playsinline: '1',
  })
  if (options?.autoplay) q.set('autoplay', '1')
  return `https://www.youtube.com/embed/videoseries?${q}`
}
