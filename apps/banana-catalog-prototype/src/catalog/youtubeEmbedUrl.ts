/**
 * Privacy-oriented YouTube iframe URLs (youtube-nocookie).
 *
 * Note: `rel=0` limits post-play suggestions to the same channel where supported;
 * YouTube does not expose a supported way to remove all recommendations inside the
 * standard embed player.
 */
export function youtubePrivacyEmbedSrc(videoId: string): string {
  const id = videoId.trim()
  if (!id) return ''
  const q = new URLSearchParams({
    rel: '0',
    modestbranding: '1',
    iv_load_policy: '3',
    playsinline: '1',
  })
  return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?${q}`
}
