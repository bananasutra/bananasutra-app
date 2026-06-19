import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react'
import { Link } from 'react-router-dom'
import type { AnalyticsMode } from '../lib/analytics'
import { trackCatalogPlayStarted } from './catalogAnalytics'
import { buildSrcset, coverImageUrl } from '../seo/imageUrl'
import { LazySoundCloudEmbed } from './LazySoundCloudEmbed'
import { formatPublishDate } from './formatPublishDate'
import type { ListenLpWhatsNewPick } from './listenLpWhatsNewData'
import { bindSoundCloudWidgetPlayback } from './soundCloudWidgetPlayback'
import type { SoundCloudWidget } from './soundcloudWidgetApi'

const LISTEN_MODE: AnalyticsMode = 'listen'
const SC_EMBED_HEIGHT = 120

type Props = {
  picks: ListenLpWhatsNewPick[]
}

type SampleCardProps = {
  pick: ListenLpWhatsNewPick
  isActive: boolean
  isPlaying: boolean
  embedKey: number
  onPlay: () => void
  onPlayingChange: (playing: boolean) => void
  onWidgetReady: (widget: SoundCloudWidget | null) => void
}

function ListenLpSampleCard({
  pick,
  isActive,
  isPlaying,
  embedKey,
  onPlay,
  onPlayingChange,
  onWidgetReady,
}: SampleCardProps) {
  const mediaRef = useRef<HTMLDivElement>(null)
  const cover = coverImageUrl(pick.song.cover_image_url, { width: 400 })
  const coverSrcSet = buildSrcset(pick.song.cover_image_url, [200, 400])
  const pubLabel = formatPublishDate(pick.song.published_at || '')
  const pubIso = (pick.song.published_at || '').trim().slice(0, 10)
  const sutraText = (pick.song.sutra || '').trim()
  const playLabel = isActive && isPlaying ? `Pause ${pick.song.lyrics_title}` : `Play ${pick.song.lyrics_title}`

  const handleEmbedLoad = useCallback(() => {
    const wrap = mediaRef.current
    if (!wrap) return
    const iframe = wrap.querySelector<HTMLIFrameElement>('iframe.sc-embed-frame')
    if (!iframe) return
    void import('./soundcloudWidgetApi')
      .then(({ loadSoundCloudWidgetApi }) => loadSoundCloudWidgetApi())
      .then((SC) => {
        if (!document.body.contains(iframe)) return
        const widget = SC.Widget(iframe)
        onWidgetReady(widget)
        bindSoundCloudWidgetPlayback(widget, SC, { onPlayingChange })
      })
      .catch(() => {
        onWidgetReady(null)
      })
  }, [onPlayingChange, onWidgetReady])

  const handlePlayClick = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation()
    onPlay()
  }

  return (
    <article className={`listen-lp__sample-card${isActive ? ' is-active' : ''}${isPlaying ? ' is-playing' : ''}`}>
      <div className="listen-lp__sample-card__media" ref={mediaRef}>
        {isActive ? (
          <div className="listen-lp__sample-card__embed-host" aria-hidden>
            <LazySoundCloudEmbed
              scUrl={pick.track.sc_url}
              title={pick.track.lyrics_title || pick.track.track_title}
              height={SC_EMBED_HEIGHT}
              mode="visual"
              autoPlay
              reloadKey={embedKey}
              activation="interaction_or_autoplay"
              loading="eager"
              onLoad={handleEmbedLoad}
            />
          </div>
        ) : null}
        {cover ? (
          <img
            className="listen-lp__sample-card__cover"
            src={cover}
            srcSet={coverSrcSet}
            sizes="(max-width: 640px) 30vw, 12rem"
            alt=""
            width={400}
            height={400}
            loading="lazy"
            decoding="async"
          />
        ) : (
          <span className="listen-lp__sample-card__cover listen-lp__sample-card__cover--fallback" aria-hidden>
            ♪
          </span>
        )}
        <button type="button" className="listen-lp__sample-card__play" aria-label={playLabel} onClick={handlePlayClick}>
          <span className="listen-lp__sample-card__play-ring" aria-hidden>
            <span className="listen-lp__sample-card__play-glyph">{isActive && isPlaying ? '❚❚' : '▶'}</span>
          </span>
        </button>
      </div>
      <div className="listen-lp__sample-card__footer">
        {sutraText ? <span className="listen-lp__sample-card__meta">{sutraText}</span> : null}
        <Link className="listen-lp__sample-card__title" to={pick.songHref}>
          {pick.song.lyrics_title}
        </Link>
        {pubLabel && pubIso ? (
          <time className="listen-lp__sample-card__date" dateTime={pubIso}>
            {pubLabel}
          </time>
        ) : null}
      </div>
    </article>
  )
}

