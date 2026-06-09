import { coverImageUrl } from '../seo/imageUrl'
import type { YouTubePlaylistCatalogItem } from './types'
import { watchLpPlaylistMetaLine, watchLpPlaylistThumbLabel } from './watchLpData'

type Props = {
  playlist: YouTubePlaylistCatalogItem
  durationByName?: Map<string, number>
  isActive: boolean
  onSelect: () => void
}

export function WatchLpPlaylistThumb({ playlist, durationByName, isActive, onSelect }: Props) {
  const label = watchLpPlaylistThumbLabel(playlist)
  const poster = playlist.thumbnail_url
    ? coverImageUrl(playlist.thumbnail_url, { width: 320 })
    : null

  return (
    <li className="watch-lp__playlist-grid-cell">
      <button
        type="button"
        className={`watch-lp__playlist-thumb${isActive ? ' is-active' : ''}`}
        aria-pressed={isActive}
        aria-label={`${playlist.playlist_name}${isActive ? ' (now playing)' : ''}`}
        onClick={onSelect}
      >
        {isActive ? <span className="watch-lp__playlist-thumb-now">Playing</span> : null}
        {poster ? (
          <span className="watch-lp__playlist-thumb-frame">
            <img src={poster} alt="" width={160} height={90} loading="lazy" decoding="async" />
          </span>
        ) : (
          <span className="watch-lp__playlist-thumb-frame watch-lp__playlist-thumb-frame--fallback" aria-hidden>
            ▶
          </span>
        )}
        <span className="watch-lp__playlist-thumb-title">{label}</span>
        <span className="watch-lp__playlist-thumb-meta">{watchLpPlaylistMetaLine(playlist, durationByName)}</span>
      </button>
    </li>
  )
}
