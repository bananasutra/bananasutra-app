import type { ReactNode } from 'react'
import { CatalogMediaOutbound } from './CatalogMediaOutbound'

type Props = {
  title: ReactNode
  meta?: ReactNode
  description?: string | null
  /** Inline exit links (e.g. open song page, view songbook) — use `catalog-featured-embed-copy__cta`. */
  children?: ReactNode
  outboundHref?: string | null
  /** Adds spotlight detail band padding + top rule below the player. */
  detailBand?: boolean
  className?: string
}

/**
 * Tokenized copy block below any in-page media embed (YT single, YT playlist, SC).
 * Pair with `catalog-video-spotlight__embed` / player shell above.
 */
export function CatalogFeaturedEmbedCopy({
  title,
  meta,
  description,
  children,
  outboundHref,
  detailBand = false,
  className = '',
}: Props) {
  const rootClass = [
    'catalog-featured-embed-copy',
    detailBand ? 'catalog-video-spotlight__detail' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  const trimmedDesc = (description || '').trim()
  const outbound = (outboundHref || '').trim()

  return (
    <div className={rootClass}>
      <h3 className="catalog-featured-embed-copy__title">{title}</h3>
      {meta ? <p className="catalog-featured-embed-copy__meta">{meta}</p> : null}
      {trimmedDesc ? <p className="catalog-featured-embed-copy__desc">{trimmedDesc}</p> : null}
      {children}
      {outbound ? <CatalogMediaOutbound href={outbound} /> : null}
    </div>
  )
}
