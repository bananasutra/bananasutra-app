import { coverImageUrl } from '../seo/imageUrl'
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
  const poster = video.thumbnail_url
    ? coverImageUrl(video.thumbnail_url, { width: 480 })
    : null

  return (
    <button
      type="button"
      className={`watch-lp__video-pick${isActive ? ' is-active' : ''}`}
      aria-pressed={isActive}
      aria-label={`${title}${isActive ? ' (now showing)' : ''}`}
      onClick={onSelect}
    >
      <span className="watch-lp__video-pick-frame">
        {poster ? (
          <img className="watch-lp__video-pick-img" src={poster} alt="" loading="lazy" decoding="async" />
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
