import type { CSSProperties, RefObject } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { coverImageUrl } from '../seo/imageUrl'
import {
  youtubePosterThumbnailUrl,
  youtubePrivacyEmbedSrc,
  youtubeWatchPageUrl,
} from './youtubeEmbedUrl'
import { CatalogMediaOutbound } from './CatalogMediaOutbound'

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
  /** Runs on facade tap before the iframe mounts (pause competing SoundCloud, etc.). */
  onBeforePlay?: () => void
  /** Runs when the embed iframe finishes loading (YouTube JS API handshake). */
  onIframeLoad?: () => void
  /** Fires when the GO gate releases the iframe (true) or the video remounts (false). */
  onPlayingChange?: (playing: boolean) => void
  /** For above-the-fold heroes: eager poster + high fetch priority while facade is visible. */
  facadePosterEager?: boolean
  /** Poster transformation width for the facade image. */
  posterWidth?: number
  /** When false, omit the default outbound link (parent places it below copy). Default true. */
  showOutboundFooter?: boolean
}

const YT_IFRAME_ALLOW =
  'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share'

/** True only after hydration — keeps `<iframe src="youtube…">` out of R24 static HTML / SSR output. */
function useClientMounted(): boolean {
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    const id = window.setTimeout(() => setMounted(true), 0)
    return () => window.clearTimeout(id)
  }, [])
  return mounted
}

/**
 * Fallback when YouTube&apos;s embed misbehaves — same upload on youtube.com.
 */
export function YoutubeEmbedOutboundFooter({ videoId }: { videoId: string }) {
  const href = youtubeWatchPageUrl(videoId)
  if (!href) return null
  return <CatalogMediaOutbound href={href} />
}

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
  onBeforePlay,
  onIframeLoad,
  onPlayingChange,
  facadePosterEager = false,
  posterWidth = 400,
  showOutboundFooter = true,
}: YoutubeEmbeddedPlayerProps) {
  const id = videoId.trim()
  const clientMounted = useClientMounted()
  const [facadeReleased, setFacadeReleased] = useState(false)
  const [iframeReady, setIframeReady] = useState(false)
  const showFacade = Boolean(facadeUntilClick && id && !facadeReleased)

  useEffect(() => {
    setIframeReady(false)
  }, [id, facadeReleased])

  useEffect(() => {
    onPlayingChange?.(facadeReleased)
  }, [facadeReleased, onPlayingChange])

  const iframeSrc = useMemo(() => {
    if (!id || showFacade) return ''
    return youtubePrivacyEmbedSrc(id, {
      enableJsApi,
      autoplay: facadeUntilClick && facadeReleased,
    })
  }, [id, enableJsApi, facadeUntilClick, facadeReleased, showFacade])

  if (!id) return null
  const iframeClass = ['yt-embed-frame', iframeClassName].filter(Boolean).join(' ')
  const poster = coverImageUrl(youtubePosterThumbnailUrl(id), { width: posterWidth })

  const outbound = showOutboundFooter ? <YoutubeEmbedOutboundFooter videoId={id} /> : null

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
                loading={facadePosterEager ? 'eager' : 'lazy'}
                fetchPriority={facadePosterEager ? 'high' : undefined}
              />
            ) : null}
          </div>
        </div>
        {outbound}
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
            onClick={() => {
              onBeforePlay?.()
              setFacadeReleased(true)
            }}
          >
            {poster ? (
              <img
                src={poster}
                alt=""
                className="yt-embed-facade__poster"
                decoding="async"
                loading={facadePosterEager ? 'eager' : 'lazy'}
                fetchPriority={facadePosterEager ? 'high' : undefined}
              />
            ) : null}
            <span className="yt-embed-facade__ring" aria-hidden>
              <span className="yt-embed-facade__glyph">▶</span>
            </span>
          </button>
        ) : (
          <div className="yt-embed-frame-host">
            {!iframeReady && poster ? (
              <img
                src={poster}
                alt=""
                className="yt-embed-frame-host__poster"
                decoding="async"
                aria-hidden
              />
            ) : null}
            <iframe
              ref={iframeRef}
              key={`${id}-${facadeReleased ? 'on' : 'off'}`}
              className={`${iframeClass}${iframeReady ? ' yt-embed-frame--ready' : ''}`}
              title={title}
              src={iframeSrc}
              loading={loading}
              allow={YT_IFRAME_ALLOW}
              allowFullScreen
              onLoad={() => {
                setIframeReady(true)
                onIframeLoad?.()
              }}
            />
          </div>
        )}
      </div>
      {outbound}
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
