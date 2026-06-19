import { useEffect, useMemo, useState, type MouseEvent } from 'react'
import { trackBertrandOpen } from '../lib/analytics'
import { fieldsMatchSearchQuery, normalizeSearchText } from './textSearchMatch'
import { Link, useLocation } from 'react-router-dom'
import { useMusesCatalog } from './generatedData'
import type { MuseCatalogItem } from './types'
import { canonicalPathForRoute } from './seoPaths'
import { renderPageMeta } from './usePageMeta'
import {
  CatalogFilterBar,
  type CatalogFilterBarActivePill,
  type CatalogFilterBarFacetGroup,
} from './CatalogFilterBar'
import './CatalogApp.css'
import './catalog-page-shell.css'

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

function formatCommaList(value: string): string {
  return splitList(value).join(', ')
}

function eraSortRank(era: string): number {
  const normalized = normalizeSearchText(era)
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

type MuseFilters = {
  era: string
  gender: string
  type: string
  country: string
  query: string
}

function museMatchesFilters(row: MuseCatalogItem, f: MuseFilters): boolean {
  const eraOk = f.era === 'all' || splitList(row.era).includes(f.era)
  const genderOk = f.gender === 'all' || row.gender_pronoun === f.gender
  const typeOk = f.type === 'all' || splitList(row.type_category).includes(f.type)
  const countryOk = f.country === 'all' || row.country.trim() === f.country
  const searchOk = fieldsMatchSearchQuery(
    [
      row.muse,
      row.first_name,
      row.last_name,
      row.type_category,
      row.country,
      row.era,
      row.themes,
      row.famous_works,
      row.quote_excerpt,
    ],
    f.query,
  )
  return eraOk && genderOk && typeOk && countryOk && searchOk
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
  const [filterBarExpanded, setFilterBarExpanded] = useState(false)
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
    path: canonicalPathForRoute('/muses'),
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

  const normalizedFindQuery = useMemo(() => normalizeSearchText(findMuse), [findMuse])
  const contextualEraRows = useMemo(
    () =>
      rows.filter((row) =>
        museMatchesFilters(row, {
          era: 'all',
          gender: genderFilter,
          type: typeFilter,
          country: countryFilter,
          query: normalizedFindQuery,
        }),
      ),
    [rows, genderFilter, typeFilter, countryFilter, normalizedFindQuery],
  )
  const contextualGenderRows = useMemo(
    () =>
      rows.filter((row) =>
        museMatchesFilters(row, {
          era: eraFilter,
          gender: 'all',
          type: typeFilter,
          country: countryFilter,
          query: normalizedFindQuery,
        }),
      ),
    [rows, eraFilter, typeFilter, countryFilter, normalizedFindQuery],
  )
  const contextualTypeRows = useMemo(
    () =>
      rows.filter((row) =>
        museMatchesFilters(row, {
          era: eraFilter,
          gender: genderFilter,
          type: 'all',
          country: countryFilter,
          query: normalizedFindQuery,
        }),
      ),
    [rows, eraFilter, genderFilter, countryFilter, normalizedFindQuery],
  )
  const contextualCountryRows = useMemo(
    () =>
      rows.filter((row) =>
        museMatchesFilters(row, {
          era: eraFilter,
          gender: genderFilter,
          type: typeFilter,
          country: 'all',
          query: normalizedFindQuery,
        }),
      ),
    [rows, eraFilter, genderFilter, typeFilter, normalizedFindQuery],
  )

  const filtered = useMemo(() => {
    const next = rows.filter((row) => {
      return museMatchesFilters(row, {
        era: eraFilter,
        gender: genderFilter,
        type: typeFilter,
        country: countryFilter,
        query: normalizedFindQuery,
      })
    })
    next.sort((a, b) => compareMuses(a, b, sort))
    return next
  }, [countryFilter, eraFilter, normalizedFindQuery, genderFilter, rows, sort, typeFilter])

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

  const museActivePills: CatalogFilterBarActivePill[] = []
  if (findQuery) {
    museActivePills.push({
      id: 'find',
      label: `Search: ${findQuery}`,
      onClick: () => setFindMuse(''),
    })
  }
  if (eraFilter !== 'all') {
    museActivePills.push({ id: 'era', label: `Era: ${eraFilter}`, onClick: () => setEraFilter('all') })
  }
  if (genderFilter !== 'all') {
    museActivePills.push({ id: 'gender', label: `Gender: ${genderFilter}`, onClick: () => setGenderFilter('all') })
  }
  if (typeFilter !== 'all') {
    museActivePills.push({ id: 'type', label: `Type: ${typeFilter}`, onClick: () => setTypeFilter('all') })
  }
  if (countryFilter !== 'all') {
    museActivePills.push({ id: 'country', label: `Country: ${countryFilter}`, onClick: () => setCountryFilter('all') })
  }

  const museFacetGroups: CatalogFilterBarFacetGroup[] = [
    {
      id: 'era',
      label: 'Era',
      allLabel: 'All eras',
      allCount: contextualEraRows.length,
      onClearGroup: () => setEraFilter('all'),
      options: eraOptions.map(([era]) => {
        const count = contextualEraRows.filter((row) => splitList(row.era).includes(era)).length
        return {
          id: `era-${era}`,
          label: era,
          count,
          active: eraFilter === era,
          disabled: eraFilter !== era && count === 0,
          onClick: () => setEraFilter(era),
          title: `${count} muses`,
        }
      }),
    },
    {
      id: 'gender',
      label: 'Gender',
      allLabel: 'All',
      allCount: contextualGenderRows.length,
      onClearGroup: () => setGenderFilter('all'),
      options: genderOptions.map(([gender]) => {
        const count = contextualGenderRows.filter((row) => row.gender_pronoun.trim() === gender).length
        return {
          id: `gender-${gender}`,
          label: gender,
          count,
          active: genderFilter === gender,
          disabled: genderFilter !== gender && count === 0,
          onClick: () => setGenderFilter(gender),
          title: `${count} muses`,
        }
      }),
    },
    {
      id: 'type',
      label: 'Type',
      allLabel: 'All types',
      allCount: contextualTypeRows.length,
      onClearGroup: () => setTypeFilter('all'),
      options: typeOptions.map(([type]) => {
        const count = contextualTypeRows.filter((row) => splitList(row.type_category).includes(type)).length
        return {
          id: `type-${type}`,
          label: type,
          count,
          active: typeFilter === type,
          disabled: typeFilter !== type && count === 0,
          onClick: () => setTypeFilter(type),
          title: `${count} muses`,
        }
      }),
    },
    {
      id: 'country',
      label: 'Country',
      allLabel: 'All countries',
      allCount: contextualCountryRows.length,
      onClearGroup: () => setCountryFilter('all'),
      options: countryOptions.map(([country]) => {
        const count = contextualCountryRows.filter((row) => row.country.trim() === country).length
        return {
          id: `country-${country}`,
          label: country,
          count,
          active: countryFilter === country,
          disabled: countryFilter !== country && count === 0,
          onClick: () => setCountryFilter(country),
          title: `${count} muses`,
        }
      }),
    },
  ]

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
        <p className="catalog-lp-section-intro">
          {formatCount(rows.length)} thinkers, fools, poets, and troublemakers who inspired the songs.
        </p>

        <CatalogFilterBar
          ariaLabel="Filter muses"
          panelId="muses-filter-panel"
          resultSummary={contextSummary}
          showResultSummary={false}
          activePills={museActivePills}
          onClearAll={clearAllFilters}
          facetGroups={museFacetGroups}
          search={{
            id: 'muses-find-input',
            label: 'Search',
            ariaLabel: 'Find a muse, theme, work, or quote',
            value: findMuse,
            onChange: setFindMuse,
            inputName: 'muses_find',
            placeholder: 'Find a muse, theme, work, or quote...',
          }}
          defaultExpanded={filterBarExpanded}
          onExpandedChange={setFilterBarExpanded}
          toolbarEnd={
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
          }
        />

        <div className="about-muses-main">
          <p className="about-result-count" aria-live="polite">
            {filtered.length === 0
              ? `No muses match${findQuery ? ` "${findQuery}"` : ''}.`
              : `Showing ${formatCount(visible.length)} of ${formatCount(filtered.length)} muses.`}
          </p>

          {filtered.length === 0 ? (
            <p className="about-page__prose about-muses-empty">
              Nothing here yet.{' '}
              <a
                className="about-page__text-link"
                href="#bertrand"
                onClick={(event: MouseEvent<HTMLAnchorElement>) => {
                  event.preventDefault()
                  trackBertrandOpen({ surface: 'muses_search_empty', mode: 'read' })
                  window.dispatchEvent(new CustomEvent('bbb:open', { detail: { reason: 'muses_search_empty' } }))
                }}
              >
                Ring Bertrand
              </a>{' '}
              and tell him who you were looking for.
            </p>
          ) : (
            <div className="muse-grid">
              {visible.map((item) => (
                <MuseCard key={item.muse_id || item.muse} item={item} highlighted={item.muse === highlightedMuse} />
              ))}
            </div>
          )}

          {!showAll && filtered.length > INITIAL_MUSE_COUNT ? (
            <button type="button" className="catalog-index-show-more" onClick={() => setShowAll(true)}>
              Load all {formatCount(filtered.length)} muses
            </button>
          ) : null}
        </div>

        <Link className="catalog-section-cta about-muses-crosslink" to={canonicalPathForRoute('/quotes')}>
          Read the quotes →
        </Link>
      </section>
    </div>
  )
}
