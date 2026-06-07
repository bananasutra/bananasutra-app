import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent, MouseEvent } from 'react'
import { Link } from 'react-router-dom'
import type { AnalyticsMode } from '../lib/analytics'
import {
  trackCatalogPlayAllStarted,
  trackCatalogPlayAllStopped,
  trackCatalogPlayStarted,
  trackCatalogQueueAdvanced,
  type PlaybackIntent,
} from './catalogAnalytics'
import { LazySoundCloudEmbed } from './LazySoundCloudEmbed'
import { PLAY_ALL_DESKTOP_MEDIA_QUERY, usePlayAllDesktopAvailable } from './playAllPlatform'
import { songCatalogPath } from './songPaths'
import { coverImageUrl } from '../seo/imageUrl'
import { bindSoundCloudWidgetPlayback } from './soundCloudWidgetPlayback'
import { formatDurationDisplay } from './durationFormat'
import { sutraClassName } from './sutraTheme'
import type { TrackCatalogItem } from './types'
import { type SoundCloudWidget } from './soundcloudWidgetApi'
import './TracksPage.css'

const LISTEN_MODE: AnalyticsMode = 'listen'
const QUEUE_SOURCE = 'listen_lp' as const

function thumbSrc(url: string): string {
  const u = url.trim()
  if (!u) return ''
  return u.replace(/-t\d+x\d+\./i, '-t200x200.').replace(/-toriginal\./i, '-t200x200.')
}

function genreLine(t: TrackCatalogItem): string {
  const parts = [t.primary_genre, ...(t.secondary_genres ?? [])].map((s) => s.trim()).filter(Boolean)
  return [...new Set(parts)].slice(0, 4).join(' · ')
}

type Props = {
  tracks: TrackCatalogItem[]
}

