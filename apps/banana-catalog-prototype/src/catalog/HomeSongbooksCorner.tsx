import { Link } from 'react-router-dom'
import type { HomeSongbookCornerCard } from './homePortalUtils'
import { ListenLpSongbookThumb } from './ListenLpSongbookThumb'
import { songbookToUrlSlug } from './slugify'
import { canonicalPathForRoute } from './seoPaths'

type Props = {
  cards: HomeSongbookCornerCard[]
}

/** Three playlist picks — same minimal thumb + zoom as /songbooks/. */
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
      <ul className="listen-lp__songbook-grid home-songbooks-corner" aria-label="Playlist corner songbooks">
        {cards.map(({ book }) => {
          const slug = (book.url_slug_songbook || '').trim() || songbookToUrlSlug(book.songbook)
          return (
            <li key={book.songbook_id || book.songbook} className="listen-lp__songbook-grid-cell">
              <ListenLpSongbookThumb book={{ ...book, slug }} />
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
