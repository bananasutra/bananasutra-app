export type YoutubePrivacyEmbedOptions = {
  /**
   * Adds `enablejsapi=1` (+ `origin` in the browser) so the parent can receive
   * `postMessage` playback events and send `pauseVideo` — used with SoundCloud
   * exclusivity on sutra / songbook pages.
   */
  enableJsApi?: boolean
}

/**
 * Privacy-oriented YouTube iframe URLs (youtube-nocookie).
 *
 * Note: `rel=0` limits post-play suggestions to the same channel where supported;
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
  return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?${q}`
}
