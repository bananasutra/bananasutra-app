import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  LEARN_HUB_LINKS,
  LEARN_MOOD_BUTTONS,
  LEARN_MOOD_RESPONSES,
  pickSongsForMoodKey,
  type LearnMoodKey,
} from './learnLpData'
import { SongThumbCard } from './SongThumbCard'
import { browseRowHasAudioSection, songCatalogLinkTo } from './songPaths'
import type { SongCatalogItem } from './types'

type Props = {
  songCatalog: SongCatalogItem[] | null
}

export function LearnLpMoodEntry({ songCatalog }: Props) {
  const sectionRef = useRef<HTMLElement>(null)
  const [visible, setVisible] = useState(
    () => typeof window === 'undefined' || !('IntersectionObserver' in window),
  )
  const [activeMood, setActiveMood] = useState<LearnMoodKey | null>(null)

  useEffect(() => {
    const node = sectionRef.current
    if (!node || !('IntersectionObserver' in window)) return
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true)
            observer.disconnect()
          }
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -10% 0px' },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  const moodSongs = useMemo(() => {
    if (!activeMood) return null
    return pickSongsForMoodKey(songCatalog, activeMood, 6)
  }, [activeMood, songCatalog])

  const response = activeMood ? LEARN_MOOD_RESPONSES[activeMood] : null

  return (
    <section
      ref={sectionRef}
      className={`catalog-page-shell__section learn-lp__carry${visible ? ' is-visible' : ''}`}
      aria-labelledby="learn-lp-mood-heading"
    >
      <h2 id="learn-lp-mood-heading" className="catalog-section-title">
        Feel it in a song
      </h2>
      <p className="learn-lp__section-intro">Pick the mood. I&apos;ll point you at a sutra and a song.</p>

      <div className="learn-lp__mood-panel">
        <div className="learn-lp__mood-buttons" role="group" aria-label="Mood options">
          {LEARN_MOOD_BUTTONS.map((btn) => (
            <button
              key={btn.key}
              type="button"
              className={`learn-lp__mood-btn${activeMood === btn.key ? ' is-selected' : ''}`}
              data-mood={btn.key}
              aria-pressed={activeMood === btn.key}
              onClick={() => setActiveMood(btn.key)}
            >
              {btn.label}
            </button>
          ))}
        </div>

        {response ? (
          <div className="learn-lp__mood-response" aria-live="polite">
            <p className="learn-lp__mood-response-sutra">{response.sutraLine}</p>
            <p className="learn-lp__mood-response-body">{response.body}</p>
            {response.trap ? <p className="learn-lp__mood-response-body">{response.trap}</p> : null}
            {response.pivot ? (
              <div className="learn-lp__mood-pivot">
                {response.pivot.label ? <p className="learn-lp__mood-pivot-label">{response.pivot.label}</p> : null}
                <p className="learn-lp__mood-pivot-text">
                  {response.pivot.text}
                  {response.pivot.sutraLink ? (
                    <>
                      {' '}
                      <Link to={response.pivot.sutraLink.to}>{response.pivot.sutraLink.label}</Link>
                    </>
                  ) : null}
                  {response.pivot.songLink ? (
                    <>
                      {' · '}
                      <Link to={response.pivot.songLink.to}>{response.pivot.songLink.label}</Link>
                    </>
                  ) : null}
                </p>
              </div>
            ) : null}
            <Link className="learn-lp__mood-cta" to={response.cta.to}>
              {response.cta.label}
            </Link>
          </div>
        ) : null}
      </div>

      {activeMood && moodSongs ? (
        <div className="learn-lp__mood-songs">
          <h3 className="learn-lp__mood-songs-heading">
            {moodSongs.sample.length > 0
              ? `Songs for ${moodSongs.sutraName}`
              : `No songs in catalog for ${moodSongs.sutraName}`}
          </h3>
          {moodSongs.sample.length > 0 ? (
            <ul className="learn-lp__mood-songs-grid">
              {moodSongs.sample.map((song) => (
                <li key={song.lyrics_id} className="learn-lp__mood-songs-cell">
                  <SongThumbCard
                    to={songCatalogLinkTo(song.lyrics_title, song.url_slug, {
                      section: browseRowHasAudioSection(song) ? 'audio' : undefined,
                    })}
                    coverUrl={song.cover_image_url}
                    title={song.lyrics_title}
                    metaLabel={song.sutra}
                    publishedAt={song.published_at}
                  />
                </li>
              ))}
            </ul>
          ) : null}
          {moodSongs.total > 0 ? (
            <Link className="catalog-section-cta learn-lp__mood-songs-cta" to={LEARN_HUB_LINKS.listen}>
              Browse listen →
            </Link>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
