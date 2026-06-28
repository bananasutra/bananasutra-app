import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { buildSrcset, coverImageUrl } from '../seo/imageUrl'
import type { HomeCoverTile } from './homePortalData'
import { ThumbShimmer } from './ThumbShimmer'

type Props = {
  tiles: HomeCoverTile[]
  stripKey: string
  onReload: () => void
}

function LuckyCoverThumb({
  tile,
  index,
  stripKey,
}: {
  tile: HomeCoverTile
  index: number
  stripKey: string
}) {
  const art = (tile.art || '').trim()
  const coverSrc = art ? coverImageUrl(art, { width: 160 }) : ''
  const coverSrcSet = art ? buildSrcset(art, [80, 160, 240]) : ''
  const [loaded, setLoaded] = useState(false)
  const imgRef = useRef<HTMLImageElement>(null)

  useEffect(() => {
    setLoaded(false)
    const img = imgRef.current
    if (img?.complete && img.naturalWidth > 0) {
      setLoaded(true)
    }
  }, [stripKey, coverSrc])

  const showShimmer = Boolean(art) && !loaded

  return (
    <li>
      <Link className="home-lucky-strip__thumb" to={tile.href} aria-label={tile.title} title={tile.title}>
        {art ? (
          <>
            {showShimmer ? <ThumbShimmer /> : null}
            <img
              ref={imgRef}
              src={coverSrc}
              srcSet={coverSrcSet || undefined}
              sizes="(max-width: 720px) 9vw, 80px"
              alt=""
              width={80}
              height={80}
              loading={index < 4 ? 'eager' : 'lazy'}
              fetchPriority={index === 0 ? 'high' : undefined}
              decoding="async"
              className={loaded ? 'is-loaded' : 'is-loading'}
              onLoad={() => setLoaded(true)}
              onError={() => setLoaded(true)}
            />
          </>
        ) : (
          <span className="home-lucky-strip__placeholder" aria-hidden />
        )}
      </Link>
    </li>
  )
}

/** Feeling lucky — square cover grid with reload. */
export function HomePortalCoverStrip({ tiles, stripKey, onReload }: Props) {
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
      <ul className="home-lucky-strip" aria-label="Random song covers" aria-busy="false">
        {tiles.map((tile, index) => (
          <LuckyCoverThumb key={`${stripKey}|${tile.slug}`} tile={tile} index={index} stripKey={stripKey} />
        ))}
      </ul>
    </>
  )
}
