import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useMusesCatalog } from './generatedData'
import type { MuseCatalogItem } from './types'
import { canonicalPathForRoute } from './seoPaths'
import { renderPageMeta } from './usePageMeta'
import './CatalogApp.css'

const INITIAL_MUSE_COUNT = 30

type MuseSortMode = 'last_name_az' | 'first_name_az' | 'songs'

function museNamePart(row: MuseCatalogItem, part: 'first' | 'last'): string {
  const fromField = (part === 'last' ? row.last_name : row.first_name).trim()
  if (fromField) return fromField

  const tokens = row.muse.trim().split(/\s+/).filter(Boolean)
  if (!tokens.length) return row.muse.trim()
  if (part === 'last') return tokens.length > 1 ? tokens[tokens.length - 1]! : tokens[0]!
  return tokens[0]!
}

function compareMuses(a: MuseCatalogItem, b: MuseCatalogItem, sort: MuseSortMode): number {
  if (sort === 'songs') {
    return (
      b.song_count - a.song_count ||
      museNamePart(a, 'last').localeCompare(museNamePart(b, 'last'), undefined, { sensitivity: 'base' }) ||
      a.muse.localeCompare(b.muse, undefined, { sensitivity: 'base' })
    )
  }

  const part = sort === 'first_name_az' ? 'first' : 'last'
  return (
    museNamePart(a, part).localeCompare(museNamePart(b, part), undefined, { sensitivity: 'base' }) ||
    museNamePart(a, part === 'first' ? 'last' : 'first').localeCompare(
      museNamePart(b, part === 'first' ? 'last' : 'first'),
      undefined,
      { sensitivity: 'base' },
    ) ||
    a.muse.localeCompare(b.muse, undefined, { sensitivity: 'base' })
  )
}

function formatCount(n: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(n)
}

function museDomId(muse: string): string {
  return `muse-${muse.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`
}

function splitList(value: string): string[] {
  return value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
}

function filterCount(rows: MuseCatalogItem[], field: 'era' | 'type_category', value: string): number {
  return rows.filter((row) => splitList(row[field]).includes(value)).length
}

function filterCountCountry(rows: MuseCatalogItem[], country: string): number {
  return rows.filter((row) => row.country.trim() === country).length
}

function formatCommaList(value: string): string {
  return splitList(value).join(', ')
}

function normalizeSearch(value: string): string {
  return value.trim().toLowerCase()
}

function eraSortRank(era: string): number {
  const normalized = normalizeSearch(era)
  if (normalized === 'ancient') return 0
  if (normalized === 'medieval') return 1
  if (normalized === 'early modern') return 2

  const century = normalized.match(/^(\d{1,2})(?:st|nd|rd|th)?\s*c/)
  if (century) return 10 + Number(century[1])

  if (normalized === 'early 20th c') return 31
  if (normalized === 'mid 20th c') return 32
  if (normalized === 'late 20th c') return 33
  if (normalized === 'contemporary') return 40

  return 100
}

function formatTypeCategory(value: string): string {
  return formatCommaList(value)
}

function formatLifespan(item: MuseCatalogItem): string {
  if (item.birth_year && item.death_year) return `${item.birth_year}-${item.death_year}`
  if (item.birth_year) return `born ${item.birth_year}`
  if (item.death_year) return `died ${item.death_year}`
  return ''
}

