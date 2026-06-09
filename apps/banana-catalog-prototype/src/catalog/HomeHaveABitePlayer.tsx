import { useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent, MouseEvent } from 'react'
import { Link } from 'react-router-dom'
import { LazySoundCloudEmbed } from './LazySoundCloudEmbed'
import { formatDurationDisplay } from './durationFormat'
import type { HomeListenerFavorite } from './homePortalData'
import { canonicalPathForRoute } from './seoPaths'
import { sutraClassName } from './sutraTheme'

type Props = {
  favorites: HomeListenerFavorite[]
}

/** In-place listen — listen LP player shell; embed loads on row tap (no homepage autoplay). */
export function HomeHaveABitePlayer({ favorites }: Props) {
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null)
  const [scAutoplay, setScAutoplay] = useState(false)
  const [embedKey, setEmbedKey] = useState(0)
  const playerWrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!favorites.length) {
      setSelectedTrackId(null)
      setScAutoplay(false)
    }
  }, [favorites])

  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (!event.persisted) return
      setSelectedTrackId(null)
      setScAutoplay(false)
      setEmbedKey((k) => k + 1)
    }
    window.addEventListener('pageshow', onPageShow)
    return () => window.removeEventListener('pageshow', onPageShow)
  }, [])

  const selected = useMemo(
    () => favorites.find((t) => t.trackId === selectedTrackId) ?? null,
    [favorites, selectedTrackId],
  )

  const activeScUrl = (selected?.scUrl || '').trim()

  const pickTrack = (trackId: string, scUrl: string) => {
    if (!scUrl.trim()) return
    if (trackId === selectedTrackId) {
      setEmbedKey((k) => k + 1)
      setScAutoplay(true)
      return
    }
    setSelectedTrackId(trackId)
    setScAutoplay(true)
    setEmbedKey((k) => k + 1)
  }

  const rowActivate = (e: MouseEvent | KeyboardEvent, row: HomeListenerFavorite) => {
    if ((e.target as HTMLElement).closest('a')) return
    pickTrack(row.trackId, row.scUrl)
  }

  const rowKeyDown = (e: KeyboardEvent<HTMLDivElement>, row: HomeListenerFavorite) => {
    if ((e.target as HTMLElement).closest('a')) return
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      pickTrack(row.trackId, row.scUrl)
    }
  }

  if (!favorites.length) return null

  return (
    <>
      <div className="home-bite-player listen-lp__popular-player">
        <div
          className="listen-lp__player-frame listen-lp__player-frame--compact home-bite-player__frame"
          ref={playerWrapRef}
        >
          {activeScUrl ? (
            <LazySoundCloudEmbed
              scUrl={activeScUrl}
              title={selected?.title ?? 'Top track'}
              height={140}
              mode="list"
              autoPlay={scAutoplay}
              reloadKey={embedKey}
              activation="interaction_or_autoplay"
            />
          ) : (
            <p className="home-bite-player__hint">Tap a track below to load the player.</p>
          )}
        </div>

        <ol className="listen-lp__track-list home-bite-player__list" aria-label="Top tracks">
          {favorites.map((row) => {
            const active = row.trackId === selectedTrackId
            const disabled = !(row.scUrl || '').trim()
            const genreText = (row.genre || '').trim()
            const durationLabel = formatDurationDisplay(row.duration)
            const sutraText = (row.sutra || '').trim()
            return (
              <li key={row.trackId} className="listen-lp__track-item">
                <div
                  className={`listen-lp__track-row listen-lp__track-row--compact home-bite-player__row${active ? ' listen-lp__track-row--active' : ''}${disabled ? ' home-bite-player__row--disabled' : ''}`}
                  role="button"
                  tabIndex={disabled ? -1 : 0}
                  aria-current={active ? 'true' : undefined}
                  onClick={(e) => rowActivate(e, row)}
                  onKeyDown={(e) => rowKeyDown(e, row)}
                >
                  <div className="listen-lp__track-body home-bite-player__body">
                    <p className="listen-lp__track-title home-bite-player__title-line">
                      <Link className="home-bite-player__title-link" to={row.href} onClick={(e) => e.stopPropagation()}>
                        {row.title}
                      </Link>
                      {sutraText ? (
                        <span className={`home-bite-player__inline-sutra catalog-facet-sutra-name ${sutraClassName(sutraText)}`.trim()}>
                          {' · '}
                          {sutraText}
                        </span>
                      ) : null}
                      {genreText ? <span className="home-bite-player__inline-genre"> · {genreText}</span> : null}
                    </p>
                  </div>
                  {durationLabel ? <span className="listen-lp__track-duration">{durationLabel}</span> : null}
                  <span className="listen-lp__track-play" aria-hidden>
                    ▶
                  </span>
                </div>
              </li>
            )
          })}
        </ol>
      </div>
      <Link className="catalog-section-cta" to={canonicalPathForRoute('/tracks')}>
        Explore all tracks →
      </Link>
    </>
  )
}
