import { useEffect, useMemo, useState, type RefObject } from 'react'
import { Link } from 'react-router-dom'
import { coverImageUrl } from '../seo/imageUrl'
import type { YouTubePlaylistCatalogItem } from './types'
import { songbookCatalogPath } from './songPaths'
import {
  watchLpPlaylistEmbedDescription,
  watchLpPlaylistMetaLine,
  watchLpPlaylistThumbLabel,
} from './watchLpData'
import { youtubePlaylistEmbedSrc } from './youtubeEmbedUrl'
import { CatalogFeaturedEmbedCopy } from './CatalogFeaturedEmbedCopy'
import './catalog-page-shell.css'
import './CatalogVideoSpotlight.css'
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
  /** Fires when the GO gate releases the iframe (true) or playlist remounts (false). */
  onPlayingChange?: (playing: boolean) => void
  /** When set, genre playlists can deep-link to the matching `/songbooks/:slug` page. */
  songbookSlug?: string | null
  /** Strip outer spotlight card border (watch LP sections use borderless stack). */
  borderless?: boolean
}

function WatchLpPlaylistEmbedInner({
  playlist,
  durationByName,
  iframeRef,
  onBeforePlay,
  onPlayingChange,
  songbookSlug,
  borderless = false,
}: {
  playlist: YouTubePlaylistCatalogItem
  durationByName?: Map<string, number>
  iframeRef?: RefObject<HTMLIFrameElement | null>
  onBeforePlay?: () => void
  onPlayingChange?: (playing: boolean) => void
  songbookSlug?: string | null
  borderless?: boolean
}) {
  const clientMounted = useClientMounted()
  const [facadeReleased, setFacadeReleased] = useState(false)
  const playlistId = (playlist.playlist_id || '').trim()

  useEffect(() => {
    onPlayingChange?.(facadeReleased)
  }, [facadeReleased, onPlayingChange])

  const iframeSrc = useMemo(() => {
    if (!playlistId || !facadeReleased) return ''
    return youtubePlaylistEmbedSrc(playlistId, { autoplay: true, enableJsApi: true })
  }, [playlistId, facadeReleased])

  const title = playlist.playlist_name.trim() || 'YouTube playlist'
  const displayTitle = watchLpPlaylistThumbLabel(playlist) || title
  const description = watchLpPlaylistEmbedDescription(playlist)
  const poster = playlist.thumbnail_url ? coverImageUrl(playlist.thumbnail_url, { width: 640 }) : null
  const ytHref = (playlist.playlist_url || '').trim()

  const shellClass = [
    'catalog-video-spotlight',
    borderless ? 'catalog-video-spotlight--borderless' : '',
    'watch-lp__playlist-embed',
    facadeReleased ? 'is-playing' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={shellClass} aria-live="polite">
      <article className="catalog-video-spotlight__hero">
        <div className="catalog-video-spotlight__embed" style={{ aspectRatio: '16 / 9' }}>
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
              className="watch-lp__playlist-embed-iframe yt-embed-frame catalog-video-spotlight__iframe"
              title={title}
              src={iframeSrc}
              loading="lazy"
              allow={YT_IFRAME_ALLOW}
              allowFullScreen
            />
          )}
        </div>
        <CatalogFeaturedEmbedCopy
          detailBand
          title={displayTitle}
          meta={watchLpPlaylistMetaLine(playlist, durationByName)}
          description={description}
          outboundHref={ytHref || null}
        >
          {songbookSlug ? (
            <Link className="catalog-featured-embed-copy__cta" to={songbookCatalogPath(songbookSlug)}>
              View songbook →
            </Link>
          ) : null}
        </CatalogFeaturedEmbedCopy>
      </article>
    </div>
  )
}

export function WatchLpPlaylistEmbed({
  playlist,
  durationByName,
  iframeRef,
  onBeforePlay,
  onPlayingChange,
  songbookSlug,
  borderless = false,
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
      onPlayingChange={onPlayingChange}
      songbookSlug={songbookSlug}
      borderless={borderless}
    />
  )
}