function MuseCard({ item, highlighted }: { item: MuseCatalogItem; highlighted: boolean }) {
  const [expanded, setExpanded] = useState(highlighted)
  const id = museDomId(item.muse)
  const typeLabel = formatTypeCategory(item.type_category) || 'Muse'
  const lifespan = formatLifespan(item)
  const placeBits = [item.country, formatCommaList(item.era) || [item.birth_year, item.death_year].filter(Boolean).join('-')]
    .filter(Boolean)
    .join(', ')

  return (
    <article id={id} className={`muse-card${expanded ? ' is-expanded' : ''}${highlighted ? ' is-highlighted' : ''}`}>
      <button
        type="button"
        className="muse-card__button"
        aria-expanded={expanded}
        aria-controls={`${id}-details`}
        onClick={() => setExpanded((value) => !value)}
      >
        <span className="muse-card__name">{item.muse}</span>
        <span className="muse-card__type">{typeLabel}</span>
        {placeBits ? <span className="muse-card__place">{placeBits}</span> : null}
        {item.song_count > 0 ? (
          <span className="muse-card__count">
            {formatCount(item.song_count)} {item.song_count === 1 ? 'song' : 'songs'}
          </span>
        ) : null}
      </button>
      <div id={`${id}-details`} className="muse-card__details" hidden={!expanded}>
        {item.notes ? <p className="muse-card__notes">{item.notes}</p> : null}
        <dl className="muse-card__detail-list">
          {lifespan ? (
            <div>
              <dt>Life</dt>
              <dd>{lifespan}</dd>
            </div>
          ) : null}
          {item.famous_works ? (
            <div>
              <dt>Works</dt>
              <dd>{item.famous_works}</dd>
            </div>
          ) : null}
          {item.themes ? (
            <div>
              <dt>Themes</dt>
              <dd>{formatCommaList(item.themes)}</dd>
            </div>
          ) : null}
          {item.quote_excerpt ? (
            <div>
              <dt>Quote</dt>
              <dd>{item.quote_excerpt}</dd>
            </div>
          ) : null}
        </dl>
        <div className="muse-card__links">
          {item.song_count > 0 ? <Link to={`/songs?find=${encodeURIComponent(item.muse)}`}>Filter songs</Link> : null}
          {item.wikipedia_url ? (
            <a href={item.wikipedia_url} target="_blank" rel="noreferrer">
              Wikipedia
            </a>
          ) : null}
        </div>
      </div>
    </article>
  )
}

