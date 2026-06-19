import { Link } from 'react-router-dom'
import type { HomeVideoTeaser as HomeVideoTeaserItem } from './homePortalData'
import { canonicalPathForRoute } from './seoPaths'

type Props = {
  videos: HomeVideoTeaserItem[]
}

/** Lightweight video presence; links to song video section, no inline player. */
export function HomeVideoTeaser({ videos }: Props) {
  if (!videos.length) return null

  return (
    <>
      <h2 id="home-video-teaser-heading" className="catalog-section-title">
        Picture the songs
      </h2>
      <p className="catalog-lp-section-intro">
        Same songs, visual format. Music films and YouTube playlists, organized by sutra and story.
      </p>
      <ul className="home-video-teaser">
        {videos.map((video) => (
          <li key={video.videoId}>
            <Link className="home-video-teaser__card" to={video.href} aria-label={`${video.title} · watch video`}>
              <span className="home-video-teaser__thumb-wrap">
                {video.thumbnail ? (
                  <img
                    className="home-video-teaser__thumb"
                    src={video.thumbnail}
                    alt=""
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <span className="home-video-teaser__thumb home-video-teaser__thumb--fallback" aria-hidden />
                )}
              </span>
              <span className="home-video-teaser__label">
                <span className="home-video-teaser__title">{video.title}</span>
                <span className="home-video-teaser__cta">
                  {video.sutra ? `${video.sutra} · watch video →` : 'watch video →'}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <Link className="catalog-section-cta" to={canonicalPathForRoute('/videos')}>
        Watch all videos →
      </Link>
    </>
  )
}
