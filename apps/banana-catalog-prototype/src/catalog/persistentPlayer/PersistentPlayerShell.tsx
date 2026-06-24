import { useEffect, useMemo, useRef, useState, type CSSProperties, type MutableRefObject, type RefObject } from 'react'
import { Link } from 'react-router-dom'
import { queueContextLine } from '../playerQueue/queueContextLine'
import {
  playableTrackGenreDuration,
  playableTrackSongLabel,
  playableTrackSongLinkTo,
  playableTrackSutraHref,
  playableTrackSutraLabel,
} from '../playerQueue/playableTrackMetadata'
import { usePlayerQueue } from '../playerQueue/usePlayerQueue'
import { currentQueueTrack } from '../playerQueue/types'
import { sutraQuestionFromDisplay } from '../sutraContext'
import { sutraClassName } from '../sutraTheme'
import { PersistentSoundCloudPlayer } from './PersistentSoundCloudPlayer'
import { PersistentPlayerLyricsPanel } from './PersistentPlayerLyricsPanel'
import type { PersistentScPlayerApi } from './persistentScPlayerContext'
import type { SoundCloudWidget } from '../soundcloudWidgetApi'
import './PersistentPlayerBar.css'

export type PersistentPlayerShellProps = {
  apiRef: MutableRefObject<PersistentScPlayerApi | null>
  widgetRef: MutableRefObject<SoundCloudWidget | null>
  embedWrapRef: RefObject<HTMLDivElement | null>
}

function barSessionActive(state: ReturnType<typeof usePlayerQueue>['state']): boolean {
  return (
    state.playAllActive ||
    state.playing ||
    (state.tracks.length > 0 && state.source != null)
  )
}

function MetaSep() {
  return <span className="persistent-player-bar__sep" aria-hidden> · </span>
}

/**
 * W-025 desktop shell — compact toolbar + SC compact embed (cover/title/waveform in iframe).
 */
