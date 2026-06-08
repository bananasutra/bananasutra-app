import {
  WATCH_LP_SUTRA_FILTER_OPTIONS,
  watchLpFacetStatusText,
  watchLpGenreFilterOptions,
  type WatchLpPlaylistPick,
  type WatchLpSutraFilter,
} from './watchLpData'
import { LISTEN_LP_SUTRA_FILTER_OPTIONS } from './listenLpData'
import './lp-facet-bar.css'

type Props = {
  playlists: WatchLpPlaylistPick[]
  activeSutra: WatchLpSutraFilter
  activeGenre: string
  shownCount: number
  totalCount: number
  onSutraChange: (value: WatchLpSutraFilter) => void
  onGenreChange: (value: string) => void
  onClearSutra: () => void
  onClearGenre: () => void
  onClearAll: () => void
}

function sutraChipLabel(value: WatchLpSutraFilter): string {
  if (value === 'ALL') return 'All questions'
  return LISTEN_LP_SUTRA_FILTER_OPTIONS.find((o) => o.value === value)?.label ?? value
}

export function WatchLpFacetBar({
  playlists,
  activeSutra,
  activeGenre,
  shownCount,
  totalCount,
  onSutraChange,
  onGenreChange,
  onClearSutra,
  onClearGenre,
  onClearAll,
}: Props) {
  const genreOptions = watchLpGenreFilterOptions(playlists)
  const statusText = watchLpFacetStatusText({
    activeSutra,
    activeGenre,
    shownCount,
    totalCount,
  })
  const hasActive = activeSutra !== 'ALL' || activeGenre !== 'ALL'

  return (
    <div className="lp-facet-bar watch-lp__facet-bar" aria-label="Filter playlists">
      {hasActive ? (
        <div className="lp-facet-bar__active">
          <span className="lp-facet-bar__count">Filtered</span>
          {activeSutra !== 'ALL' ? (
            <button type="button" className="lp-facet-bar__pill" onClick={onClearSutra}>
              {sutraChipLabel(activeSutra)}
              <span className="lp-facet-bar__pill-x" aria-hidden>
                ×
              </span>
            </button>
          ) : null}
          {activeGenre !== 'ALL' ? (
            <button type="button" className="lp-facet-bar__pill" onClick={onClearGenre}>
              {activeGenre}
              <span className="lp-facet-bar__pill-x" aria-hidden>
                ×
              </span>
            </button>
          ) : null}
          <button type="button" className="lp-facet-bar__clear" onClick={onClearAll}>
            Clear all
          </button>
        </div>
      ) : null}

      <div className="lp-facet-bar__panel">
        <div className="lp-facet-bar__row">
          <div className="lp-facet-bar__label">Choose a question</div>
          <div className="lp-facet-bar__scroll">
            <div className="lp-facet-bar__chips" role="group" aria-label="Choose a question">
              {WATCH_LP_SUTRA_FILTER_OPTIONS.map((opt) => {
                const on = opt.value === activeSutra
                const isQuestion = opt.value !== 'ALL'
                return (
                  <button
                    key={opt.value}
                    type="button"
                    className={`lp-facet-bar__chip${isQuestion ? ' lp-facet-bar__chip--question' : ''}${on ? ' is-active' : ''}`}
                    aria-pressed={on}
                    onClick={() => {
                      onSutraChange(opt.value)
                      if (opt.value !== 'ALL') onGenreChange('ALL')
                    }}
                  >
                    {opt.label === 'All' ? 'All questions' : opt.label}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
        <div className="lp-facet-bar__row">
          <div className="lp-facet-bar__label">Choose a genre</div>
          <div className="lp-facet-bar__scroll">
            <div className="lp-facet-bar__chips" role="group" aria-label="Choose a genre">
              {genreOptions.map((opt) => {
                const on = opt.value === activeGenre
                return (
                  <button
                    key={opt.value}
                    type="button"
                    className={`lp-facet-bar__chip${on ? ' is-active' : ''}`}
                    aria-pressed={on}
                    onClick={() => {
                      onGenreChange(opt.value)
                      if (opt.value !== 'ALL') onSutraChange('ALL')
                    }}
                  >
                    {opt.label === 'All' ? 'All genres' : opt.label}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>
      <p className="lp-facet-bar__status" aria-live="polite">
        {statusText}
      </p>
    </div>
  )
}
