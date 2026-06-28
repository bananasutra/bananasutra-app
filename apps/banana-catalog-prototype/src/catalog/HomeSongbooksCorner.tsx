import { Link } from 'react-router-dom'
import type { HomeSongbookCornerCard } from './homePortalUtils'
import { homeSongbookCornerKicker, songbookHrefFromCatalogItem } from './homePortalUtils'
import { CoverImage } from './CoverImage'
import { formatSongbookScPlaylistMeta } from './songbookPlaylistMeta'
import { canonicalPathForRoute } from './seoPaths'

type Props = {
  cards: HomeSongbookCornerCard[]
}

/** Three playlist types: topic, genre best-of, language. */
export function HomeSongbooksCorner({ cards }: Props) {
  if (!cards.length) return null

  return (
    <>
      <h2 id="home-songbook-spotlight-heading" className="catalog-section-title">
        The playlists corner
      </h2>
      <p className="catalog-lp-section-intro">
        This is where we settle in. Songbooks are the long-play option for the curious.
      </p>
      <ul className="home-songbooks-corner">
        {cards.map(({ slot, book }, index) => {
          const art = (book.playlist_artwork_url || book.songbook_art_url || '').trim()
          const rawDesc = (book.description || '').replace(/\s+/g, ' ').trim()
          const description = rawDesc.length > 96 ? `${rawDesc.slice(0, 93)}…` : rawDesc
          const href = songbookHrefFromCatalogItem(book)
          const meta = formatSongbookScPlaylistMeta(book)
          return (
            <li key={book.songbook_id || book.songbook}>
              <Link className="home-songbooks-corner__card" to={href}>
                {art ? (
                  <CoverImage
                    className="home-songbooks-corner__art"
                    source={art}
                    requestWidth={320}
                    alt=""
                    width={160}
                    height={160}
                    loading={index === 0 ? 'eager' : 'lazy'}
                    fetchPriority={index === 0 ? 'high' : undefined}
                    decoding="async"
                    showShimmer
                  />
                ) : (
                  <div className="home-songbooks-corner__art home-songbooks-corner__art--fallback" aria-hidden />
                )}
                <div className="home-songbooks-corner__body">
                  <span className="home-songbooks-corner__type">{homeSongbookCornerKicker(slot, book)}</span>
                  <span className="home-songbooks-corner__title">{book.songbook}</span>
                  <span className="home-songbooks-corner__desc">{description || '\u00a0'}</span>
                  {meta ? <span className="home-songbooks-corner__meta">{meta}</span> : null}
                  <span className="home-songbooks-corner__cta">Open songbook →</span>
                </div>
              </Link>
            </li>
          )
        })}
      </ul>
      <Link className="catalog-section-cta" to={canonicalPathForRoute('/songbooks')}>
        Browse all songbooks →
      </Link>
    </>
  )
}
