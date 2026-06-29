import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { CatalogFeaturedEmbedCopy } from './CatalogFeaturedEmbedCopy'
import { songbookFeaturedKickerLabel } from './homePortalUtils'
import { formatSongbookScPlaylistMeta } from './songbookPlaylistMeta'
import type { SongbookCatalogItem } from './types'
import './FeaturedSongbookSpotlight.css'
import './catalog-page-shell.css'

type Props = {
  book: SongbookCatalogItem
  embed: ReactNode
  ctaTo: string
  ctaLabel?: string
  /** BEM block modifier, e.g. `listen-lp__featured` */
  className?: string
  /** split = embed + copy side-by-side (768px+); stacked = copy above embed */
  layout?: 'split' | 'stacked'
  /** listen-lp: no kicker, section CTA below embed (title + description stay above player). */
  stackedVariant?: 'default' | 'listen-lp'
}

/**
 * Featured songbook layout: embed + tokenized copy (kicker → title + tracks·duration → description → CTA).
 * Shared across home, /listen, /songbooks, and /sutras detail.
 */
export function FeaturedSongbookSpotlight({
  book,
  embed,
  ctaTo,
  ctaLabel = 'Open songbook →',
  className = '',
  layout = 'split',
  stackedVariant = 'default',
}: Props) {
  const listenLpStacked = layout === 'stacked' && stackedVariant === 'listen-lp'
  const copy = (
    <CatalogFeaturedEmbedCopy
      meta={listenLpStacked ? undefined : songbookFeaturedKickerLabel(book)}
      title={book.songbook}
      titleMeta={formatSongbookScPlaylistMeta(book)}
      description={book.description}
    >
      {listenLpStacked ? null : (
        <Link className="catalog-featured-embed-copy__cta" to={ctaTo}>
          {ctaLabel}
        </Link>
      )}
    </CatalogFeaturedEmbedCopy>
  )

  if (layout === 'stacked') {
    return (
      <div className={['catalog-featured-songbook', 'catalog-featured-songbook--stacked', className].filter(Boolean).join(' ')}>
        <div className="catalog-featured-songbook__stacked-copy">{copy}</div>
        <div className="catalog-featured-songbook__embed">{embed}</div>
        {listenLpStacked ? (
          <Link className="catalog-section-cta" to={ctaTo}>
            {ctaLabel}
          </Link>
        ) : null}
      </div>
    )
  }

  return (
    <div className={['catalog-featured-songbook', className].filter(Boolean).join(' ')}>
      <div className="catalog-featured-songbook__grid">
        <div className="catalog-featured-songbook__embed">{embed}</div>
        <div className="catalog-featured-songbook__copy">{copy}</div>
      </div>
    </div>
  )
}
