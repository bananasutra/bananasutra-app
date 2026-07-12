import { CoverImage } from './CoverImage'
import type { YouTubeCatalogVideo } from './types'
import { watchLpVideoMetaLine } from './watchLpData'

type Props = {
  video: YouTubeCatalogVideo
  inApp: boolean
  isActive: boolean
  onSelect: () => void
}

export function WatchLpVideoPickThumb({ video, inApp, isActive, onSelect }: Props) {
  const title = (video.lyrics_title || video.title || 'Video').trim()
  const hasThumb = Boolean((video.thumbnail_url || '').trim())

  return (
    <button
      type="button"
      className={`watch-lp__video-pick${isActive ? ' is-active' : ''}`}
      aria-pressed={isActive}
      aria-label={`${title}${isActive ? ' (now showing)' : ''}`}
      onClick={onSelect}
    >
      <span className="watch-lp__video-pick-frame">
        {hasThumb ? (
          <CoverImage
            source={video.thumbnail_url || ''}
            requestWidth={480}
            className="watch-lp__video-pick-img"
            alt=""
            loading="lazy"
            decoding="async"
          />
        ) : (
          <span className="watch-lp__video-pick-img watch-lp__video-pick-img--fallback" aria-hidden>
            ▶
          </span>
        )}
        <span className="watch-lp__video-pick-play" aria-hidden>
          ▶
        </span>
        {isActive ? <span className="watch-lp__video-pick-now">Now showing</span> : null}
        {!inApp ? <span className="watch-lp__video-pick-badge">YT-only</span> : null}
      </span>
      <span className="watch-lp__video-pick-title">{title}</span>
      <span className="watch-lp__video-pick-meta">{watchLpVideoMetaLine(video, inApp)}</span>
    </button>
  )
}
