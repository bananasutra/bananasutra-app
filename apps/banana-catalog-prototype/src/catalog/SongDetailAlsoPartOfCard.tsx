import { Link } from 'react-router-dom'
import type { SongbookCatalogItem } from './types'
import { buildSrcset } from '../seo/imageUrl'
import { CoverImage } from './CoverImage'
import { songbookHrefFromCatalogItem } from './homePortalUtils'
import { sutraClassName } from './sutraTheme'

type Props = {
  book: SongbookCatalogItem & { slug: string }
  /** Current song — drives full vs. related songbook heading (SD-08). */
  lyricsId?: string
  isLyricsOnly?: boolean
}

function songbookCardHeading(book: SongbookCatalogItem, lyricsId: string | undefined, isLyricsOnly: boolean): string {
  if (!isLyricsOnly || !lyricsId) return 'Listen to full songbook'
  const member = book.member_songs.find((s) => s.lyrics_id === lyricsId)
  if (member?.has_in_app_playback) return 'Listen to full songbook'
  return 'Listen to related songbook'
}

function formatCount(n: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(n)
}

/** Variant B — stats + browse CTA below breakout (hero keeps identity line). */
export function SongDetailAlsoPartOfCard({ book, lyricsId, isLyricsOnly = false }: Props) {
  const heading = songbookCardHeading(book, lyricsId, isLyricsOnly)
  const art = (book.playlist_artwork_url || book.songbook_art_url || '').trim()
  const sutra = (book.sutras || '').split(',')[0]?.trim() ?? ''
  const trackCount = book.playlist_track_count || book.song_count || 0
  const plays = book.playlist_total_plays || 0
  const description = (book.description || '').replace(/\s+/g, ' ').trim()
  const blurb = description.length > 160 ? `${description.slice(0, 157)}…` : description

  const stats = [
    sutra ? <span className={`catalog-facet-sutra-name ${sutraClassName(sutra)}`}>{sutra}</span> : null,
    `${trackCount} songs`,
    `${formatCount(plays)} plays`,
  ]
    .filter(Boolean)
    .map((part, i) => (
      <span key={i}>{part}</span>
    ))

  return (
    <section className="song-detail-also" aria-labelledby="song-also-heading">
      <h2 id="song-also-heading" className="catalog-section-title">
        {heading}
      </h2>
      <div className="song-detail-also__card">
        {art ? (
          <Link
            className="song-detail-also__art-link"
            to={songbookHrefFromCatalogItem(book)}
            aria-label={`Listen to ${book.songbook}`}
          >
            <CoverImage
              className="song-detail-also__art"
              source={art}
              requestWidth={400}
              srcSet={buildSrcset(art, [200, 400])}
              sizes="(max-width: 640px) 50vw, 25vw"
              alt=""
              width={400}
              height={400}
              loading="lazy"
              decoding="async"
            />
          </Link>
        ) : null}
        <div className="song-detail-also__body">
          <p className="song-detail-also__title">{book.songbook}</p>
          <p className="song-detail-also__stats">
            {stats.map((node, idx) => (
              <span key={idx}>
                {idx > 0 ? ' · ' : null}
                {node}
              </span>
            ))}
          </p>
          {blurb ? <p className="song-detail-also__blurb">{blurb}</p> : null}
          <Link className="song-detail-also__cta" to={songbookHrefFromCatalogItem(book)}>
            Listen to songbook →
          </Link>
        </div>
      </div>
    </section>
  )
}
