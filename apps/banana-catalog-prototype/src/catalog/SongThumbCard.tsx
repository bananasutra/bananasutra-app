import { Link, type To } from 'react-router-dom'
import './songThumbCard.css'

export type SongThumbCardProps = {
  to: To
  coverUrl: string
  title: string
  /** Upper micro-label above title (e.g. sutra); omit when unknown */
  metaLabel?: string
  /** Optional short line under title (e.g. catalog summary on songbooks) */
  summary?: string
  ariaLabel?: string
}

export function SongThumbCard({ to, coverUrl, title, metaLabel, summary, ariaLabel }: SongThumbCardProps) {
  const cover = (coverUrl || '').trim()
  const meta = (metaLabel || '').trim()
  const sum = (summary || '').trim()
  const label = ariaLabel ?? (meta ? `${title} · ${meta}` : title)

  return (
    <Link className="song-thumb-card" to={to} aria-label={label}>
      {cover ? (
        <img
          className="song-thumb-card__cover"
          src={cover}
          alt=""
          width={400}
          height={400}
          loading="lazy"
          decoding="async"
        />
      ) : (
        <div className="song-thumb-card__cover song-thumb-card__cover--fallback" aria-hidden>
          <span className="song-thumb-card__fallback-icon">♪</span>
        </div>
      )}
      <div className="song-thumb-card__footer">
        {meta ? <span className="song-thumb-card__meta">{meta}</span> : null}
        <span className="song-thumb-card__title">{title}</span>
        {sum ? <span className="song-thumb-card__summary">{sum}</span> : null}
      </div>
    </Link>
  )
}
