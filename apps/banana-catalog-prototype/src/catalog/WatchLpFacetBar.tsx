import {
  WATCH_LP_SUTRA_FILTER_OPTIONS,
  watchLpFacetStatusText,
  watchLpGenreFilterOptions,
  type WatchLpPlaylistPick,
  type WatchLpSutraFilter,
} from './watchLpData'
import { LISTEN_LP_SUTRA_FILTER_OPTIONS } from './listenLpData'
import {
  CatalogFilterBar,
  type CatalogFilterBarActivePill,
  type CatalogFilterBarFacetGroup,
} from './CatalogFilterBar'

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
  defaultExpanded?: boolean
  onExpandedChange?: (expanded: boolean) => void
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
  defaultExpanded,
  onExpandedChange,
}: Props) {
  const genreOptions = watchLpGenreFilterOptions(playlists)
  const statusText = watchLpFacetStatusText({
    activeSutra,
    activeGenre,
    shownCount,
    totalCount,
  })

  const activePills: CatalogFilterBarActivePill[] = []
  if (activeSutra !== 'ALL') {
    activePills.push({
      id: 'sutra',
      label: sutraChipLabel(activeSutra),
      onClick: onClearSutra,
    })
  }
  if (activeGenre !== 'ALL') {
    activePills.push({
      id: 'genre',
      label: activeGenre,
      onClick: onClearGenre,
    })
  }

  const facetGroups: CatalogFilterBarFacetGroup[] = [
    {
      id: 'sutra',
      label: 'Question',
      showAllChip: false,
      options: WATCH_LP_SUTRA_FILTER_OPTIONS.map((opt) => ({
        id: `sutra-${opt.value}`,
        label: opt.label === 'All' ? 'All questions' : opt.label,
        count: 0,
        showCount: false,
        active: opt.value === activeSutra,
        className: opt.value !== 'ALL' ? 'catalog-filter-bar__chip--question' : undefined,
        onClick: () => {
          onSutraChange(opt.value)
          if (opt.value !== 'ALL') onGenreChange('ALL')
        },
      })),
    },
    {
      id: 'genre',
      label: 'Genre',
      showAllChip: false,
      options: genreOptions.map((opt) => ({
        id: `genre-${opt.value}`,
        label: opt.label === 'All' ? 'All genres' : opt.label,
        count: 0,
        showCount: false,
        active: opt.value === activeGenre,
        onClick: () => {
          onGenreChange(opt.value)
          if (opt.value !== 'ALL') onSutraChange('ALL')
        },
      })),
    },
  ]

  return (
    <CatalogFilterBar
      ariaLabel="Filter playlists"
      panelId="watch-filter-panel"
      resultSummary={statusText}
      activePills={activePills}
      onClearAll={onClearAll}
      facetGroups={facetGroups}
      combineHelpText=""
      defaultExpanded={defaultExpanded}
      onExpandedChange={onExpandedChange}
    />
  )
}