export function PersistentPlayerShell({ apiRef, widgetRef, embedWrapRef }: PersistentPlayerShellProps) {
  const { state, actions } = usePlayerQueue()
  const visible = barSessionActive(state)
  const [scrubOpen, setScrubOpen] = useState(false)
  const [lyricsOpen, setLyricsOpen] = useState(false)
  const prevTrackIdRef = useRef<string | null>(null)

  const track = currentQueueTrack(state)
  const contextLine = useMemo(() => queueContextLine(state), [state])
  const genreDuration = useMemo(() => (track ? playableTrackGenreDuration(track) : ''), [track])
  const songLinkTo = track ? playableTrackSongLinkTo(track) : null
  const songLabel = track ? playableTrackSongLabel(track) : ''
  const sutraHref = track ? playableTrackSutraHref(track) : null
  const sutraLabel = track ? playableTrackSutraLabel(track) : ''
  const hasLyrics = Boolean(track?.lyrics_id?.trim())

  const canGoPrevious = state.position > 0
  const canGoNext = state.position >= 0 && state.position < state.tracks.length - 1
  const dismissLabel = state.playAllActive ? 'Close and stop playing all' : 'Close player'

  const hasTrackMeta = Boolean(sutraHref || songLinkTo || genreDuration)

  useEffect(() => {
    if (visible) {
      document.body.classList.add('has-persistent-player')
      document.documentElement.style.setProperty('--bbb-panel-bottom-offset', '44px')
    } else {
      document.body.classList.remove('has-persistent-player')
      document.documentElement.style.setProperty('--bbb-panel-bottom-offset', '0px')
    }
    return () => {
      document.body.classList.remove('has-persistent-player')
      document.documentElement.style.setProperty('--bbb-panel-bottom-offset', '0px')
    }
  }, [visible])

  useEffect(() => {
    setScrubOpen(false)
  }, [track?.track_id])

  useEffect(() => {
    if (!track) return
    const trackId = track.track_id
    if (prevTrackIdRef.current !== trackId) {
      setLyricsOpen(false)
      prevTrackIdRef.current = trackId
    }
  }, [track])

  return (
    <div
      className={`persistent-player-shell${visible ? ' persistent-player-shell--visible' : ''}`}
      aria-hidden={!visible}
    >
      {track && lyricsOpen ? (
        <PersistentPlayerLyricsPanel track={track} open={lyricsOpen} />
      ) : null}
      <aside
        className={`persistent-player-bar${scrubOpen ? ' persistent-player-bar--scrub-open' : ''}`}
        aria-label="Now playing"
        style={{ '--persistent-sc-player-min-width': '480px' } as CSSProperties}
      >
        <div className="persistent-player-bar__toolbar">
          <div className="persistent-player-bar__meta">
            {contextLine ? (
              <p className="persistent-player-bar__context">{contextLine}</p>
            ) : null}
            {track && hasTrackMeta ? (
              <p className="persistent-player-bar__track-meta">
                {songLinkTo && songLabel ? (
                  <>
                    <Link to={songLinkTo} className="persistent-player-bar__song-link">
                      {songLabel}
                    </Link>
                    {(sutraHref || genreDuration) && <MetaSep />}
                  </>
                ) : songLabel && !songLinkTo ? (
                  <>
                    <span className="persistent-player-bar__song-label">{songLabel}</span>
                    {(sutraHref || genreDuration) && <MetaSep />}
                  </>
                ) : null}
                {sutraHref && sutraLabel ? (
                  <>
                    <Link
                      to={sutraHref}
                      className={`persistent-player-bar__sutra catalog-facet-sutra-name ${sutraClassName(sutraLabel)}`}
                      title={sutraQuestionFromDisplay(sutraLabel)}
                    >
                      {sutraLabel}
                    </Link>
                    {genreDuration ? <MetaSep /> : null}
                  </>
                ) : null}
                {genreDuration ? (
                  <span className="persistent-player-bar__stats">{genreDuration}</span>
                ) : null}
              </p>
            ) : null}
          </div>
          <div className="persistent-player-bar__actions">
            <div className="persistent-player-bar__transport" role="group" aria-label="Playback">
              <button
                type="button"
                className="persistent-player-bar__transport-btn persistent-player-bar__transport-btn--prev"
                onClick={() => actions.jump(-1)}
                disabled={!canGoPrevious}
                aria-label="Previous track"
              >
                <span aria-hidden>⏮</span>
              </button>
              {state.playing ? (
                <button
                  type="button"
                  className="persistent-player-bar__transport-btn persistent-player-bar__transport-btn--play"
                  onClick={() => actions.pause()}
                  aria-label="Pause"
                >
                  <span aria-hidden>⏸</span>
                </button>
              ) : (
                <button
                  type="button"
                  className="persistent-player-bar__transport-btn persistent-player-bar__transport-btn--play"
                  onClick={() => actions.resume()}
                  aria-label="Resume"
                >
                  <span aria-hidden>▶</span>
                </button>
              )}
              <button
                type="button"
                className="persistent-player-bar__transport-btn persistent-player-bar__transport-btn--next"
                onClick={() => actions.jump(1)}
                disabled={!canGoNext}
                aria-label="Next track"
              >
                <span aria-hidden>⏭</span>
              </button>
            </div>
            <button
              type="button"
              className={`persistent-player-bar__scrub-btn${scrubOpen ? ' persistent-player-bar__scrub-btn--active' : ''}`}
              onClick={() => setScrubOpen((prev) => !prev)}
              aria-label={scrubOpen ? 'Hide waveform' : 'Show waveform scrubber'}
              aria-pressed={scrubOpen}
              aria-controls="persistent-player-embed"
              aria-expanded={scrubOpen}
            >
              <span aria-hidden>≋</span> scrub
            </button>
            {hasLyrics ? (
              <button
                type="button"
                className={`persistent-player-bar__lyrics-btn${lyricsOpen ? ' persistent-player-bar__lyrics-btn--active' : ''}`}
                onClick={() => setLyricsOpen((prev) => !prev)}
                aria-label={lyricsOpen ? 'Hide lyrics' : 'Show lyrics'}
                aria-pressed={lyricsOpen}
              >
                <span aria-hidden>♪</span> lyrics
              </button>
            ) : null}
            <button
              type="button"
              className="persistent-player-bar__dismiss-btn"
              onClick={() => actions.stop()}
              aria-label={dismissLabel}
              title={dismissLabel}
            >
              <span className="persistent-player-bar__dismiss-icon" aria-hidden>
                ×
              </span>
            </button>
          </div>
        </div>
        <div id="persistent-player-embed" ref={embedWrapRef} className="persistent-player-bar__embed">
          <PersistentSoundCloudPlayer apiRef={apiRef} widgetRef={widgetRef} />
        </div>
      </aside>
    </div>
  )
}
