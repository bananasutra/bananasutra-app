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
  /** split = embed + copy side-by-side (768px+); stacked = full-width embed then copy below */
  layout?: 'split' | 'stacked'
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
}: Props) {
  const copy = (
    <CatalogFeaturedEmbedCopy
      meta={songbookFeaturedKickerLabel(book)}
      title={book.songbook}
      titleMeta={formatSongbookScPlaylistMeta(book)}
      description={book.description}
    >
      <Link className="catalog-featured-embed-copy__cta" to={ctaTo}>
        {ctaLabel}
      </Link>
    </CatalogFeaturedEmbedCopy>
  )

  if (layout === 'stacked') {
    return (
      <div className={['catalog-featured-songbook', 'catalog-featured-songbook--stacked', className].filter(Boolean).join(' ')}>
        <div className="catalog-featured-songbook__embed">{embed}</div>
        <div className="catalog-featured-songbook__stacked-copy">{copy}</div>
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