export function MuseCardGrid() {
  const location = useLocation()
  const { data, error, loading } = useMusesCatalog()
  const rows = useMemo(() => data ?? [], [data])
  const highlightedMuse = useMemo(() => {
    const params = new URLSearchParams(location.search)
    return (params.get('muse') || params.get('highlight') || '').trim()
  }, [location.search])
  const [filtersOpen, setFiltersOpen] = useState(true)
  const [eraFilter, setEraFilter] = useState('all')
  const [genderFilter, setGenderFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [countryFilter, setCountryFilter] = useState('all')
  const [findMuse, setFindMuse] = useState('')
  const [sort, setSort] = useState<MuseSortMode>('last_name_az')
  const [showAll, setShowAll] = useState(() => Boolean(highlightedMuse))

  const pageMeta = renderPageMeta({
    title: 'The Muses',
    description: 'Explore the thinkers, fools, poets, and troublemakers who inspired BANANASUTRA songs.',
    path: canonicalPathForRoute('/about/muses'),
  })

  useEffect(() => {
    if (!highlightedMuse || loading) return
    const id = museDomId(highlightedMuse)
    window.requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ block: 'center' })
    })
  }, [highlightedMuse, loading])

  const eraOptions = useMemo(() => {
    const counts = new Map<string, number>()
    for (const row of rows) {
      for (const era of splitList(row.era)) {
        counts.set(era, (counts.get(era) ?? 0) + 1)
      }
    }
    return [...counts.entries()].sort((a, b) => eraSortRank(a[0]) - eraSortRank(b[0]) || a[0].localeCompare(b[0]))
  }, [rows])

  const genderOptions = useMemo(() => {
    const counts = new Map<string, number>()
    for (const row of rows) {
      const gender = row.gender_pronoun.trim()
      if (gender) counts.set(gender, (counts.get(gender) ?? 0) + 1)
    }
    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [rows])

  const typeOptions = useMemo(() => {
    const counts = new Map<string, number>()
    for (const row of rows) {
      for (const type of splitList(row.type_category)) {
        counts.set(type, (counts.get(type) ?? 0) + 1)
      }
    }
    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [rows])

  const countryOptions = useMemo(() => {
    const counts = new Map<string, number>()
    for (const row of rows) {
      const country = row.country.trim()
      if (country) counts.set(country, (counts.get(country) ?? 0) + 1)
    }
    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [rows])

  const filtered = useMemo(() => {
    const query = normalizeSearch(findMuse)
    const next = rows.filter((row) => {
      const eraOk = eraFilter === 'all' || splitList(row.era).includes(eraFilter)
      const genderOk = genderFilter === 'all' || row.gender_pronoun === genderFilter
      const typeOk = typeFilter === 'all' || splitList(row.type_category).includes(typeFilter)
      const countryOk = countryFilter === 'all' || row.country.trim() === countryFilter
      const searchOk =
        !query ||
        [
          row.muse,
          row.type_category,
          row.country,
          row.era,
          row.themes,
          row.famous_works,
          row.notes,
          row.quote_excerpt,
        ].some((value) => normalizeSearch(value).includes(query))
      return eraOk && genderOk && typeOk && countryOk && searchOk
    })
    next.sort((a, b) => compareMuses(a, b, sort))
    return next
  }, [countryFilter, eraFilter, findMuse, genderFilter, rows, sort, typeFilter])

  const visible = showAll ? filtered : filtered.slice(0, INITIAL_MUSE_COUNT)
  const findQuery = findMuse.trim()
  const activeFilterCount = [
    eraFilter !== 'all',
    genderFilter !== 'all',
    typeFilter !== 'all',
    countryFilter !== 'all',
  ].filter(Boolean).length
  const hasActiveContext = activeFilterCount > 0 || Boolean(findQuery)
  const contextSummary = hasActiveContext
    ? `${formatCount(filtered.length)} of ${formatCount(rows.length)} muses · ${activeFilterCount} filter${
        activeFilterCount === 1 ? '' : 's'
      }${findQuery ? ' · search' : ''}`
    : `${formatCount(rows.length)} muses`

  const clearAllFilters = () => {
    setEraFilter('all')
    setGenderFilter('all')
    setTypeFilter('all')
    setCountryFilter('all')
    setFindMuse('')
  }

  const activeFilterContext = (
    <section className="catalog-active-context" aria-label={hasActiveContext ? 'Active filters and result count' : 'Muses result count'}>
      <p className="catalog-active-context__summary">{contextSummary}</p>
      {hasActiveContext ? (
        <div className="catalog-chips">
          {findQuery ? (
            <button type="button" className="catalog-chip catalog-chip--find" onClick={() => setFindMuse('')}>
              Search: {findQuery}
              <span className="catalog-chip-x" aria-hidden>
                ×
              </span>
            </button>
          ) : null}
          {eraFilter !== 'all' ? (
            <button type="button" className="catalog-chip" onClick={() => setEraFilter('all')}>
              Era: {eraFilter}
              <span className="catalog-chip-x" aria-hidden>
                ×
              </span>
            </button>
          ) : null}
          {genderFilter !== 'all' ? (
            <button type="button" className="catalog-chip" onClick={() => setGenderFilter('all')}>
              Gender: {genderFilter}
              <span className="catalog-chip-x" aria-hidden>
                ×
              </span>
            </button>
          ) : null}
          {typeFilter !== 'all' ? (
            <button type="button" className="catalog-chip" onClick={() => setTypeFilter('all')}>
              Type: {typeFilter}
              <span className="catalog-chip-x" aria-hidden>
                ×
              </span>
            </button>
          ) : null}
          {countryFilter !== 'all' ? (
            <button type="button" className="catalog-chip" onClick={() => setCountryFilter('all')}>
              Country: {countryFilter}
              <span className="catalog-chip-x" aria-hidden>
                ×
              </span>
            </button>
          ) : null}
          <button type="button" className="catalog-clear" onClick={clearAllFilters}>
            Clear all
          </button>
        </div>
      ) : null}
    </section>
  )

  if (loading) {
    return (
      <div className="about-page__body about-page__body--muses about-page__body--loading">
        <section className="about-page__section about-page__section--loading" aria-labelledby="muses-title-loading">
          <h2 id="muses-title-loading" className="catalog-section-title about-page__anchor-target">
            The muses
          </h2>
          <p className="about-page__prose">Loading muses...</p>
        </section>
      </div>
    )
  }
  if (error || !data) return <p className="about-page__prose">{error ?? 'Could not load muses data.'}</p>

  return (
    <div className="about-page__body about-page__body--muses">
      {pageMeta}
      <section className="about-page__section about-page__section--muses" aria-labelledby="muses-title">
        <h2 id="muses-title" className="catalog-section-title about-page__anchor-target">
          The muses
        </h2>
        <p className="about-page__prose">
          {formatCount(rows.length)} thinkers, fools, poets, and troublemakers who inspired the songs.
        </p>

        <div className={`catalog-layout about-muses-layout${filtersOpen ? '' : ' catalog-layout--filters-collapsed'}`}>
          <aside
            className={`catalog-filters${filtersOpen ? ' is-open' : ''}`}
            aria-labelledby="muses-filters-heading"
          >
            <div className="catalog-filters-head">
              <h2 id="muses-filters-heading" className="catalog-section-title">
                Filters
              </h2>
              <button
                type="button"
                className="catalog-icon-btn"
                onClick={() => setFiltersOpen(false)}
                aria-expanded={filtersOpen}
                aria-controls="muses-filter-panel"
              >
                Hide
              </button>
            </div>

            {activeFilterContext}

            <div id="muses-filter-panel" className="catalog-facet-stack">
              <section className="catalog-facet" aria-labelledby="muses-search-heading">
                <h3 id="muses-search-heading">Search</h3>
                <label className="catalog-facet-find-label" htmlFor="muses-find-input">
                  Find a muse, theme, work, or quote
                </label>
                <input
                  id="muses-find-input"
                  className="catalog-facet-find-input"
                  type="search"
                  name="muses_find"
                  inputMode="search"
                  autoComplete="off"
                  spellCheck={false}
                  enterKeyHint="search"
                  value={findMuse}
                  onChange={(event) => setFindMuse(event.target.value)}
                />
              </section>

              <section className="catalog-facet" aria-labelledby="muses-era-heading">
                <h3 id="muses-era-heading">Era</h3>
                <div className="catalog-facet-chips" role="group" aria-label="Filter muses by era">
                  <button
                    type="button"
                    className={`catalog-facet-chip${eraFilter === 'all' ? ' is-active' : ''}`}
                    onClick={() => setEraFilter('all')}
                  >
                    <span>All eras</span>
                    <span className="catalog-facet-count">{` (${formatCount(rows.length)})`}</span>
                  </button>
                  {eraOptions.map(([era]) => (
                    <button
                      key={era}
                      type="button"
                      className={`catalog-facet-chip${eraFilter === era ? ' is-active' : ''}`}
                      onClick={() => setEraFilter(era)}
                    >
                      <span>{era}</span>
                      <span className="catalog-facet-count">{` (${formatCount(filterCount(rows, 'era', era))})`}</span>
                    </button>
                  ))}
                </div>
              </section>

              <section className="catalog-facet" aria-labelledby="muses-gender-heading">
                <h3 id="muses-gender-heading">Gender</h3>
                <div className="catalog-facet-chips" role="group" aria-label="Filter muses by gender">
                  <button
                    type="button"
                    className={`catalog-facet-chip${genderFilter === 'all' ? ' is-active' : ''}`}
                    onClick={() => setGenderFilter('all')}
                  >
                    <span>All</span>
                    <span className="catalog-facet-count">{` (${formatCount(rows.length)})`}</span>
                  </button>
                  {genderOptions.map(([gender, count]) => (
                    <button
                      key={gender}
                      type="button"
                      className={`catalog-facet-chip${genderFilter === gender ? ' is-active' : ''}`}
                      onClick={() => setGenderFilter(gender)}
                    >
                      <span>{gender}</span>
                      <span className="catalog-facet-count">{` (${formatCount(count)})`}</span>
                    </button>
                  ))}
                </div>
              </section>

              <section className="catalog-facet" aria-labelledby="muses-type-heading">
                <h3 id="muses-type-heading">Type</h3>
                <div className="catalog-facet-chips" role="group" aria-label="Filter muses by type">
                  <button
                    type="button"
                    className={`catalog-facet-chip${typeFilter === 'all' ? ' is-active' : ''}`}
                    onClick={() => setTypeFilter('all')}
                  >
                    <span>All types</span>
                    <span className="catalog-facet-count">{` (${formatCount(rows.length)})`}</span>
                  </button>
                  {typeOptions.map(([type]) => (
                    <button
                      key={type}
                      type="button"
                      className={`catalog-facet-chip${typeFilter === type ? ' is-active' : ''}`}
                      onClick={() => setTypeFilter(type)}
                    >
                      <span>{type}</span>
                      <span className="catalog-facet-count">{` (${formatCount(filterCount(rows, 'type_category', type))})`}</span>
                    </button>
                  ))}
                </div>
              </section>

              <section className="catalog-facet" aria-labelledby="muses-country-heading">
                <h3 id="muses-country-heading">Country</h3>
                <div className="catalog-facet-chips" role="group" aria-label="Filter muses by country">
                  <button
                    type="button"
                    className={`catalog-facet-chip${countryFilter === 'all' ? ' is-active' : ''}`}
                    onClick={() => setCountryFilter('all')}
                  >
                    <span>All countries</span>
                    <span className="catalog-facet-count">{` (${formatCount(rows.length)})`}</span>
                  </button>
                  {countryOptions.map(([country]) => (
                    <button
                      key={country}
                      type="button"
                      className={`catalog-facet-chip${countryFilter === country ? ' is-active' : ''}`}
                      onClick={() => setCountryFilter(country)}
                    >
                      <span>{country}</span>
                      <span className="catalog-facet-count">{` (${formatCount(filterCountCountry(rows, country))})`}</span>
                    </button>
                  ))}
                </div>
              </section>

            </div>
          </aside>

          <div className="catalog-main about-muses-main">
            <div className="catalog-main__sort-row muses-page__sort-row">
              <div className="catalog-sort muses-page__sort" aria-label="Sort muses">
                <label className="catalog-sort-label" htmlFor="muses-sort-select">
                  Sort
                </label>
                <select
                  id="muses-sort-select"
                  className="catalog-sort-select"
                  value={sort}
                  onChange={(event) => setSort(event.target.value as MuseSortMode)}
                >
                  <option value="last_name_az">Last name (A–Z)</option>
                  <option value="first_name_az">First name (A–Z)</option>
                  <option value="songs">By song count</option>
                </select>
              </div>
            </div>

            {!filtersOpen ? (
              <>
                {activeFilterContext}
                <button
                  type="button"
                  className="catalog-filter-reopen"
                  onClick={() => setFiltersOpen(true)}
                  aria-expanded={false}
                  aria-controls="muses-filter-panel"
                >
                  Show filters
                </button>
              </>
            ) : null}

            <p className="about-result-count" aria-live="polite">
              Showing {formatCount(visible.length)} of {formatCount(filtered.length)} muses.
            </p>

            <div className="muse-grid">
              {visible.map((item) => (
                <MuseCard key={item.muse_id || item.muse} item={item} highlighted={item.muse === highlightedMuse} />
              ))}
            </div>

            {!showAll && filtered.length > INITIAL_MUSE_COUNT ? (
              <button type="button" className="about-show-all" onClick={() => setShowAll(true)}>
                Show all {formatCount(filtered.length)} muses
              </button>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  )
}
