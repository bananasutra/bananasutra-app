import {
  WATCH_LP_SUTRA_FILTER_OPTIONS,
  watchLpFacetStatusText,
  watchLpGenreFilterOptions,
  type WatchLpPlaylistPick,
  type WatchLpSutraFilter,
} from './watchLpData'

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
    <div className="watch-lp__facet-bar" aria-label="Filter playlists">
      {hasActive ? (
        <div className="watch-lp__facet-active">
          <span className="watch-lp__facet-count">Filtered</span>
          {activeSutra !== 'ALL' ? (
            <button type="button" className="watch-lp__facet-pill" onClick={onClearSutra}>
              {activeSutra}
              <span className="watch-lp__facet-pill-x" aria-hidden>
                ×
              </span>
            </button>
          ) : null}
          {activeGenre !== 'ALL' ? (
            <button type="button" className="watch-lp__facet-pill" onClick={onClearGenre}>
              {activeGenre}
              <span className="watch-lp__facet-pill-x" aria-hidden>
                ×
              </span>
            </button>
          ) : null}
          <button type="button" className="watch-lp__facet-clear" onClick={onClearAll}>
            Clear all
          </button>
        </div>
      ) : null}

      <div className="watch-lp__facet-panel">
        <div className="watch-lp__facet-row">
          <div className="watch-lp__facet-label">Guiding question</div>
          <div className="watch-lp__facet-chips" role="group" aria-label="Guiding question">
            {WATCH_LP_SUTRA_FILTER_OPTIONS.map((opt) => {
              const on = opt.value === activeSutra
              return (
                <button
                  key={opt.value}
                  type="button"
                  className={`watch-lp__facet-chip${on ? ' is-active' : ''}`}
                  aria-pressed={on}
                  onClick={() => {
                    onSutraChange(opt.value)
                    if (opt.value !== 'ALL') onGenreChange('ALL')
                  }}
                >
                  {opt.label}
                </button>
              )
            })}
          </div>
        </div>
        <div className="watch-lp__facet-row">
          <div className="watch-lp__facet-label">Genre</div>
          <div className="watch-lp__facet-chips" role="group" aria-label="Genre">
            {genreOptions.map((opt) => {
              const on = opt.value === activeGenre
              return (
                <button
                  key={opt.value}
                  type="button"
                  className={`watch-lp__facet-chip${on ? ' is-active' : ''}`}
                  aria-pressed={on}
                  onClick={() => {
                    onGenreChange(opt.value)
                    if (opt.value !== 'ALL') onSutraChange('ALL')
                  }}
                >
                  {opt.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>
      <p className="watch-lp__facet-status" aria-live="polite">
        {statusText}
      </p>
    </div>
  )
}
