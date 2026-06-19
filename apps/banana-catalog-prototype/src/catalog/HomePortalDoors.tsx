import { Link } from 'react-router-dom'
import { coverImageUrl } from '../seo/imageUrl'
import type { HomeHeroQuote, HomeListenDoorPreview, HomeWatchDoorPreview } from './homePortalData'
import { canonicalPathForRoute } from './seoPaths'

type Props = {
  learnQuote: HomeHeroQuote | null
  listen: HomeListenDoorPreview | null
  watch: HomeWatchDoorPreview | null
}

/** D-024 / D-042 — unified preview-frame doors (preview + meta footer only). */
export function HomePortalDoors({ learnQuote, listen, watch }: Props) {
  return (
    <div className="home-doors__grid">
      <Link className="home-door" to={canonicalPathForRoute('/learn')}>
        <div className="home-door__head">
          <span className="home-door__mode">LEARN</span>
          <span className="home-door__brand">BLABLAsutra</span>
        </div>
        <div className="home-door__preview home-door__preview--frame home-door__preview--learn">
          <p className="home-door__preview-quote">
            {learnQuote?.extract || 'Ideas behind the songs. Sutras, muses, and the manifesto.'}
          </p>
        </div>
        <div className="home-door__body">
          <p className="home-door__footer">sutras · muses · quotes · manifesto · words</p>
        </div>
      </Link>

      <Link className="home-door" to={canonicalPathForRoute('/listen')}>
        <div className="home-door__head">
          <span className="home-door__mode">LISTEN</span>
          <span className="home-door__brand">RADIOsutra</span>
        </div>
        <div className="home-door__preview home-door__preview--frame">
          {listen?.art ? (
            <img
              src={coverImageUrl(listen.art, { width: 320 })}
              alt=""
              width={320}
              height={200}
              loading="lazy"
              decoding="async"
            />
          ) : (
            <span className="home-door__preview-placeholder" aria-hidden />
          )}
        </div>
        <div className="home-door__body">
          <p className="home-door__footer">top tracks · songbooks · Play All on desktop</p>
        </div>
      </Link>

      <Link className="home-door" to={canonicalPathForRoute('/watch')}>
        <div className="home-door__head">
          <span className="home-door__mode">WATCH</span>
          <span className="home-door__brand">CINEMAsutra</span>
        </div>
        <div className="home-door__preview home-door__preview--frame">
          {watch?.thumbnail ? (
            <img
              src={coverImageUrl(watch.thumbnail, { width: 320 })}
              alt=""
              width={320}
              height={200}
              loading="lazy"
              decoding="async"
            />
          ) : (
            <span className="home-door__preview-placeholder" aria-hidden />
          )}
        </div>
        <div className="home-door__body">
          <p className="home-door__footer">music films · YouTube playlists · stay awhile</p>
        </div>
      </Link>
    </div>
  )
}
