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
import { CompactTopTrackRow, trackListThumbSrc } from './CompactTopTrackRow'
import { ShareButton } from './ShareButton'
import { songShareUrl, trackShareUrl } from './shareUrl'
import { ScrollRevealSection } from './ScrollRevealSection'
import { isPlayAllDesktopDevice, usePlayAllDesktopAvailable } from './playAllPlatform'
import { songCatalogPath } from './songPaths'
import { coverImageUrl } from '../seo/imageUrl'
import { bindSoundCloudWidgetPlayback } from './soundCloudWidgetPlayback'
import { formatDurationDisplay } from './durationFormat'
import { sutraClassName } from './sutraTheme'
import type { ListenLpEpPick } from './listenLpData'
import type { TrackCatalogItem } from './types'
import { type SoundCloudWidget } from './soundcloudWidgetApi'
import './TracksPage.css'

const LISTEN_MODE: AnalyticsMode = 'listen'
const QUEUE_SOURCE = 'listen_lp' as const
const SC_EMBED_HEIGHT_EP_PLAYLIST = 420

type PlayerTab = 'tracks' | 'eps'

type Props = {
  tracks: TrackCatalogItem[]
  eps: ListenLpEpPick[]
  epDurationByUrl?: Map<string, string>
  epGenresByUrl?: Map<string, string>
  epTrackCountByUrl?: Map<string, number>
}

