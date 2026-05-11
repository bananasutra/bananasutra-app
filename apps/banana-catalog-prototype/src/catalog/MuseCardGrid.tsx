import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useMusesCatalog } from './generatedData'
import type { MuseCatalogItem } from './types'
import { sutraClassName } from './sutraTheme'
import { usePageMeta } from './usePageMeta'

const INITIAL_MUSE_COUNT = 40
const SUTRA_FILTERS = ['KNOWsutra', 'BLOWsutra', 'SHOWsutra', 'GROWsutra', 'FLOWsutra', 'GLOWsutra', 'BOWsutra'] as const

function formatCount(n: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(n)
}

function splitTypes(value: string): string[] {
  return value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
}

function museDomId(muse: string): string {
  return `muse-${muse.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`
}

function activeFilterCount(rows: MuseCatalogItem[], key: keyof Pick<MuseCatalogItem, 'core_sutra' | 'type_category'>, value: string) {
  return rows.filter((row) => {
    if (key === 'type_category') return splitTypes(row.type_category).includes(value)
    return row.core_sutra === value
  }).length
}

function MuseCard({ item, highlighted }: { item: MuseCatalogItem; highlighted: boolean }) {
  const [expanded, setExpanded] = useState(highlighted)
  const id = museDomId(item.muse)
  const typeLabel = item.type_category || 'Muse'
  const placeBits = [item.country, item.era || [item.birth_year, item.death_year].filter(Boolean).join('-')]
    .filter(Boolean)
    .join(', ')
  const tone = sutraClassName(item.core_sutra)

  return (
    <article id={id} className={`muse-card ${tone}${expanded ? ' is-expanded' : ''}${highlighted ? ' is-highlighted' : ''}`}>
      <button
        type="button"
        className="muse-card__button"
        aria-expanded={expanded}
        aria-controls={`${id}-details`}
        onClick={() => setExpanded((value) => !value)}
      >
        <span className="muse-card__sutra-dot" aria-hidden />
        <span className="muse-card__name">{item.muse}</span>
        <span className="muse-card__type">{typeLabel}</span>
        <span className="muse-card__count">
          {formatCount(item.song_count)} {item.song_count === 1 ? 'song' : 'songs'}
        </span>
      </button>
      <div id={`${id}-details`} className="muse-card__details" hidden={!expanded}>
        {item.notes ? <p className="muse-card__notes">{item.notes}</p> : null}
        <p className="muse-card__meta">{placeBits || item.core_sutra}</p>
        <div className="muse-card__links">
          <Link to={`/songs?find=${encodeURIComponent(item.muse)}`}>Filter songs</Link>
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
  const [sutraFilter, setSutraFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [sort, setSort] = useState<'az' | 'songs'>('az')
  const [showAll, setShowAll] = useState(false)

  usePageMeta({
    title: 'The Muses',
    description: 'Explore the thinkers, fools, poets, and troublemakers who inspired BANANASUTRA songs.',
    path: '/about/muses',
  })

  const highlightedMuse = useMemo(() => {
    const params = new URLSearchParams(location.search)
    return (params.get('muse') || params.get('highlight') || '').trim()
  }, [location.search])

  useEffect(() => {
    if (!highlightedMuse || loading) return
    const id = museDomId(highlightedMuse)
    window.requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ block: 'center' })
    })
  }, [highlightedMuse, loading])

  const typeOptions = useMemo(() => {
    const counts = new Map<string, number>()
    for (const row of rows) {
      for (const type of splitTypes(row.type_category)) {
        counts.set(type, (counts.get(type) ?? 0) + 1)
      }
    }
    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [rows])

  const filtered = useMemo(() => {
    const next = rows.filter((row) => {
      const sutraOk = sutraFilter === 'all' || row.core_sutra === sutraFilter
      const typeOk = typeFilter === 'all' || splitTypes(row.type_category).includes(typeFilter)
      return sutraOk && typeOk
    })
    next.sort((a, b) => {
      if (sort === 'songs') return b.song_count - a.song_count || a.muse.localeCompare(b.muse)
      return a.muse.localeCompare(b.muse)
    })
    return next
  }, [rows, sort, sutraFilter, typeFilter])

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

        <div className="about-filter-stack" aria-label="Muse filters">
          <div className="about-filter-group" aria-label="Filter muses by sutra">
            <button
              type="button"
              className={`about-filter-pill${sutraFilter === 'all' ? ' is-active' : ''}`}
              onClick={() => setSutraFilter('all')}
            >
              All <span>{formatCount(rows.length)}</span>
            </button>
            {SUTRA_FILTERS.map((sutra) => (
              <button
                key={sutra}
                type="button"
                className={`about-filter-pill${sutraFilter === sutra ? ' is-active' : ''}`}
                onClick={() => setSutraFilter(sutra)}
              >
                {sutra} <span>{formatCount(activeFilterCount(rows, 'core_sutra', sutra))}</span>
              </button>
            ))}
          </div>

          <div className="about-filter-group" aria-label="Filter muses by type">
            <button
              type="button"
              className={`about-filter-pill${typeFilter === 'all' ? ' is-active' : ''}`}
              onClick={() => setTypeFilter('all')}
            >
              All types <span>{formatCount(rows.length)}</span>
            </button>
            {typeOptions.map(([type, count]) => (
              <button
                key={type}
                type="button"
                className={`about-filter-pill${typeFilter === type ? ' is-active' : ''}`}
                onClick={() => setTypeFilter(type)}
              >
                {type} <span>{formatCount(count)}</span>
              </button>
            ))}
          </div>

          <label className="about-sort-control">
            <span>Sort</span>
            <select value={sort} onChange={(event) => setSort(event.target.value as 'az' | 'songs')}>
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
