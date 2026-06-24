import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { loadSongDetail } from '../generatedData'
import { playableTrackSongLabel, playableTrackSongLinkTo } from '../playerQueue/playableTrackMetadata'
import type { PlayableTrack } from '../playerQueue/types'
import './PersistentPlayerLyricsPanel.css'

const lyricsCache = new Map<string, string | null>()

type LyricsPanelProps = {
  track: PlayableTrack
  open: boolean
}

export function PersistentPlayerLyricsPanel({ track, open }: LyricsPanelProps) {
  const [lyrics, setLyrics] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const songLinkTo = playableTrackSongLinkTo(track)
  const songLabel = playableTrackSongLabel(track)
  const lyricsId = track.lyrics_id?.trim()

  useEffect(() => {
    if (!open || !lyricsId) return

    const cached = lyricsCache.get(lyricsId)
    if (cached !== undefined) {
      setLyrics(cached)
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    void loadSongDetail()
      .then((detailMap) => {
        if (cancelled) return
        const text = (detailMap[lyricsId]?.lyrics_text ?? '').trim() || null
        lyricsCache.set(lyricsId, text)
        setLyrics(text)
        setLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [open, lyricsId])

  if (!open) return null

  return (
    <div
      className="persistent-player-lyrics"
      aria-label="Lyrics"
      role="region"
      aria-live="polite"
    >
      <div className="persistent-player-lyrics__header">
        <p className="persistent-player-lyrics__title">{songLabel}</p>
        {songLinkTo ? (
          <Link to={songLinkTo} className="persistent-player-lyrics__song-link">
            Full song page →
          </Link>
        ) : null}
      </div>
      <div className="persistent-player-lyrics__body">
        {loading ? (
          <span className="persistent-player-lyrics__loading">Loading lyrics…</span>
        ) : lyrics ? (
          <pre className="persistent-player-lyrics__text">{lyrics}</pre>
        ) : (
          <span className="persistent-player-lyrics__empty">No lyrics available for this track.</span>
        )}
      </div>
    </div>
  )
}
