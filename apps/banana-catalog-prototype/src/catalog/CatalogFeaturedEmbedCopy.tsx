import type { ReactNode } from 'react'
import { CatalogMediaOutbound } from './CatalogMediaOutbound'

type Props = {
  title: ReactNode
  /** Small-caps kicker above the title row (e.g. SONGBOOK · COLLECTION). */
  meta?: ReactNode
  /** Optional stats row below title (legacy video / playlist surfaces). */
  stats?: ReactNode
  /**
   * Track count + duration as one string (e.g. `83 tracks · 4 hr 31 min`).
   * Renders on the same line as the title from tablet up; tight stack on mobile.
   */
  titleMeta?: string | null
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
  stats,
  titleMeta,
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
  const titleMetaText = (titleMeta || '').trim()
  const useTitleRow = Boolean(titleMetaText)

  return (
    <div className={rootClass}>
      {useTitleRow ? (
        <>
          {meta ? <p className="catalog-featured-embed-copy__meta">{meta}</p> : null}
          <div className="catalog-featured-embed-copy__title-row">
            <h3 className="catalog-featured-embed-copy__title">{title}</h3>
            <span className="catalog-featured-embed-copy__title-meta">{titleMetaText}</span>
          </div>
        </>
      ) : (
        <>
          <h3 className="catalog-featured-embed-copy__title">{title}</h3>
          {meta ? <p className="catalog-featured-embed-copy__meta">{meta}</p> : null}
          {stats ? <p className="catalog-featured-embed-copy__stats">{stats}</p> : null}
        </>
      )}
      {trimmedDesc ? <p className="catalog-featured-embed-copy__desc">{trimmedDesc}</p> : null}
      {children}
      {outbound ? <CatalogMediaOutbound href={outbound} /> : null}
    </div>
  )
}
