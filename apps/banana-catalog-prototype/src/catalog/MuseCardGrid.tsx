import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useMusesCatalog } from './generatedData'
import type { MuseCatalogItem } from './types'
import { usePageMeta } from './usePageMeta'

const INITIAL_MUSE_COUNT = 40

function formatCount(n: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(n)
}

function museDomId(muse: string): string {
  return `muse-${muse.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`
}

function filterCount(rows: MuseCatalogItem[], field: 'era' | 'gender_pronoun', value: string): number {
  return rows.filter((row) => splitList(row[field]).includes(value)).length
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

function normalizeSearch(value: string): string {
  return value.trim().toLowerCase()
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
  const [eraFilter, setEraFilter] = useState('all')
  const [genderFilter, setGenderFilter] = useState('all')
  const [findMuse, setFindMuse] = useState('')
  const [sort, setSort] = useState<'az' | 'songs'>('az')
  const [showAll, setShowAll] = useState(() => Boolean(highlightedMuse))

  usePageMeta({
    title: 'The Muses',
    description: 'Explore the thinkers, fools, poets, and troublemakers who inspired BANANASUTRA songs.',
    path: '/about/muses',
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
    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [rows])

  const genderOptions = useMemo(() => {
    const counts = new Map<string, number>()
    for (const row of rows) {
      const gender = row.gender_pronoun.trim()
      if (gender) counts.set(gender, (counts.get(gender) ?? 0) + 1)
    }
    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [rows])

  const filtered = useMemo(() => {
    const query = normalizeSearch(findMuse)
    const next = rows.filter((row) => {
      const eraOk = eraFilter === 'all' || splitList(row.era).includes(eraFilter)
      const genderOk = genderFilter === 'all' || row.gender_pronoun === genderFilter
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
      return eraOk && genderOk && searchOk
    })
    next.sort((a, b) => {
      if (sort === 'songs') return b.song_count - a.song_count || a.muse.localeCompare(b.muse)
      return a.muse.localeCompare(b.muse)
    })
    return next
  }, [eraFilter, findMuse, genderFilter, rows, sort])

  const visible = showAll ? filtered : filtered.slice(0, INITIAL_MUSE_COUNT)

  if (loading) return <p className="about-page__prose">Loading muses...</p>
  if (error || !data) return <p className="about-page__prose">{error ?? 'Could not load muses data.'}</p>

  return (
    <div className="about-page__body">
      <section className="about-page__section" aria-labelledby="muses-title">
        <h2 id="muses-title" className="catalog-section-title about-page__anchor-target">
          The muses
        </h2>
        <p className="about-page__prose">
          {formatCount(rows.length)} thinkers, fools, poets, and troublemakers who inspired the songs.
        </p>

        <label className="about-muse-search">
          <span>Search muses</span>
          <input
            type="search"
            value={findMuse}
            onChange={(event) => setFindMuse(event.target.value)}
            placeholder="Find a muse, theme, work, or quote..."
          />
        </label>

        <div className="about-filter-stack" aria-label="Muse filters">
          <div className="about-filter-group" aria-label="Filter muses by era">
            <button
              type="button"
              className={`about-filter-pill${eraFilter === 'all' ? ' is-active' : ''}`}
              onClick={() => setEraFilter('all')}
            >
              All eras <span>{formatCount(rows.length)}</span>
            </button>
            {eraOptions.map(([era]) => (
              <button
                key={era}
                type="button"
                className={`about-filter-pill${eraFilter === era ? ' is-active' : ''}`}
                onClick={() => setEraFilter(era)}
              >
                {era} <span>{formatCount(filterCount(rows, 'era', era))}</span>
              </button>
            ))}
          </div>

          <div className="about-filter-group" aria-label="Filter muses by gender">
            <button
              type="button"
              className={`about-filter-pill${genderFilter === 'all' ? ' is-active' : ''}`}
              onClick={() => setGenderFilter('all')}
            >
              All genders <span>{formatCount(rows.length)}</span>
            </button>
            {genderOptions.map(([gender, count]) => (
              <button
                key={gender}
                type="button"
                className={`about-filter-pill${genderFilter === gender ? ' is-active' : ''}`}
                onClick={() => setGenderFilter(gender)}
              >
                {gender} <span>{formatCount(count)}</span>
              </button>
            ))}
          </div>

          <label className="catalog-sort about-sort-control">
            <span className="catalog-sort-label">Sort</span>
            <select
              className="catalog-sort-select"
              value={sort}
              onChange={(event) => setSort(event.target.value as 'az' | 'songs')}
            >
              <option value="az">Alphabetical</option>
              <option value="songs">By song count</option>
            </select>
          </label>
        </div>

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
      </section>
    </div>
  )
}
