import { Link } from 'react-router-dom'
import { coverImageUrl } from '../seo/imageUrl'
import type { HomeCoverTile } from './homePortalData'

type Props = {
  tiles: HomeCoverTile[]
}

export function HomePortalCoverStrip({ tiles }: Props) {
  if (!tiles.length) return null

  return (
    <div className="home-cover-strip-wrap">
      <ul className="home-cover-strip" aria-label="Song covers">
        {tiles.map((tile) => {
          const art = (tile.art || '').trim()
          return (
            <li key={tile.slug}>
              <Link to={tile.href} aria-label={tile.title} title={tile.title}>
                {art ? (
                  <img
                    src={coverImageUrl(art, { width: 96 })}
                    alt=""
                    width={48}
                    height={48}
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <span className="home-cover-strip__placeholder" aria-hidden />
                )}
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
