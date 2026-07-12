import type { RefObject, ReactNode } from 'react'
import { Link, type To } from 'react-router-dom'
import { ScrollRail } from './ScrollRail'
import { sutraClassName } from './sutraTheme'
import { formatDurationDisplay } from './durationFormat'
import { CatalogFeaturedEmbedCopy } from './CatalogFeaturedEmbedCopy'
import { YoutubeEmbeddedPlayer } from './YouTubeEmbed'
import { youtubeWatchPageUrl } from './youtubeEmbedUrl'
import './catalog-page-shell.css'
import './CatalogVideoSpotlight.css'

/** Always 16:9 shell; vertical uploads letterbox like song page video tab. */
export const CATALOG_VIDEO_SPOTLIGHT_ASPECT = '16 / 9' as const

export type CatalogVideoSpotlightItem = {
  videoId: string
  title: string
  summary?: string
  sutra?: string
  duration?: string
  inApp?: boolean
  songHref?: To | null
  externalHref?: string | null
  /** Catalog YT thumb URL (prefer over generic hq/maxres poster). */
  thumbnailUrl?: string | null
}

type RailCellProps = {
  video: CatalogVideoSpotlightItem
  isActive: boolean
  onSelect: () => void
  renderThumb?: (video: CatalogVideoSpotlightItem, isActive: boolean) => ReactNode
}

function DefaultRailCell({ video, isActive, onSelect }: RailCellProps) {
  return (
    <button
      type="button"
      className={`catalog-video-spotlight__pick${isActive ? ' is-active' : ''}`}
      aria-pressed={isActive}
      aria-label={`${video.title}${isActive ? ' (now showing)' : ''}`}
      onClick={onSelect}
    >
      <span className="catalog-video-spotlight__pick-title">{video.title}</span>
      {video.sutra || video.duration ? (
        <span className="catalog-video-spotlight__pick-meta">
          {[video.sutra, video.duration ? formatDurationDisplay(video.duration) : ''].filter(Boolean).join(' · ')}
        </span>
      ) : null}
    </button>
  )
}

type Props = {
  featured: CatalogVideoSpotlightItem | null
  rail: CatalogVideoSpotlightItem[]
  activeVideoId: string | null
  onSelectVideo: (videoId: string) => void
  /** Custom thumb cells (watch LP uses poster thumbs). */
  renderRailCell?: (video: CatalogVideoSpotlightItem, isActive: boolean, onSelect: () => void) => ReactNode
  iframeRef?: RefObject<HTMLIFrameElement | null>
  onBeforePlay?: () => void
  /** Fires when the GO gate releases the hero iframe (true) or the featured video remounts (false). */
  onPlayingChange?: (playing: boolean) => void
  railEyebrow?: string
  footer?: ReactNode
  className?: string
}

export function CatalogVideoSpotlight({
  featured,
  rail,
  activeVideoId,
  onSelectVideo,
  renderRailCell,
  iframeRef,
  onBeforePlay,
  onPlayingChange,
  railEyebrow = 'More clips',
  footer,
  className = '',
}: Props) {
  if (!featured) {
    return <p className="catalog-video-spotlight__empty">No videos in the catalog.</p>
  }

  const title = featured.title.trim() || 'Featured video'
  const durationLabel = formatDurationDisplay(featured.duration)
  const metaParts = [(featured.sutra || '').trim(), durationLabel].filter(Boolean)
  const youtubeOutboundHref =
    (featured.externalHref || '').trim() || youtubeWatchPageUrl(featured.videoId)

  return (
    <div className={['catalog-video-spotlight', className].filter(Boolean).join(' ')}>
      <article className="catalog-video-spotlight__hero">
        <YoutubeEmbeddedPlayer
          key={featured.videoId}
          videoId={featured.videoId}
          title={title}
          iframeRef={iframeRef}
          enableJsApi
          embedWrapperClassName="catalog-video-spotlight__embed"
          embedWrapperStyle={{ aspectRatio: CATALOG_VIDEO_SPOTLIGHT_ASPECT }}
          iframeClassName="catalog-video-spotlight__iframe"
          facadeUntilClick
          facadePosterEager
          posterWidth={640}
          posterThumbnailUrl={featured.thumbnailUrl}
          onBeforePlay={onBeforePlay}
          onPlayingChange={onPlayingChange}
          showOutboundFooter={false}
        />
        <CatalogFeaturedEmbedCopy
          detailBand
          title={
            featured.inApp && featured.songHref ? (
              <Link className="catalog-featured-embed-copy__title-link" to={featured.songHref}>
                {title}
              </Link>
            ) : featured.externalHref ? (
              <a
                className="catalog-featured-embed-copy__title-link"
                href={featured.externalHref}
                target="_blank"
                rel="noopener noreferrer"
              >
                {title}
              </a>
            ) : (
              title
            )
          }
          meta={
            metaParts.length ? (
              <>
                {featured.sutra ? (
                  <span className={`catalog-sutra-word ${sutraClassName(featured.sutra)}`}>{featured.sutra}</span>
                ) : null}
                {durationLabel ? (
                  <span>{featured.sutra ? ` · ${durationLabel}` : durationLabel}</span>
                ) : null}
              </>
            ) : undefined
          }
          description={featured.summary}
          outboundHref={youtubeOutboundHref}
        >
          {featured.songHref ? (
            <Link className="catalog-featured-embed-copy__cta" to={featured.songHref}>
              Open song page →
            </Link>
          ) : null}
        </CatalogFeaturedEmbedCopy>
      </article>

      {rail.length ? (
        <div className="catalog-video-spotlight__rail-wrap">
          <p className="catalog-video-spotlight__rail-eyebrow">{railEyebrow}</p>
          <ScrollRail className="catalog-video-spotlight__scroll-rail" variant="fade">
            <ul className="catalog-video-spotlight__rail" aria-label="Video picks">
              {rail.map((video) => (
                <li key={video.videoId} className="catalog-video-spotlight__rail-cell">
                  {renderRailCell ? (
                    renderRailCell(video, video.videoId === activeVideoId, () => onSelectVideo(video.videoId))
                  ) : (
                    <DefaultRailCell
                      video={video}
                      isActive={video.videoId === activeVideoId}
                      onSelect={() => onSelectVideo(video.videoId)}
                    />
                  )}
                </li>
              ))}
            </ul>
          </ScrollRail>
        </div>
      ) : null}

      {footer ? <div className="catalog-video-spotlight__footer">{footer}</div> : null}
    </div>
  )
}

export { formatDurationDisplay }
