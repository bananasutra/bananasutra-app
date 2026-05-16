import type { CSSProperties, RefObject } from 'react'
import { useMemo, useState } from 'react'
import {
  youtubePosterThumbnailUrl,
  youtubePrivacyEmbedSrc,
  youtubeWatchPageUrl,
} from './youtubeEmbedUrl'

type SongDetailProps = {
  videoId: string
  title?: string
}

export type YoutubeEmbeddedPlayerProps = {
  videoId: string
  title: string
  enableJsApi?: boolean
  iframeRef?: RefObject<HTMLIFrameElement | null>
  /** Appended after `yt-embed-frame` for page-specific sizing (featured layouts, sutra detail). */
  iframeClassName?: string
  /** Wrapper around the iframe (usually `position: relative` + aspect ratio). Defaults to `yt-embed-shell`. */
  embedWrapperClassName?: string
  embedWrapperStyle?: CSSProperties
  loading?: 'lazy' | 'eager'
  fallbackClassName?: string
  /**
   * Featured heroes only: poster + click mounts the iframe (cuts passive embed churn).
   * Song detail keeps immediate load — opening the Video tab / section is already intent.
   */
  facadeUntilClick?: boolean
}

const YT_IFRAME_ALLOW =
  'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share'

/**
 * Secondary action below embeds: Google often shows “sign in” inside the iframe, then redirects to pages
 * that cannot be framed (`support.google.com refused to connect`). Watching on youtube.com avoids that trap.
 */
export function YoutubeWatchFallback({ videoId, className }: { videoId: string; className?: string }) {
  const href = youtubeWatchPageUrl(videoId)
  if (!href) return null
  return (
    <p className={['yt-watch-fallback', className].filter(Boolean).join(' ')}>
      <a href={href} target="_blank" rel="noopener noreferrer" className="yt-watch-fallback__link">
        Open on YouTube
      </a>
      <span className="yt-watch-fallback__hint">
        {' '}
        — use this if YouTube asks you to sign in; that verification cannot finish inside an embedded player.
      </span>
    </p>
  )
}

/**
 * Single iframe implementation for the catalog: always pairs the player with {@link YoutubeWatchFallback}
 * so no surface can ship a naked embed again.
 */
export function YoutubeEmbeddedPlayer({
  videoId,
  title,
  enableJsApi,
  iframeRef,
  iframeClassName,
  embedWrapperClassName = 'yt-embed-shell',
  embedWrapperStyle,
  loading = 'lazy',
  fallbackClassName,
  facadeUntilClick = false,
}: YoutubeEmbeddedPlayerProps) {
  const id = videoId.trim()
  const [facadeReleased, setFacadeReleased] = useState(false)
  const showFacade = Boolean(facadeUntilClick && id && !facadeReleased)

  const iframeSrc = useMemo(() => {
    if (!id || showFacade) return ''
    return youtubePrivacyEmbedSrc(id, {
      enableJsApi,
      autoplay: facadeUntilClick && facadeReleased,
    })
  }, [id, enableJsApi, facadeUntilClick, facadeReleased, showFacade])

  if (!id) return null
  const iframeClass = ['yt-embed-frame', iframeClassName].filter(Boolean).join(' ')
  const poster = youtubePosterThumbnailUrl(id)

  return (
    <div className="yt-embed-with-fallback">
      <div className={embedWrapperClassName} style={embedWrapperStyle}>
        {showFacade ? (
          <button
            type="button"
            className="yt-embed-facade"
            aria-label={`Load embedded player: ${title}`}
            onClick={() => setFacadeReleased(true)}
          >
            {poster ? (
              <img src={poster} alt="" className="yt-embed-facade__poster" decoding="async" loading="lazy" />
            ) : null}
            <span className="yt-embed-facade__ring" aria-hidden>
              <span className="yt-embed-facade__glyph">▶</span>
            </span>
          </button>
        ) : (
          <iframe
            ref={iframeRef}
            key={`${id}-${facadeReleased ? 'on' : 'off'}`}
            className={iframeClass}
            title={title}
            src={iframeSrc}
            loading={loading}
            allow={YT_IFRAME_ALLOW}
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        )}
      </div>
      <YoutubeWatchFallback videoId={id} className={fallbackClassName} />
    </div>
  )
}

/**
 * Default song-detail layout (immediate iframe + eager decode).
 */
export function YouTubeEmbed({ videoId, title = 'YouTube video' }: SongDetailProps) {
  const id = videoId.trim()
  if (!id) return null
  return <YoutubeEmbeddedPlayer videoId={id} title={title} loading="eager" />
}