export function ListenLpTopTracks({ tracks }: Props) {
  const playAllDesktopAvailable = usePlayAllDesktopAvailable()
  const [selectedId, setSelectedId] = useState<string | null>(() => tracks[0]?.track_id ?? null)
  const [embedReloadKey, setEmbedReloadKey] = useState(0)
  const [scAutoplay, setScAutoplay] = useState(false)
  const [isScPlaying, setIsScPlaying] = useState(false)
  const [playAllActive, setPlayAllActive] = useState(false)
  const [embedHeight, setEmbedHeight] = useState(180)

  const playAllActiveRef = useRef(false)
  const isScPlayingRef = useRef(false)
  const playerWrapRef = useRef<HTMLDivElement>(null)
  const scWidgetRef = useRef<SoundCloudWidget | null>(null)
  const tracksRef = useRef(tracks)
  const selectedIdRef = useRef<string | null>(selectedId)
  const playbackIntentRef = useRef<PlaybackIntent>('user_pick')
  const skipScAutoplayOffOnNextSelectionChange = useRef(false)

  useEffect(() => {
    tracksRef.current = tracks
  }, [tracks])
  useEffect(() => {
    playAllActiveRef.current = playAllActive
  }, [playAllActive])
  useEffect(() => {
    isScPlayingRef.current = isScPlaying
  }, [isScPlaying])
  useEffect(() => {
    selectedIdRef.current = selectedId
  }, [selectedId])

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)')
    const apply = () => setEmbedHeight(mq.matches ? 140 : 180)
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])

  useEffect(() => {
    if (!tracks.length) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clear player when track list empties
      setSelectedId(null)
      setScAutoplay(false)
      setIsScPlaying(false)
      setPlayAllActive(false)
      return
    }
    setSelectedId((prev) => {
      if (prev && tracks.some((t) => t.track_id === prev)) return prev
      return tracks[0]?.track_id ?? null
    })
  }, [tracks])

  useEffect(() => {
    if (skipScAutoplayOffOnNextSelectionChange.current) {
      skipScAutoplayOffOnNextSelectionChange.current = false
      return
    }
    setScAutoplay(false)
    setIsScPlaying(false)
  }, [selectedId])

  const selected = useMemo(
    () => tracks.find((t) => t.track_id === selectedId) ?? tracks[0],
    [tracks, selectedId],
  )
  const queueIndex = selected?.track_id ? tracks.findIndex((t) => t.track_id === selected.track_id) : -1

  const pausePlayback = useCallback(() => {
    try {
      scWidgetRef.current?.pause()
    } catch {
      // Ignore widget pause failures.
    }
    setIsScPlaying(false)
  }, [])

  const resumePlayback = useCallback(() => {
    try {
      scWidgetRef.current?.play()
      setScAutoplay(true)
    } catch {
      // Ignore widget play failures.
    }
  }, [])

  const pickTrack = useCallback(
    (t: TrackCatalogItem, { keepPlayAll = false }: { keepPlayAll?: boolean } = {}) => {
      if (t.track_id === selectedIdRef.current && scWidgetRef.current) {
        if (isScPlayingRef.current) {
          pausePlayback()
          return
        }
        resumePlayback()
        return
      }

      if (!keepPlayAll && playAllActiveRef.current) {
        const queue = tracksRef.current
        const idx = queue.findIndex((row) => row.track_id === selectedIdRef.current)
        trackCatalogPlayAllStopped(QUEUE_SOURCE, idx >= 0 ? idx + 1 : 0, queue.length, 'replaced_by_new_queue')
        setPlayAllActive(false)
      }
      const source = playAllActiveRef.current ? QUEUE_SOURCE : 'single'
      trackCatalogPlayStarted(t, source, playbackIntentRef.current, LISTEN_MODE)
      playbackIntentRef.current = 'user_pick'
      skipScAutoplayOffOnNextSelectionChange.current = true
      setScAutoplay(true)
      if (t.track_id === selectedIdRef.current) {
        setEmbedReloadKey((k) => k + 1)
        return
      }
      setSelectedId(t.track_id)
      setEmbedReloadKey((k) => k + 1)
    },
    [pausePlayback, resumePlayback],
  )

  const advanceToNextInQueue = useCallback(() => {
    const queue = tracksRef.current
    const currentId = selectedIdRef.current
    if (!queue.length || !currentId) {
      setPlayAllActive(false)
      return
    }
    const idx = queue.findIndex((t) => t.track_id === currentId)
    if (idx < 0) {
      setPlayAllActive(false)
      return
    }
    const next = queue[idx + 1]
    if (!next) {
      trackCatalogPlayAllStopped(QUEUE_SOURCE, queue.length, queue.length, 'queue_exhausted')
      setPlayAllActive(false)
      return
    }
    const current = queue[idx]
    if (current) {
      trackCatalogQueueAdvanced({
        from: current,
        to: next,
        position: idx + 2,
        total: queue.length,
        source: QUEUE_SOURCE,
        mode: LISTEN_MODE,
      })
    }
    playbackIntentRef.current = 'queue_advance'
    pickTrack(next, { keepPlayAll: true })
  }, [pickTrack])

  const advanceToNextInQueueRef = useRef(advanceToNextInQueue)
  useEffect(() => {
    advanceToNextInQueueRef.current = advanceToNextInQueue
  }, [advanceToNextInQueue])

  const startPlayAll = useCallback(() => {
    if (!window.matchMedia(PLAY_ALL_DESKTOP_MEDIA_QUERY).matches) return
    const queue = tracksRef.current
    if (!queue.length) return
    trackCatalogPlayAllStarted(QUEUE_SOURCE, queue.length, undefined, LISTEN_MODE)
    playbackIntentRef.current = 'play_all_start'
    setPlayAllActive(true)
    pickTrack(queue[0]!, { keepPlayAll: true })
  }, [pickTrack])

  const pausePlayAll = useCallback(() => {
    pausePlayback()
  }, [pausePlayback])

  const resumePlayAll = useCallback(() => {
    resumePlayback()
  }, [resumePlayback])

  const stopPlayAll = useCallback(() => {
    const queue = tracksRef.current
    const idx = queue.findIndex((row) => row.track_id === selectedIdRef.current)
    trackCatalogPlayAllStopped(QUEUE_SOURCE, idx >= 0 ? idx + 1 : 0, queue.length, 'user_stop')
    setPlayAllActive(false)
    pausePlayback()
  }, [pausePlayback])

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
          onPlayingChange: setIsScPlaying,
          onFinish: () => {
            if (!playAllActiveRef.current) return
            advanceToNextInQueueRef.current()
          },
        })
      })
      .catch(() => {
        // Widget API failed to load; Play All becomes manual.
      })
  }, [])

  const rowActivate = (e: MouseEvent | KeyboardEvent, t: TrackCatalogItem) => {
    if ((e.target as HTMLElement).closest('a')) return
    pickTrack(t)
  }

  const rowKeyDown = (e: KeyboardEvent<HTMLDivElement>, t: TrackCatalogItem) => {
    if ((e.target as HTMLElement).closest('a')) return
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      pickTrack(t)
    }
  }

  if (!tracks.length) {
    return (
      <section className="catalog-page-shell__section listen-lp__section" aria-labelledby="listen-lp-tracks-heading">
        <h2 id="listen-lp-tracks-heading" className="catalog-section-title">
          Top 10 tracks
        </h2>
        <p className="listen-lp__section-intro">Quick entry point: ten tracks that people actually returned to.</p>
        <p className="listen-lp__empty">No top tracks in the catalog right now.</p>
        <Link className="catalog-section-cta" to="/tracks/">
          Browse all tracks →
        </Link>
      </section>
    )
  }

  return (
    <section className="catalog-page-shell__section listen-lp__section" aria-labelledby="listen-lp-tracks-heading">
      <h2 id="listen-lp-tracks-heading" className="catalog-section-title">
        Top 10 tracks
      </h2>
      <p className="listen-lp__section-intro">Quick entry point: ten tracks that people actually returned to.</p>

      {selected?.sc_url ? (
        <div className="listen-lp__player-frame" ref={playerWrapRef}>
          <LazySoundCloudEmbed
            scUrl={selected.sc_url}
            title={selected.track_title || 'SoundCloud track'}
            height={embedHeight}
            mode="visual"
            autoPlay={scAutoplay}
            reloadKey={embedReloadKey}
            onLoad={handlePlayerLoad}
          />
        </div>
      ) : null}

      <div className="listen-lp__track-miniplayer">
        <div className="listen-lp__track-miniplayer-header">
          {playAllDesktopAvailable || playAllActive ? (
            playAllActive ? (
              <div className="listen-lp__play-all-controls">
                {isScPlaying ? (
                  <button type="button" className="tracks-page__play-all-btn listen-lp__play-all-btn" onClick={pausePlayAll}>
                    <span className="tracks-page__play-all-glyph" aria-hidden>
                      ❚❚
                    </span>
                    Pause
                  </button>
                ) : (
                  <button type="button" className="tracks-page__play-all-btn listen-lp__play-all-btn" onClick={resumePlayAll}>
                    <span className="tracks-page__play-all-glyph" aria-hidden>
                      ▶
                    </span>
                    Resume
                  </button>
                )}
                <button type="button" className="tracks-page__play-all-btn tracks-page__play-all-btn--stop" onClick={stopPlayAll}>
                  <span className="tracks-page__play-all-glyph" aria-hidden>
                    ■
                  </span>
                  Stop playing all
                </button>
              </div>
            ) : playAllDesktopAvailable && tracks.length > 1 ? (
              <button type="button" className="tracks-page__play-all-btn listen-lp__play-all-btn" onClick={startPlayAll}>
                <span className="tracks-page__play-all-glyph" aria-hidden>
                  ▶
                </span>
                {`Play all ${tracks.length} tracks`}
              </button>
            ) : null
          ) : null}
          {!playAllDesktopAvailable ? (
            <p className="listen-lp__track-miniplayer-honest">
              Play All is desktop-only. Tap a track below, or open a songbook for uninterrupted listening on mobile.
            </p>
          ) : null}
          {playAllDesktopAvailable || playAllActive ? (
            <span className="listen-lp__play-all-status" aria-live="polite">
              {queueIndex >= 0 ? `Top track ${queueIndex + 1} of ${tracks.length}` : `Top track 0 of ${tracks.length}`}
            </span>
          ) : null}
        </div>
        <ol className="listen-lp__track-list" aria-live="polite">
          {tracks.map((t, index) => {
            const active = t.track_id === selected?.track_id
            const showPlayingWave = active && isScPlaying
            const href = songCatalogPath(t.lyrics_title, t.url_slug)
            const cover = coverImageUrl(thumbSrc(t.list_cover_url), { width: 200 })
            const sutraText = (t.sutra || '').trim()
            const metaTail = genreLine(t)
            const metaParts = [metaTail, sutraText].filter(Boolean)
            const durationLabel = formatDurationDisplay(t.duration_raw)
            return (
              <li key={t.track_id} className="listen-lp__track-item">
                <div
                  role="button"
                  tabIndex={0}
                  className={`listen-lp__track-row${active ? ' listen-lp__track-row--active' : ''}`}
                  onClick={(e) => rowActivate(e, t)}
                  onKeyDown={(e) => rowKeyDown(e, t)}
                  aria-current={active ? 'true' : undefined}
                >
                  <span className="listen-lp__track-rank">{index + 1}</span>
                  {cover ? (
                    <span className="listen-lp__track-art-wrap">
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
                    <span className="listen-lp__track-art listen-lp__track-art--empty" aria-hidden />
                  )}
                  <div className="listen-lp__track-body">
                    <p className="listen-lp__track-title">{t.track_title}</p>
                    {metaParts.length ? (
                      <p className="listen-lp__track-meta">
                        {sutraText ? (
                          <span className={`catalog-sutra-word ${sutraClassName(sutraText)}`}>{sutraText}</span>
                        ) : null}
                        {metaTail ? <span>{sutraText ? ` · ${metaTail}` : metaTail}</span> : null}
                      </p>
                    ) : null}
                  </div>
                  <span className="listen-lp__track-play" aria-hidden>
                    {active && isScPlaying ? '❚❚' : '▶'}
                  </span>
                  {durationLabel ? <span className="listen-lp__track-duration">{durationLabel}</span> : null}
                  <Link className="listen-lp__track-song-link catalog-song-page-cta" to={href} onClick={(e) => e.stopPropagation()}>
                    Song page
                  </Link>
                </div>
              </li>
            )
          })}
        </ol>
      </div>

      <Link className="catalog-section-cta" to="/tracks/">
        Browse all tracks →
      </Link>
    </section>
  )
}
