import type { RefObject, ReactNode } from 'react'
import { Link, type To } from 'react-router-dom'
import { ScrollRail } from './ScrollRail'
import { sutraClassName } from './sutraTheme'
import { formatDurationDisplay } from './durationFormat'
import { YoutubeEmbeddedPlayer } from './YouTubeEmbed'
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
          outboundFooterClassName="catalog-video-spotlight__yt-outbound"
          onBeforePlay={onBeforePlay}
        />
        <div className="catalog-video-spotlight__detail">
          <h3 className="catalog-video-spotlight__title">
            {featured.inApp && featured.songHref ? (
              <Link className="catalog-video-spotlight__title-link" to={featured.songHref}>
                {title}
              </Link>
            ) : featured.externalHref ? (
              <a
                className="catalog-video-spotlight__title-link"
                href={featured.externalHref}
                target="_blank"
                rel="noopener noreferrer"
              >
                {title}
              </a>
            ) : (
              title
            )}
          </h3>
          {metaParts.length ? (
            <p className="catalog-video-spotlight__meta">
              {featured.sutra ? (
                <span className={`catalog-sutra-word ${sutraClassName(featured.sutra)}`}>{featured.sutra}</span>
              ) : null}
              {durationLabel ? (
                <span>{featured.sutra ? ` · ${durationLabel}` : durationLabel}</span>
              ) : null}
            </p>
          ) : null}
          {featured.summary ? <p className="catalog-video-spotlight__summary">{featured.summary}</p> : null}
          {featured.songHref ? (
            <Link className="catalog-section-cta catalog-section-cta--inline" to={featured.songHref}>
              Song page →
            </Link>
          ) : null}
        </div>
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
