import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { songbookFeaturedKickerLabel } from './homePortalUtils'
import { SongbookPlaylistMetaLine } from './SongbookPlaylistMetaLine'
import type { SongbookCatalogItem } from './types'
import './FeaturedSongbookSpotlight.css'

type Props = {
  book: SongbookCatalogItem
  embed: ReactNode
  ctaTo: string
  ctaLabel?: string
  /** BEM block modifier, e.g. `listen-lp__featured` */
  className?: string
}

/**
 * Featured songbook layout: embed + copy with kicker → playlist meta → title → description → CTA.
 * Tokenized across home, /listen, and /songbooks.
 */
export function FeaturedSongbookSpotlight({
  book,
  embed,
  ctaTo,
  ctaLabel = 'Open songbook →',
  className = '',
}: Props) {
  return (
    <div className={['catalog-featured-songbook', className].filter(Boolean).join(' ')}>
      <div className="catalog-featured-songbook__grid">
        <div className="catalog-featured-songbook__embed">{embed}</div>
        <div className="catalog-featured-songbook__copy">
          <p className="catalog-featured-songbook__kicker">{songbookFeaturedKickerLabel(book)}</p>
          <SongbookPlaylistMetaLine book={book} className="catalog-featured-songbook__meta" />
          <h3 className="catalog-featured-songbook__title">{book.songbook}</h3>
          {book.description ? <p className="catalog-featured-songbook__desc">{book.description}</p> : null}
          <Link className="catalog-section-cta catalog-featured-songbook__cta" to={ctaTo}>
            {ctaLabel}
          </Link>
        </div>
      </div>
    </div>
  )
}
