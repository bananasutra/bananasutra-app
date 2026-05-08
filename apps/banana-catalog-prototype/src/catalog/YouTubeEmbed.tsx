import { youtubePrivacyEmbedSrc } from './youtubeEmbedUrl'

type Props = {
  videoId: string
  title?: string
}

/**
 * Privacy-oriented embed host. Requires `videoId` only (from reconciled pipeline).
 */
export function YouTubeEmbed({ videoId, title = 'YouTube video' }: Props) {
  const id = videoId.trim()
  if (!id) return null
  const src = youtubePrivacyEmbedSrc(id)
  return (
    <div className="yt-embed-shell">
      <iframe
        key={id}
        className="yt-embed-frame"
        title={title}
        src={src}
        loading="eager"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
      />
    </div>
  )
}
