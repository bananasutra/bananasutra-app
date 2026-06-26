import { Link } from 'react-router-dom'
import { buildSrcset, coverImageUrl } from '../seo/imageUrl'
import type { HomeCoverTile } from './homePortalData'

type Props = {
  tiles: HomeCoverTile[]
  onReload: () => void
}

/** Feeling lucky — square cover grid with reload. */
export function HomePortalCoverStrip({ tiles, onReload }: Props) {
  if (!tiles.length) return null

  return (
    <>
      <div className="home-portal__lucky-head">
        <h2 id="home-cover-strip-heading" className="catalog-section-title">
          Feeling lucky?
        </h2>
        <button type="button" className="home-lucky-reload" onClick={onReload}>
          ↻ Reload
        </button>
      </div>
      <p className="catalog-lp-section-intro">
        Tap a cover and see where it takes you. It&apos;s chill. It&apos;s fun. It&apos;s free. Woo.
      </p>
      <ul className="home-lucky-strip" aria-label="Random song covers">
        {tiles.map((tile) => {
          const art = (tile.art || '').trim()
          const coverSrc = art ? coverImageUrl(art, { width: 160 }) : ''
          const coverSrcSet = art ? buildSrcset(art, [80, 160, 240]) : ''
          return (
            <li key={tile.slug}>
              <Link className="home-lucky-strip__thumb" to={tile.href} aria-label={tile.title} title={tile.title}>
                {art ? (
                  <img
                    src={coverSrc}
                    srcSet={coverSrcSet || undefined}
                    sizes="(max-width: 720px) 9vw, 80px"
                    alt=""
                    width={80}
                    height={80}
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <span className="home-lucky-strip__placeholder" aria-hidden />
                )}
              </Link>
            </li>
          )
        })}
      </ul>
    </>
  )
}
