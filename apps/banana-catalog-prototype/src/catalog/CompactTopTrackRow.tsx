import type { KeyboardEvent, MouseEvent } from 'react'
import { Link, type To } from 'react-router-dom'
import { coverImageUrl } from '../seo/imageUrl'
import { ShareButton } from './ShareButton'
import { sutraClassName } from './sutraTheme'

export function trackListThumbSrc(url: string): string {
  const u = url.trim()
  if (!u) return ''
  return u.replace(/-t\d+x\d+\./i, '-t200x200.').replace(/-toriginal\./i, '-t200x200.')
}

export type CompactTopTrackRowProps = {
  rank: number
  active?: boolean
  disabled?: boolean
  coverUrl?: string
  title: string
  songLinkTo: To
  shareUrl: string
  sutraText?: string
  genreText?: string
  durationLabel?: string
  showPlayingWave?: boolean
  showPlayLoading?: boolean
  rowClassName?: string
  onActivate: (e: MouseEvent) => void
  onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => void
}

/** Shared compact top-track row — listen LP + homepage Top 5. */
export function CompactTopTrackRow({
  rank,
  active = false,
  disabled = false,
  coverUrl = '',
  title,
  songLinkTo,
  shareUrl,
  sutraText = '',
  genreText = '',
  durationLabel = '',
  showPlayingWave = false,
  showPlayLoading = false,
  rowClassName = '',
  onActivate,
  onKeyDown,
}: CompactTopTrackRowProps) {
  const cover = coverUrl ? coverImageUrl(trackListThumbSrc(coverUrl), { width: 200 }) : ''
  const sutra = sutraText.trim()
  const genre = genreText.trim()

  return (
    <li className="listen-lp__track-item">
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        className={`listen-lp__track-row listen-lp__track-row--compact${active ? ' listen-lp__track-row--active' : ''}${rowClassName ? ` ${rowClassName}` : ''}`}
        onClick={onActivate}
        onKeyDown={onKeyDown}
        aria-current={active ? 'true' : undefined}
      >
        <span className="listen-lp__track-rank">{rank}</span>
        {cover ? (
          <span className="listen-lp__track-art-wrap listen-lp__track-art-wrap--sm">
            <img className="listen-lp__track-art" src={cover} alt="" loading="lazy" />
            {showPlayingWave ? (
              <span className="listen-lp__track-wave" aria-hidden>
                <span className="listen-lp__track-wave-bar" />
                <span className="listen-lp__track-wave-bar" />
                <span className="listen-lp__track-wave-bar" />
                <span className="listen-lp__track-wave-bar" />
              </span>
            ) : null}
          </span>
        ) : (
          <span className="listen-lp__track-art listen-lp__track-art--empty listen-lp__track-art--sm" aria-hidden />
        )}
        <div className="listen-lp__track-body">
          <Link
            className="listen-lp__track-title listen-lp__track-title--link"
            to={songLinkTo}
            onClick={(e) => e.stopPropagation()}
          >
            {title}
          </Link>
          {sutra || genre ? (
            <p className="listen-lp__track-meta">
              {sutra ? (
                <span className={`catalog-sutra-word ${sutraClassName(sutra)}`}>{sutra}</span>
              ) : null}
              {genre ? <span>{sutra ? ` · ${genre}` : genre}</span> : null}
            </p>
          ) : null}
        </div>
        <span
          className={`listen-lp__track-play${showPlayLoading ? ' listen-lp__track-play--loading' : ''}`}
          aria-hidden={!showPlayLoading}
          aria-busy={showPlayLoading || undefined}
        >
          {showPlayLoading ? (
            <span className="listen-lp__track-play-spinner" aria-hidden />
          ) : active && showPlayingWave ? (
            '❚❚'
          ) : (
            '▶'
          )}
        </span>
        {durationLabel ? <span className="listen-lp__track-duration">{durationLabel}</span> : null}
        <ShareButton variant="icon" url={shareUrl} title={title} text="Listen on Bananasutra" />
      </div>
    </li>
  )
}
