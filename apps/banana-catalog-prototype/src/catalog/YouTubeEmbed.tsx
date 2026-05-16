import type { CSSProperties, RefObject } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { youtubePosterThumbnailUrl, youtubePrivacyEmbedSrc } from './youtubeEmbedUrl'

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
  /**
   * Poster + tap mounts the iframe (gesture‑gated). Used everywhere YouTube loads — reduces passive embed
   * probes (logged‑out / incognito) vs autoplaying an iframe as soon as the shell hydrates.
   */
  facadeUntilClick?: boolean
}

const YT_IFRAME_ALLOW =
  'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share'

/** True only after hydration — keeps `<iframe src="youtube…">` out of R24 static HTML / SSR output. */
function useClientMounted(): boolean {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  return mounted
}

/** YouTube iframe only — no outbound footer (matches pre–SEO-phase-3 chrome). */
export function YoutubeEmbeddedPlayer({
  videoId,
  title,
  enableJsApi,
  iframeRef,
  iframeClassName,
  embedWrapperClassName = 'yt-embed-shell',
  embedWrapperStyle,
  loading = 'lazy',
  facadeUntilClick = false,
}: YoutubeEmbeddedPlayerProps) {
  const id = videoId.trim()
  const clientMounted = useClientMounted()
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

  if (!clientMounted) {
    return (
      <div className="yt-embed-root">
        <div className={embedWrapperClassName} style={embedWrapperStyle}>
          <div
            className="yt-embed-client-placeholder"
            role="status"
            aria-live="polite"
            aria-label={`Loading video player: ${title}`}
          >
            {poster ? (
              <img
                src={poster}
                alt=""
                className="yt-embed-client-placeholder__poster"
                decoding="async"
                loading="lazy"
              />
            ) : null}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="yt-embed-root">
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
          />
        )}
      </div>
    </div>
  )
}

/**
 * Song detail: click‑to‑load embed (same gesture gate as heroes), eager iframe decode once mounted.
 */
export function YouTubeEmbed({ videoId, title = 'YouTube video' }: SongDetailProps) {
  const id = videoId.trim()
  if (!id) return null
  return <YoutubeEmbeddedPlayer videoId={id} title={title} loading="eager" facadeUntilClick />
}
