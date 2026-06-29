import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent, MouseEvent } from 'react'
import { Link } from 'react-router-dom'
import { CompactTopTrackRow } from './CompactTopTrackRow'
import { LazySoundCloudEmbed } from './LazySoundCloudEmbed'
import { formatDurationDisplay } from './durationFormat'
import type { HomeListenerFavorite } from './homePortalData'
import { canonicalPathForRoute } from './seoPaths'
import { trackShareUrl } from './shareUrl'
import { bindSoundCloudWidgetPlayback } from './soundCloudWidgetPlayback'
import type { SoundCloudWidget } from './soundcloudWidgetApi'
import { usePlaybackStarting } from './usePlaybackStarting'

type Props = {
  favorites: HomeListenerFavorite[]
  /** When false, browse CTA lives in section footer. */
  showBrowseCta?: boolean
}

function firstPlayableTrackId(favorites: HomeListenerFavorite[]): string | null {
  return favorites.find((f) => (f.scUrl || '').trim())?.trackId ?? null
}

/** Top tracks — listen LP shell; first track embed loads on page load. */
export function HomeHaveABitePlayer({ favorites, showBrowseCta = true }: Props) {
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(() => firstPlayableTrackId(favorites))
  const [scAutoplay, setScAutoplay] = useState(false)
  const [embedKey, setEmbedKey] = useState(0)
  const [isScPlaying, setIsScPlaying] = useState(false)
  const playerWrapRef = useRef<HTMLDivElement>(null)
  const scWidgetRef = useRef<SoundCloudWidget | null>(null)
  const skipPlaybackResetOnNextSelectionChange = useRef(false)
  const { playbackStarting, markPlaybackStarting, clearPlaybackStarting } = usePlaybackStarting()

  useEffect(() => {
    if (!favorites.length) {
      setSelectedTrackId(null)
      setScAutoplay(false)
      setIsScPlaying(false)
      return
    }
    setSelectedTrackId((prev) => {
      if (prev && favorites.some((f) => f.trackId === prev && (f.scUrl || '').trim())) return prev
      return firstPlayableTrackId(favorites)
    })
  }, [favorites])

  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (!event.persisted) return
      setSelectedTrackId(firstPlayableTrackId(favorites))
      setScAutoplay(false)
      setIsScPlaying(false)
      setEmbedKey((k) => k + 1)
    }
    window.addEventListener('pageshow', onPageShow)
    return () => window.removeEventListener('pageshow', onPageShow)
  }, [favorites])

  useEffect(() => {
    if (skipPlaybackResetOnNextSelectionChange.current) {
      skipPlaybackResetOnNextSelectionChange.current = false
      return
    }
    clearPlaybackStarting()
    setIsScPlaying(false)
  }, [clearPlaybackStarting, selectedTrackId])

  const selected = useMemo(
    () => favorites.find((t) => t.trackId === selectedTrackId) ?? null,
    [favorites, selectedTrackId],
  )

  const activeScUrl = (selected?.scUrl || '').trim()

  const handlePlayerLoad = useCallback(() => {
    const wrap = playerWrapRef.current
    if (!wrap) return
    const iframe = wrap.querySelector<HTMLIFrameElement>('iframe.sc-embed-frame')
    if (!iframe) return
    void import('./soundcloudWidgetApi')
      .then(({ loadSoundCloudWidgetApi }) => loadSoundCloudWidgetApi())
      .then((SC) => {
        if (!document.body.contains(iframe)) return
        const widget = SC.Widget(iframe)
        scWidgetRef.current = widget
        bindSoundCloudWidgetPlayback(widget, SC, {
          onPlayingChange: (playing) => {
            setIsScPlaying(playing)
            if (playing) clearPlaybackStarting()
          },
        })
      })
      .catch(() => {
        // Widget API failed to load; row play still swaps embed.
      })
  }, [clearPlaybackStarting])

  const pickTrack = (trackId: string, scUrl: string) => {
    if (!scUrl.trim()) return
    if (trackId === selectedTrackId && scWidgetRef.current) {
      if (isScPlaying) {
        try {
          scWidgetRef.current.pause()
        } catch {
          // Ignore widget pause failures.
        }
        clearPlaybackStarting()
        return
      }
      markPlaybackStarting()
      skipPlaybackResetOnNextSelectionChange.current = true
      try {
        scWidgetRef.current.play()
        setScAutoplay(true)
      } catch {
        setEmbedKey((k) => k + 1)
        setScAutoplay(true)
      }
      return
    }
    markPlaybackStarting()
    skipPlaybackResetOnNextSelectionChange.current = true
    setSelectedTrackId(trackId)
    setScAutoplay(true)
    setEmbedKey((k) => k + 1)
  }

  const rowActivate = (e: MouseEvent, row: HomeListenerFavorite) => {
    if ((e.target as HTMLElement).closest('a, button')) return
    pickTrack(row.trackId, row.scUrl)
  }

  const rowKeyDown = (e: KeyboardEvent<HTMLDivElement>, row: HomeListenerFavorite) => {
    if ((e.target as HTMLElement).closest('a, button')) return
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
              activation="immediate"
              onLoad={handlePlayerLoad}
            />
          ) : null}
        </div>

        <ol className="listen-lp__track-list home-bite-player__list" aria-label="Top tracks">
          {favorites.map((row) => {
            const active = row.trackId === selectedTrackId
            const disabled = !(row.scUrl || '').trim()
            return (
              <CompactTopTrackRow
                key={row.trackId}
                rank={row.rank}
                active={active}
                disabled={disabled}
                coverUrl={row.art}
                title={row.title}
                songLinkTo={row.href}
                shareUrl={trackShareUrl(row.title, row.slug, row.trackId)}
                sutraText={row.sutra}
                genreText={row.genre}
                durationLabel={formatDurationDisplay(row.duration)}
                showPlayingWave={active && isScPlaying}
                showPlayLoading={active && playbackStarting}
                rowClassName={disabled ? 'home-bite-player__row--disabled' : ''}
                onActivate={(e) => rowActivate(e, row)}
                onKeyDown={(e) => rowKeyDown(e, row)}
              />
            )
          })}
        </ol>
      </div>
      {showBrowseCta ? (
        <Link className="catalog-section-cta" to={canonicalPathForRoute('/tracks')}>
          Explore all tracks →
        </Link>
      ) : null}
    </>
  )
}