export function ListenLpTopTracks({
  tracks,
  eps,
  epDurationByUrl,
  epGenresByUrl,
  epTrackCountByUrl,
}: Props) {
  const playAllDesktopAvailable = usePlayAllDesktopAvailable()
  const [playerTab, setPlayerTab] = useState<PlayerTab>('tracks')
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(() => tracks[0]?.track_id ?? null)
  const [selectedEpUrl, setSelectedEpUrl] = useState<string | null>(() => eps[0]?.ep_url ?? null)
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
  const selectedTrackIdRef = useRef<string | null>(selectedTrackId)
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
    selectedTrackIdRef.current = selectedTrackId
  }, [selectedTrackId])

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)')
    const apply = () => setEmbedHeight(mq.matches ? 120 : 160)
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])

  useEffect(() => {
    if (!tracks.length) {
      setSelectedTrackId(null)
      return
    }
    setSelectedTrackId((prev) => {
      if (prev && tracks.some((t) => t.track_id === prev)) return prev
      return tracks[0]?.track_id ?? null
    })
  }, [tracks])

  useEffect(() => {
    if (!eps.length) return
    setSelectedEpUrl((prev) => {
      if (prev && eps.some((e) => e.ep_url === prev)) return prev
      return eps[0]?.ep_url ?? null
    })
  }, [eps])

  const selectedTrack = useMemo(
    () => tracks.find((t) => t.track_id === selectedTrackId) ?? tracks[0],
    [tracks, selectedTrackId],
  )
  const selectedEp = useMemo(
    () => eps.find((e) => e.ep_url === selectedEpUrl) ?? eps[0],
    [eps, selectedEpUrl],
  )

  const activeScUrl =
    playerTab === 'tracks' ? (selectedTrack?.sc_url || '').trim() : (selectedEp?.ep_url || '').trim()
  const activeTitle =
    playerTab === 'tracks'
      ? selectedTrack?.lyrics_title || selectedTrack?.track_title || 'SoundCloud track'
      : selectedEp?.ep_title || 'SoundCloud EP'
  const activeIsSongPlaylist = playerTab === 'eps' && activeScUrl.includes('/sets/')
  const activeEpDuration =
    playerTab === 'eps' && activeScUrl && epDurationByUrl ? epDurationByUrl.get(activeScUrl) ?? '' : ''
  const activeEpTrackCount =
    playerTab === 'eps' && activeScUrl && epTrackCountByUrl ? epTrackCountByUrl.get(activeScUrl) ?? 0 : 0
  const embedMode = activeIsSongPlaylist ? 'list' : 'visual'
  const resolvedEmbedHeight = activeIsSongPlaylist ? SC_EMBED_HEIGHT_EP_PLAYLIST : embedHeight

  useEffect(() => {
    if (skipScAutoplayOffOnNextSelectionChange.current) {
      skipScAutoplayOffOnNextSelectionChange.current = false
      return
    }
    setScAutoplay(false)
    setIsScPlaying(false)
  }, [selectedTrackId, selectedEpUrl, playerTab])

  const queueIndex =
    playerTab === 'tracks' && selectedTrack?.track_id
      ? tracks.findIndex((t) => t.track_id === selectedTrack.track_id)
      : -1

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
      if (t.track_id === selectedTrackIdRef.current && scWidgetRef.current) {
        if (isScPlayingRef.current) {
          pausePlayback()
          return
        }
        resumePlayback()
        return
      }

      if (!keepPlayAll && playAllActiveRef.current) {
        const queue = tracksRef.current
        const idx = queue.findIndex((row) => row.track_id === selectedTrackIdRef.current)
        trackCatalogPlayAllStopped(QUEUE_SOURCE, idx >= 0 ? idx + 1 : 0, queue.length, 'replaced_by_new_queue')
        setPlayAllActive(false)
      }
      const source = playAllActiveRef.current ? QUEUE_SOURCE : 'single'
      trackCatalogPlayStarted(t, source, playbackIntentRef.current, LISTEN_MODE)
      playbackIntentRef.current = 'user_pick'
      skipScAutoplayOffOnNextSelectionChange.current = true
      setScAutoplay(true)
      if (t.track_id === selectedTrackIdRef.current) {
        setEmbedReloadKey((k) => k + 1)
        return
      }
      setSelectedTrackId(t.track_id)
      setEmbedReloadKey((k) => k + 1)
    },
    [pausePlayback, resumePlayback],
  )

  const pickEp = useCallback(
    (ep: ListenLpEpPick) => {
      if (ep.ep_url === selectedEpUrl && scWidgetRef.current) {
        if (isScPlayingRef.current) {
          pausePlayback()
          return
        }
        resumePlayback()
        return
      }
      setPlayAllActive(false)
      skipScAutoplayOffOnNextSelectionChange.current = true
      setScAutoplay(true)
      if (ep.ep_url === selectedEpUrl) {
        setEmbedReloadKey((k) => k + 1)
        return
      }
      setSelectedEpUrl(ep.ep_url)
      setEmbedReloadKey((k) => k + 1)
    },
    [pausePlayback, resumePlayback, selectedEpUrl],
  )

  const advanceToNextInQueue = useCallback(() => {
    const queue = tracksRef.current
    const currentId = selectedTrackIdRef.current
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
    if (!isPlayAllDesktopDevice()) return
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
    const idx = queue.findIndex((row) => row.track_id === selectedTrackIdRef.current)
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
            if (!playAllActiveRef.current || playerTab !== 'tracks') return
            advanceToNextInQueueRef.current()
          },
        })
      })
      .catch(() => {
        // Widget API failed to load; Play All becomes manual.
      })
  }, [playerTab])

  const switchTab = (tab: PlayerTab) => {
    setPlayAllActive(false)
    setPlayerTab(tab)
    setEmbedReloadKey((k) => k + 1)
  }

  const rowActivate = (e: MouseEvent | KeyboardEvent, t: TrackCatalogItem) => {
    if ((e.target as HTMLElement).closest('a, button')) return
    pickTrack(t)
  }

  const rowKeyDown = (e: KeyboardEvent<HTMLDivElement>, t: TrackCatalogItem) => {
    if ((e.target as HTMLElement).closest('a, button')) return
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      pickTrack(t)
    }
  }

  const epRowActivate = (e: MouseEvent | KeyboardEvent, ep: ListenLpEpPick) => {
    if ((e.target as HTMLElement).closest('a, button')) return
    pickEp(ep)
  }

  const epRowKeyDown = (e: KeyboardEvent<HTMLDivElement>, ep: ListenLpEpPick) => {
    if ((e.target as HTMLElement).closest('a, button')) return
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      pickEp(ep)
    }
  }

  const hasTracks = tracks.length > 0
  const hasEps = eps.length > 0

  if (!hasTracks && !hasEps) {
    return (
      <ScrollRevealSection immediate className="listen-lp__section" aria-labelledby="listen-lp-tracks-heading">
        <h2 id="listen-lp-tracks-heading" className="catalog-section-title">
          What&apos;s popular?
        </h2>
        <p className="listen-lp__empty">No popular tracks in the catalog right now.</p>
        <Link className="catalog-section-cta" to="/tracks/">
          Listen to all top tracks →
        </Link>
      </ScrollRevealSection>
    )
  }

  return (
    <ScrollRevealSection immediate className="listen-lp__section" aria-labelledby="listen-lp-tracks-heading">
      <h2 id="listen-lp-tracks-heading" className="catalog-section-title">
        What&apos;s popular?
      </h2>

      <div className="listen-lp__popular-player">
        <div className="song-detail-tabs listen-lp__popular-tabs" role="tablist" aria-label="Popular listening">
          <button
            type="button"
            role="tab"
            id="listen-lp-tab-tracks"
            aria-selected={playerTab === 'tracks'}
            aria-controls="listen-lp-panel-tracks"
            className={`song-detail-tab${playerTab === 'tracks' ? ' is-active' : ''}`}
            disabled={!hasTracks}
            onClick={() => switchTab('tracks')}
          >
            Top 10 tracks
          </button>
          <button
            type="button"
            role="tab"
            id="listen-lp-tab-eps"
            aria-selected={playerTab === 'eps'}
            aria-controls="listen-lp-panel-eps"
            className={`song-detail-tab${playerTab === 'eps' ? ' is-active' : ''}`}
            disabled={!hasEps}
            onClick={() => switchTab('eps')}
          >
            Top 10 songs
          </button>
        </div>

        {activeScUrl ? (
          <>
            {activeIsSongPlaylist ? (
              <p className="listen-lp__player-playlist-meta">
                Full song EP
                {activeEpDuration ? ` · ${activeEpDuration}` : ''}
                {activeEpTrackCount > 0 ? ` · ${activeEpTrackCount} tracks` : ''}
              </p>
            ) : null}
            <div
              className={`listen-lp__player-frame listen-lp__player-frame--compact${activeIsSongPlaylist ? ' listen-lp__player-frame--playlist' : ''}`}
              ref={playerWrapRef}
            >
              <LazySoundCloudEmbed
                scUrl={activeScUrl}
                title={activeTitle}
                height={resolvedEmbedHeight}
                mode={embedMode}
                autoPlay={scAutoplay}
                reloadKey={embedReloadKey}
                onLoad={handlePlayerLoad}
              />
            </div>
          </>
        ) : null}

        <div className="listen-lp__track-miniplayer">
          <div className="listen-lp__track-miniplayer-header">
            {playerTab === 'tracks' && (playAllDesktopAvailable || playAllActive) ? (
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
            {!playAllDesktopAvailable && playerTab === 'tracks' ? (
              <p className="listen-lp__track-miniplayer-honest">
                Play All is desktop-only. Tap a track below, or open a songbook for uninterrupted listening on mobile.
              </p>
            ) : null}
            {playerTab === 'tracks' && (playAllDesktopAvailable || playAllActive) ? (
              <span className="listen-lp__play-all-status" aria-live="polite">
                {queueIndex >= 0 ? `Track ${queueIndex + 1} of ${tracks.length}` : `Track 0 of ${tracks.length}`}
              </span>
            ) : null}
          </div>

          {playerTab === 'tracks' && hasTracks ? (
            <div
              id="listen-lp-panel-tracks"
              role="tabpanel"
              aria-labelledby="listen-lp-tab-tracks"
              aria-live="polite"
            >
              <ol className="listen-lp__track-list">
              {tracks.map((t, index) => {
                const active = t.track_id === selectedTrack?.track_id
                const songTitle = (t.lyrics_title || t.track_title || '').trim()
                return (
                  <CompactTopTrackRow
                    key={t.track_id}
                    rank={index + 1}
                    active={active}
                    coverUrl={t.list_cover_url}
                    title={songTitle}
                    songLinkTo={songCatalogPath(t.lyrics_title, t.url_slug)}
                    shareUrl={trackShareUrl(t.lyrics_title, t.url_slug, t.track_id)}
                    sutraText={t.sutra}
                    genreText={t.primary_genre}
                    durationLabel={formatDurationDisplay(t.duration_raw)}
                    showPlayingWave={active && isScPlaying}
                    onActivate={(e) => rowActivate(e, t)}
                    onKeyDown={(e) => rowKeyDown(e, t)}
                  />
                )
              })}
              </ol>
            </div>
          ) : null}

          {playerTab === 'eps' && hasEps ? (
            <div
              id="listen-lp-panel-eps"
              role="tabpanel"
              aria-labelledby="listen-lp-tab-eps"
              aria-live="polite"
            >
              <ol className="listen-lp__track-list">
              {eps.map((ep, index) => {
                const active = ep.ep_url === selectedEp?.ep_url
                const showPlayingWave = active && isScPlaying
                const href = songCatalogPath(ep.lyrics_title, ep.url_slug)
                const cover = coverImageUrl(trackListThumbSrc(ep.cover_url), { width: 200 })
                const epUrl = (ep.ep_url || '').trim()
                const sutraText = (ep.sutra || '').trim()
                const genreText = epGenresByUrl?.get(epUrl) ?? ''
                const durationLabel = epDurationByUrl?.get(epUrl) ?? ''
                return (
                  <li key={ep.ep_url} className="listen-lp__track-item">
                    <div
                      role="button"
                      tabIndex={0}
                      className={`listen-lp__track-row listen-lp__track-row--compact${active ? ' listen-lp__track-row--active' : ''}`}
                      onClick={(e) => epRowActivate(e, ep)}
                      onKeyDown={(e) => epRowKeyDown(e, ep)}
                      aria-current={active ? 'true' : undefined}
                    >
                      <span className="listen-lp__track-rank">{index + 1}</span>
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
                          to={href}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {ep.ep_title}
                        </Link>
                        {sutraText || genreText ? (
                          <p className="listen-lp__track-meta">
                            {sutraText ? (
                              <span className={`catalog-sutra-word ${sutraClassName(sutraText)}`}>{sutraText}</span>
                            ) : null}
                            {genreText ? <span>{sutraText ? ` · ${genreText}` : genreText}</span> : null}
                          </p>
                        ) : null}
                      </div>
                      <span className="listen-lp__track-play" aria-hidden>
                        {active && isScPlaying ? '❚❚' : '▶'}
                      </span>
                      {durationLabel ? <span className="listen-lp__track-duration">{durationLabel}</span> : null}
                      <ShareButton
                        variant="icon"
                        url={songShareUrl(ep.lyrics_title, ep.url_slug)}
                        title={ep.ep_title}
                        text="Listen on Bananasutra"
                      />
                    </div>
                  </li>
                )
              })}
            </ol>
            </div>
          ) : null}

          {playerTab === 'eps' && !hasEps ? (
            <p className="listen-lp__empty listen-lp__empty--inset">No EP playlists ranked yet.</p>
          ) : null}
        </div>
      </div>

      <Link className="catalog-section-cta" to="/tracks/">
        Listen to all top tracks →
      </Link>
    </ScrollRevealSection>
  )
}
