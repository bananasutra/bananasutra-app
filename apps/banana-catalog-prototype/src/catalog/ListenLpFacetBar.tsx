import {
  LISTEN_LP_SUTRA_FILTER_OPTIONS,
  listenLpFacetStatusText,
  listenLpGenreFilterOptions,
  type ListenLpSongbookPick,
  type ListenLpSutraFilter,
} from './listenLpData'
import {
  CatalogFilterBar,
  type CatalogFilterBarActivePill,
  type CatalogFilterBarFacetGroup,
} from './CatalogFilterBar'

type Props = {
  books: ListenLpSongbookPick[]
  activeSutra: ListenLpSutraFilter
  activeGenre: string
  shownCount: number
  totalCount: number
  onSutraChange: (value: ListenLpSutraFilter) => void
  onGenreChange: (value: string) => void
  onClearSutra: () => void
  onClearGenre: () => void
  onClearAll: () => void
}

function sutraChipLabel(value: ListenLpSutraFilter): string {
  if (value === 'ALL') return 'All questions'
  return LISTEN_LP_SUTRA_FILTER_OPTIONS.find((o) => o.value === value)?.label ?? value
}

export function ListenLpFacetBar({
  books,
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
  const genreOptions = listenLpGenreFilterOptions(books)
  const statusText = listenLpFacetStatusText({
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
      options: LISTEN_LP_SUTRA_FILTER_OPTIONS.map((opt) => ({
        id: `sutra-${opt.value}`,
        label: opt.label,
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
      ariaLabel="Filter songbooks"
      resultSummary={statusText}
      activePills={activePills}
      onClearAll={onClearAll}
      facetGroups={facetGroups}
      combineHelpText=""
    />
  )
}
