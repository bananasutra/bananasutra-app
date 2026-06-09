import { Link } from 'react-router-dom'
import type { SongbookCatalogItem } from './types'
import { coverImageUrl } from '../seo/imageUrl'
import { formatHomeCount } from './homePortalData'
import { songbookHrefFromCatalogItem } from './homePortalUtils'
import { canonicalPathForRoute } from './seoPaths'

type Props = {
  book: SongbookCatalogItem
}

/** Songbook spotlight — cover-forward (matches latest drops featured layout). */
export function HomeFeaturedSongbookCard({ book }: Props) {
  const art = (book.playlist_artwork_url || book.songbook_art_url || '').trim()
  const trackCount = book.playlist_track_count || book.song_count || 0
  const plays = book.playlist_total_plays || 0
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
        <div className="home-songbook-spotlight__body">
          <p className="home-songbook-spotlight__kicker">
            {trackCount} tracks · {formatHomeCount(plays)} plays · continuous play on mobile
          </p>
          <h3 className="home-songbook-spotlight__title">{book.songbook}</h3>
          {description ? <p className="home-songbook-spotlight__desc">{description}</p> : null}
          <span className="home-songbook-spotlight__cta">Open songbook →</span>
        </div>
      </Link>
      <Link className="catalog-section-cta" to={canonicalPathForRoute('/songbooks')}>
        Browse all songbooks →
      </Link>
    </>
  )
}
