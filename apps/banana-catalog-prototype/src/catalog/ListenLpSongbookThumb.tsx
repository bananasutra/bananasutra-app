import { Link } from 'react-router-dom'
import { buildSrcset, coverImageUrl } from '../seo/imageUrl'
import { songbookHref } from './songbooks'
import { formatSongbookScPlaylistMeta } from './songbookPlaylistMeta'
import type { ListenLpSongbookPick } from './listenLpData'

type Props = {
  book: ListenLpSongbookPick
  /** Optional type kicker above the title (homepage playlist corner). */
  eyebrow?: string
}

export function ListenLpSongbookThumb({ book, eyebrow }: Props) {
  const title = book.songbook
  const meta = formatSongbookScPlaylistMeta(book)
  const art = (book.playlist_artwork_url || '').trim()
  const cover = coverImageUrl(art, { width: 280 })
  const eyebrowText = (eyebrow || '').trim()
  const aria = [eyebrowText, title, meta].filter(Boolean).join(' · ')

  return (
    <Link className="listen-lp__songbook-thumb" to={songbookHref(book.songbook)} aria-label={aria}>
      {cover ? (
        <span className="listen-lp__songbook-thumb-art-wrap">
          <img
            className="listen-lp__songbook-thumb-art"
            src={cover}
            srcSet={buildSrcset(art, [180, 280, 360])}
            sizes="160px"
            alt=""
            width={280}
            height={280}
            loading="lazy"
            decoding="async"
          />
        </span>
      ) : (
        <span className="listen-lp__songbook-thumb-art listen-lp__songbook-thumb-art--fallback" aria-hidden>
          ♪
        </span>
      )}
      {eyebrowText ? <span className="listen-lp__songbook-thumb-eyebrow">{eyebrowText}</span> : null}
      <span className="listen-lp__songbook-thumb-title">{title}</span>
      {meta ? <span className="listen-lp__songbook-thumb-meta">{meta}</span> : null}
    </Link>
  )
}
