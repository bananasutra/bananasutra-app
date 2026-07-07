import type { MouseEvent } from 'react'
import { Link } from 'react-router-dom'
import { trackBertrandOpen } from '../lib/analytics'
import { sutraClassName } from './sutraTheme'
import { sutraHrefFromSongSutraField } from './sutraPageUtils'
import { buildBrowsePathForFacet } from './urlState'

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
      <div className="song-detail-bertrand__option">
        <p id="song-bertrand-heading" className="song-detail-bertrand__headline">
          More like this? Ask Bertrand for the next song.{' '}
          <a className="catalog-bertrand-cta song-detail-bertrand__cta" href="#bertrand" onClick={handleOpen}>
            Ask Bertrand →
          </a>
        </p>
      </div>
      {sutraTrimmed ? (
        <>
          <div className="song-detail-bertrand__divider" role="separator" aria-hidden="true" />
          <p className="song-detail-bertrand__sub">
            Stay in{' '}
            <Link
              className="song-detail-bertrand__sutra-link"
              to={sutraHrefFromSongSutraField(sutraTrimmed) ?? buildBrowsePathForFacet('sutra', sutraTrimmed)}
            >
              <span className={`catalog-facet-sutra-name ${sutraClassName(sutraTrimmed)}`}>{sutraTrimmed}</span>
            </Link>
            , or drift somewhere else.
          </p>
        </>
      ) : null}
    </aside>
  )
}