export function ListenLpWhatsNewSamples({ picks }: Props) {
  const [activeLyricsId, setActiveLyricsId] = useState<string | null>(null)
  const [embedKeys, setEmbedKeys] = useState<Record<string, number>>({})
  const [playingById, setPlayingById] = useState<Record<string, boolean>>({})
  const widgetRef = useRef<SoundCloudWidget | null>(null)
  const activeLyricsIdRef = useRef<string | null>(null)

  useEffect(() => {
    activeLyricsIdRef.current = activeLyricsId
  }, [activeLyricsId])

  useEffect(() => {
    if (!picks.length) {
      setActiveLyricsId(null)
      setPlayingById({})
      widgetRef.current = null
    }
  }, [picks])

  const bumpEmbedKey = useCallback((lyricsId: string) => {
    setEmbedKeys((prev) => ({ ...prev, [lyricsId]: (prev[lyricsId] ?? 0) + 1 }))
  }, [])

  const handlePlay = useCallback(
    (pick: ListenLpWhatsNewPick) => {
      const { lyricsId } = pick
      const sameCard = lyricsId === activeLyricsIdRef.current

      if (sameCard) {
        if (!widgetRef.current) {
          bumpEmbedKey(lyricsId)
          return
        }
        const playing = playingById[lyricsId]
        try {
          if (playing) {
            widgetRef.current.pause()
          } else {
            widgetRef.current.play()
          }
        } catch {
          bumpEmbedKey(lyricsId)
        }
        return
      }

      widgetRef.current = null
      setPlayingById({})
      setActiveLyricsId(lyricsId)
      bumpEmbedKey(lyricsId)

      if (pick.catalogTrack) {
        trackCatalogPlayStarted(pick.catalogTrack, 'single', 'user_pick', LISTEN_MODE)
      }
    },
    [bumpEmbedKey, playingById],
  )

  const handlePlayingChange = useCallback((lyricsId: string, playing: boolean) => {
    if (activeLyricsIdRef.current !== lyricsId) return
    setPlayingById((prev) => ({ ...prev, [lyricsId]: playing }))
  }, [])

  const handleWidgetReady = useCallback((lyricsId: string, widget: SoundCloudWidget | null) => {
    if (activeLyricsIdRef.current !== lyricsId) return
    widgetRef.current = widget
  }, [])

  if (!picks.length) return null

  return (
    <ul className="listen-lp__whats-new-grid" aria-label="Latest songs to sample">
      {picks.map((pick) => {
        const isActive = pick.lyricsId === activeLyricsId
        const isPlaying = Boolean(playingById[pick.lyricsId])
        return (
          <li key={pick.lyricsId} className="listen-lp__whats-new-grid__cell">
            <ListenLpSampleCard
              pick={pick}
              isActive={isActive}
              isPlaying={isPlaying}
              embedKey={embedKeys[pick.lyricsId] ?? 0}
              onPlay={() => handlePlay(pick)}
              onPlayingChange={(playing) => handlePlayingChange(pick.lyricsId, playing)}
              onWidgetReady={(widget) => handleWidgetReady(pick.lyricsId, widget)}
            />
          </li>
        )
      })}
    </ul>
  )
}
