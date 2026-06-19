import type { MouseEvent } from 'react'
import { trackBertrandOpen } from '../lib/analytics'

type Props = {
  sutra?: string
}

/** W-018b contextual entry — surface: songs_detail_below_lyrics */
export function SongDetailBertrandEntry({ sutra }: Props) {
  const handleOpen = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault()
    trackBertrandOpen({ surface: 'songs_detail_below_lyrics', mode: 'listen' })
    window.dispatchEvent(new CustomEvent('bbb:open', { detail: { reason: 'songs_detail_below_lyrics' } }))
  }

  const sutraTrimmed = (sutra ?? '').trim()

  return (
    <aside className="song-detail-bertrand" aria-labelledby="song-bertrand-heading">
      <p id="song-bertrand-heading" className="song-detail-bertrand__headline">
        More like this? Ask Bertrand for the next song.{' '}
        <a className="song-detail-bertrand__cta" href="#bertrand" onClick={handleOpen}>
          Ask Bertrand →
        </a>
      </p>
      {sutraTrimmed ? (
        <p className="song-detail-bertrand__sub">Stay in {sutraTrimmed}, or drift somewhere else.</p>
      ) : null}
    </aside>
  )
}
