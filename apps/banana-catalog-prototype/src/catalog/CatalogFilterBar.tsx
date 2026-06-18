import { useId, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import './CatalogFilterBar.css'

export type CatalogFilterBarActivePill = {
  id: string
  label: ReactNode
  href?: string
  onClick?: () => void
  title?: string
  className?: string
}

export type CatalogFilterBarChipOption = {
  id: string
  label: ReactNode
  href?: string
  onClick?: () => void
  count: number
  active: boolean
  disabled?: boolean
  title?: string
  className?: string
  showCount?: boolean
}

export type CatalogFilterBarFacetGroup = {
  id: string
  label: string
  allLabel?: string
  allHref?: string
  onClearGroup?: () => void
  allCount?: number
  allTitle?: string
  showAllChip?: boolean
  options: CatalogFilterBarChipOption[]
}

export type CatalogFilterBarSecondaryGroup = {
  id: string
  label: string
  helpText?: string
  options: CatalogFilterBarChipOption[]
}

export type CatalogFilterBarSearch = {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  inputName?: string
  placeholder?: string
  /** Longer hint for screen readers when label is abbreviated (e.g. "Search"). */
  ariaLabel?: string
  onFocus?: () => void
  onBlur?: () => void
}

type CatalogFilterBarProps = {
  ariaLabel: string
  panelId?: string
  resultSummary: string
  activePills: CatalogFilterBarActivePill[]
  clearAllHref?: string
  onClearAll?: () => void
  showClearAll?: boolean
  facetGroups: CatalogFilterBarFacetGroup[]
  secondaryGroup?: CatalogFilterBarSecondaryGroup
  search?: CatalogFilterBarSearch
  combineHelpText?: string
  /** Where optional secondary row (e.g. Media) sits relative to primary facet groups. */
  secondaryGroupPosition?: 'before-facets' | 'after-facets'
  defaultExpanded?: boolean
  onExpandedChange?: (expanded: boolean) => void
  /** Hide total-count line when pagination or another control shows it (default true). */
  showResultSummary?: boolean
  /** Right side of toolbar row (e.g. sort dropdown). */
  toolbarEnd?: ReactNode
  /** Optional row at bottom of expanded filter panel (e.g. opt-in checkboxes). */
  panelFooter?: ReactNode
}

export function CatalogFilterBar({
  ariaLabel,
  panelId: panelIdProp,
  resultSummary,
  activePills,
  clearAllHref,
  onClearAll,
  showClearAll = true,
  facetGroups,
  secondaryGroup,
  search,
  combineHelpText = 'Filters combine across groups (AND). Multiple picks inside one group combine as OR.',
  secondaryGroupPosition = 'before-facets',
  defaultExpanded,
  onExpandedChange,
  showResultSummary = true,
  toolbarEnd,
  panelFooter,
}: CatalogFilterBarProps) {
  const autoPanelId = useId()
  const panelId = panelIdProp ?? `catalog-filter-panel-${autoPanelId.replace(/:/g, '')}`
  const [expanded, setExpanded] = useState(() => defaultExpanded ?? false)

  const hasActive = activePills.length > 0
  const showSummary = showResultSummary && Boolean(resultSummary.trim())
  const showActiveStrip = showSummary || hasActive

  const setPanelExpanded = (next: boolean) => {
    setExpanded(next)
    onExpandedChange?.(next)
  }

  const chipClassName = (option: CatalogFilterBarChipOption) =>
    `catalog-filter-bar__chip${option.active ? ' is-active' : ''}${option.disabled ? ' is-disabled' : ''}${option.className ? ` ${option.className}` : ''}`

  const renderChip = (option: CatalogFilterBarChipOption) => {
    const className = chipClassName(option)
    const count =
      option.showCount === false ? null : (
        <span className="catalog-filter-bar__chip-count">{` (${option.count})`}</span>
      )
    if (option.href) {
      return (
        <Link
          key={option.id}
          className={className}
          to={option.href}
          title={option.title}
          aria-disabled={option.disabled || undefined}
          tabIndex={option.disabled ? -1 : undefined}
          onClick={(event) => {
            if (option.disabled) event.preventDefault()
          }}
        >
          {option.label}
          {count}
        </Link>
      )
    }
    return (
      <button
        key={option.id}
        type="button"
        className={className}
        disabled={option.disabled}
        title={option.title}
        onClick={option.onClick}
      >
        {option.label}
        {count}
      </button>
    )
  }

  const renderAllChip = (group: CatalogFilterBarFacetGroup) => {
    const allActive = !group.options.some((option) => option.active)
    const className = `catalog-filter-bar__chip${allActive ? ' is-active' : ''}`
    const count = (
      <span className="catalog-filter-bar__chip-count">{` (${group.allCount ?? 0})`}</span>
    )
    const label = group.allLabel ?? 'All'
    if (group.allHref) {
      return (
        <Link className={className} to={group.allHref} title={group.allTitle}>
          {label}
          {count}
        </Link>
      )
    }
    if (group.onClearGroup) {
      return (
        <button type="button" className={className} title={group.allTitle} onClick={group.onClearGroup}>
          {label}
          {count}
        </button>
      )
    }
    return null
  }

  const renderFacetGroup = (group: CatalogFilterBarFacetGroup) => {
    if (group.options.length === 0 && (group.allCount ?? 0) === 0) return null
    const showAll = group.showAllChip !== false && (group.allHref || group.onClearGroup)
    return (
      <div key={group.id} className="catalog-filter-bar__row" role="group" aria-labelledby={`${panelId}-${group.id}-label`}>
        <div id={`${panelId}-${group.id}-label`} className="catalog-filter-bar__label">
          {group.label}
        </div>
        <div className="catalog-filter-bar__row-main">
          <div className="catalog-filter-bar__scroll">
            <div className="catalog-filter-bar__chip-row">
              {showAll ? renderAllChip(group) : null}
              {group.options.map(renderChip)}
            </div>
          </div>
        </div>
      </div>
    )
  }

  const renderSecondaryGroup = () => {
    if (!secondaryGroup) return null
    return (
      <div className="catalog-filter-bar__row" role="group" aria-labelledby={`${panelId}-${secondaryGroup.id}-label`}>
        <div
          id={`${panelId}-${secondaryGroup.id}-label`}
          className="catalog-filter-bar__label"
          title={secondaryGroup.helpText}
        >
          {secondaryGroup.label}
        </div>
        <div className="catalog-filter-bar__row-main">
          {secondaryGroup.helpText ? (
            <span id={`${panelId}-${secondaryGroup.id}-help`} className="visually-hidden">
              {secondaryGroup.helpText}
            </span>
          ) : null}
          <div className="catalog-filter-bar__scroll">
            <div
              className="catalog-filter-bar__chip-row"
              aria-describedby={secondaryGroup.helpText ? `${panelId}-${secondaryGroup.id}-help` : undefined}
            >
              {secondaryGroup.options.map(renderChip)}
            </div>
          </div>
        </div>
      </div>
    )
  }

  const renderActivePill = (pill: CatalogFilterBarActivePill) => {
    const className = `catalog-filter-bar__pill${pill.className ? ` ${pill.className}` : ''}`
    const x = (
      <span className="catalog-filter-bar__pill-x" aria-hidden>
        ×
      </span>
    )
    if (pill.href) {
      return (
        <Link key={pill.id} className={className} to={pill.href} title={pill.title}>
          {pill.label}
          {x}
        </Link>
      )
    }
    return (
      <button key={pill.id} type="button" className={className} title={pill.title} onClick={pill.onClick}>
        {pill.label}
        {x}
      </button>
    )
  }

  return (
    <section className="catalog-filter-bar" aria-label={ariaLabel}>
      <div className="catalog-filter-bar__toolbar">
        <button
          type="button"
          className="catalog-filter-bar__toggle"
          aria-expanded={expanded}
          aria-controls={panelId}
          onClick={() => setPanelExpanded(!expanded)}
        >
          {expanded ? 'Hide filters' : 'Filters'}
        </button>

        {showActiveStrip ? (
          <div
            className="catalog-filter-bar__active"
            aria-label={hasActive ? 'Active filters and result count' : 'Result count'}
          >
            {showSummary ? <span className="catalog-filter-bar__count">{resultSummary}</span> : null}
            {activePills.map(renderActivePill)}
            {hasActive && showClearAll ? (
              clearAllHref ? (
                <Link className="catalog-filter-bar__clear" to={clearAllHref}>
                  Clear all
                </Link>
              ) : onClearAll ? (
                <button type="button" className="catalog-filter-bar__clear" onClick={onClearAll}>
                  Clear all
                </button>
              ) : null
            ) : null}
          </div>
        ) : null}

        {toolbarEnd ? <div className="catalog-filter-bar__toolbar-end">{toolbarEnd}</div> : null}
      </div>

      <div id={panelId} className={`catalog-filter-bar__panel${expanded ? ' is-open' : ''}`}>
        {search ? (
          <div className="catalog-filter-bar__row catalog-filter-bar__row--search">
            <label className="catalog-filter-bar__label" htmlFor={search.id}>
              {search.label}
            </label>
            <div className="catalog-filter-bar__row-main">
              <input
                id={search.id}
                className="catalog-filter-bar__search-input"
                type="search"
                name={search.inputName ?? 'catalog_find'}
                inputMode="search"
                autoComplete="off"
                spellCheck={false}
                enterKeyHint="search"
                placeholder={search.placeholder}
                aria-label={search.ariaLabel ?? search.label}
                value={search.value}
                onChange={(event) => search.onChange(event.target.value)}
                onFocus={search.onFocus}
                onBlur={search.onBlur}
              />
            </div>
          </div>
        ) : null}

        {secondaryGroupPosition === 'before-facets' ? renderSecondaryGroup() : null}

        {facetGroups.map(renderFacetGroup)}

        {secondaryGroupPosition === 'after-facets' ? renderSecondaryGroup() : null}

        {panelFooter ? <div className="catalog-filter-bar__panel-footer">{panelFooter}</div> : null}

        {combineHelpText ? (
          <p className="catalog-filter-bar__help catalog-filter-bar__help--footer">{combineHelpText}</p>
        ) : null}
      </div>
    </section>
  )
}
