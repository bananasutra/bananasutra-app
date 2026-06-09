import { useEffect, useMemo, useState, type RefObject } from 'react'
import { Link } from 'react-router-dom'
import { coverImageUrl } from '../seo/imageUrl'
import type { YouTubePlaylistCatalogItem } from './types'
import { songbookCatalogPath } from './songPaths'
import { watchLpPlaylistMetaLine } from './watchLpData'
import { youtubePlaylistEmbedSrc } from './youtubeEmbedUrl'
import { CatalogMediaOutbound } from './CatalogMediaOutbound'
import './WatchLpPlaylistEmbed.css'

const YT_IFRAME_ALLOW =
  'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share'

function useClientMounted(): boolean {
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    const id = window.setTimeout(() => setMounted(true), 0)
    return () => window.clearTimeout(id)
  }, [])
  return mounted
}

type Props = {
  playlist: YouTubePlaylistCatalogItem | null
  durationByName?: Map<string, number>
  iframeRef?: RefObject<HTMLIFrameElement | null>
  onBeforePlay?: () => void
  /** When set, genre playlists can deep-link to the matching `/songbooks/:slug` page. */
  songbookSlug?: string | null
}

function WatchLpPlaylistEmbedInner({
  playlist,
  durationByName,
  iframeRef,
  onBeforePlay,
  songbookSlug,
}: {
  playlist: YouTubePlaylistCatalogItem
  durationByName?: Map<string, number>
  iframeRef?: RefObject<HTMLIFrameElement | null>
  onBeforePlay?: () => void
  songbookSlug?: string | null
}) {
  const clientMounted = useClientMounted()
  const [facadeReleased, setFacadeReleased] = useState(false)
  const playlistId = (playlist.playlist_id || '').trim()

  const iframeSrc = useMemo(() => {
    if (!playlistId || !facadeReleased) return ''
    return youtubePlaylistEmbedSrc(playlistId, { autoplay: true })
  }, [playlistId, facadeReleased])

  const title = playlist.playlist_name.trim() || 'YouTube playlist'
  const poster = playlist.thumbnail_url ? coverImageUrl(playlist.thumbnail_url, { width: 640 }) : null
  const ytHref = (playlist.playlist_url || '').trim()

  return (
    <div className={`watch-lp__playlist-embed${facadeReleased ? ' is-playing' : ''}`} aria-live="polite">
      <div className="watch-lp__playlist-embed-layout">
        <div className="watch-lp__playlist-embed-shell" style={{ aspectRatio: '16 / 9' }}>
          {!clientMounted ? (
            <div className="watch-lp__playlist-embed-placeholder" role="status" aria-label={`Loading playlist: ${title}`}>
              {poster ? <img src={poster} alt="" className="watch-lp__playlist-embed-poster" decoding="async" /> : null}
            </div>
          ) : !facadeReleased ? (
            <button
              type="button"
              className="watch-lp__playlist-embed-facade"
              aria-label={`Load playlist player: ${title}`}
              onClick={() => {
                onBeforePlay?.()
                setFacadeReleased(true)
              }}
            >
              {poster ? (
                <img src={poster} alt="" className="watch-lp__playlist-embed-poster" decoding="async" loading="lazy" />
              ) : null}
              <span className="watch-lp__playlist-embed-play" aria-hidden>
                ▶
              </span>
              <span className="watch-lp__playlist-embed-overlay">
                <span className="watch-lp__playlist-embed-overlay-title">{title}</span>
                <span className="watch-lp__playlist-embed-overlay-meta">
                  {watchLpPlaylistMetaLine(playlist, durationByName)}
                </span>
              </span>
            </button>
          ) : (
            <iframe
              key={playlistId}
              ref={iframeRef}
              className="watch-lp__playlist-embed-iframe yt-embed-frame"
              title={title}
              src={iframeSrc}
              loading="lazy"
              allow={YT_IFRAME_ALLOW}
              allowFullScreen
            />
          )}
        </div>
        {ytHref || songbookSlug ? (
          <div className="watch-lp__playlist-embed-actions">
            {songbookSlug ? (
              <Link className="watch-lp__playlist-embed-songbook-link" to={songbookCatalogPath(songbookSlug)}>
                View songbook →
              </Link>
            ) : null}
            {ytHref ? <CatalogMediaOutbound href={ytHref} /> : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}

export function WatchLpPlaylistEmbed({
  playlist,
  durationByName,
  iframeRef,
  onBeforePlay,
  songbookSlug,
}: Props) {
  if (!playlist) {
    return <p className="watch-lp__playlist-embed-empty">No playlists match this filter.</p>
  }

  const playlistId = (playlist.playlist_id || '').trim()
  return (
    <WatchLpPlaylistEmbedInner
      key={playlistId}
      playlist={playlist}
      durationByName={durationByName}
      iframeRef={iframeRef}
      onBeforePlay={onBeforePlay}
      songbookSlug={songbookSlug}
    />
  )
}
