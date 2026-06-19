import { Link } from 'react-router-dom'
import type { SongbookCatalogItem } from './types'
import { coverImageUrl } from '../seo/imageUrl'
import { songbookHrefFromCatalogItem } from './homePortalUtils'
import { canonicalPathForRoute } from './seoPaths'
import { CatalogFeaturedEmbedCopy } from './CatalogFeaturedEmbedCopy'
import { formatSongbookScPlaylistMeta } from './songbookPlaylistMeta'
import './catalog-page-shell.css'

type Props = {
  book: SongbookCatalogItem
}

/** Songbook spotlight — cover-forward (matches latest drops featured layout). */
export function HomeFeaturedSongbookCard({ book }: Props) {
  const art = (book.playlist_artwork_url || book.songbook_art_url || '').trim()
  const rawDesc = (book.description || '').replace(/\s+/g, ' ').trim()
  const description = rawDesc.length > 140 ? `${rawDesc.slice(0, 137)}…` : rawDesc
  const href = songbookHrefFromCatalogItem(book)

  return (
    <>
      <Link className="home-songbook-spotlight home-songbook-spotlight--featured" to={href}>
        {art ? (
          <img
            className="home-songbook-spotlight__art home-songbook-spotlight__art--featured"
            src={coverImageUrl(art, { width: 384 })}
            alt=""
            width={192}
            height={192}
            loading="lazy"
            decoding="async"
          />
        ) : null}
        <CatalogFeaturedEmbedCopy
          className="home-songbook-spotlight__copy"
          meta="Continuous play on mobile"
          title={book.songbook}
          titleMeta={formatSongbookScPlaylistMeta(book)}
          description={description}
        >
          <span className="home-songbook-spotlight__cta">Open songbook →</span>
        </CatalogFeaturedEmbedCopy>
      </Link>
      <Link className="catalog-section-cta" to={canonicalPathForRoute('/songbooks')}>
        Browse all songbooks →
      </Link>
    </>
  )
}
