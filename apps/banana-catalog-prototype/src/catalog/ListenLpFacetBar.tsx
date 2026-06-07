import {
  LISTEN_LP_SUTRA_FILTER_OPTIONS,
  listenLpFacetStatusText,
  listenLpGenreFilterOptions,
  type ListenLpSongbookPick,
  type ListenLpSutraFilter,
} from './listenLpData'

type Props = {
  books: ListenLpSongbookPick[]
  activeSutra: ListenLpSutraFilter
  activeGenre: string
  sutraRailCount: number
  genreRailCount: number
  onSutraChange: (value: ListenLpSutraFilter) => void
  onGenreChange: (value: string) => void
  onClearSutra: () => void
  onClearGenre: () => void
  onClearAll: () => void
}

export function ListenLpFacetBar({
  books,
  activeSutra,
  activeGenre,
  sutraRailCount,
  genreRailCount,
  onSutraChange,
  onGenreChange,
  onClearSutra,
  onClearGenre,
  onClearAll,
}: Props) {
  const genreOptions = listenLpGenreFilterOptions(books)
  const statusText = listenLpFacetStatusText({
    activeSutra,
    activeGenre,
    sutraCount: sutraRailCount,
    genreCount: genreRailCount,
  })
  const hasActive = activeSutra !== 'ALL' || activeGenre !== 'ALL'

  return (
    <div className="listen-lp__facet-bar" aria-label="Filter the songbook lists below">
      {hasActive ? (
        <div className="listen-lp__facet-active">
          <span className="listen-lp__facet-count">Filtered</span>
          {activeSutra !== 'ALL' ? (
            <button type="button" className="listen-lp__facet-pill" onClick={onClearSutra}>
              {activeSutra}
              <span className="listen-lp__facet-pill-x" aria-hidden>
                ×
              </span>
            </button>
          ) : null}
          {activeGenre !== 'ALL' ? (
            <button type="button" className="listen-lp__facet-pill" onClick={onClearGenre}>
              {activeGenre}
              <span className="listen-lp__facet-pill-x" aria-hidden>
                ×
              </span>
            </button>
          ) : null}
          <button type="button" className="listen-lp__facet-clear" onClick={onClearAll}>
            Clear all
          </button>
        </div>
      ) : null}

      <div className="listen-lp__facet-panel">
        <div className="listen-lp__facet-row">
          <div className="listen-lp__facet-label">Guiding question</div>
          <div className="listen-lp__facet-chips" role="group" aria-label="Guiding question">
            {LISTEN_LP_SUTRA_FILTER_OPTIONS.map((opt) => {
              const on = opt.value === activeSutra
              return (
                <button
                  key={opt.value}
                  type="button"
                  className={`listen-lp__facet-chip${on ? ' is-active' : ''}`}
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
        <div className="listen-lp__facet-row">
          <div className="listen-lp__facet-label">Genre</div>
          <div className="listen-lp__facet-chips" role="group" aria-label="Genre">
            {genreOptions.map((opt) => {
              const on = opt.value === activeGenre
              return (
                <button
                  key={opt.value}
                  type="button"
                  className={`listen-lp__facet-chip${on ? ' is-active' : ''}`}
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
      <p className="listen-lp__facet-status" aria-live="polite">
        {statusText}
      </p>
    </div>
  )
}
