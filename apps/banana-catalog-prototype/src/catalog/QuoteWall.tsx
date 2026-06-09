import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuotesWall } from './generatedData'
import type { QuoteWallItem } from './types'
import { sutraClassName } from './sutraTheme'
import { SUTRA_CONTEXT, sutraHrefForFamily, type SutraFamilyKey } from './sutraContext'
import { songCatalogPath } from './songPaths'
import { canonicalPathForRoute } from './seoPaths'
import { renderPageMeta } from './usePageMeta'
import {
  CatalogFilterBar,
  type CatalogFilterBarActivePill,
  type CatalogFilterBarFacetGroup,
} from './CatalogFilterBar'

function formatCount(n: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(n)
}

function topicLabel(topic: string): string {
  return topic.trim() || 'Other'
}

function sutraFamilyFromDisplay(displayName: string): SutraFamilyKey | null {
  const normalized = displayName.trim().toUpperCase()
  for (const key of Object.keys(SUTRA_CONTEXT) as SutraFamilyKey[]) {
    if (normalized.startsWith(key)) return key
  }
  return null
}

function quoteSutras(item: QuoteWallItem): string[] {
  const values = [item.primary_sutra, ...item.secondary_sutras.split(',')]
    .map((value) => value.trim())
    .filter(Boolean)
  return [...new Set(values)]
}

function normalizeSearch(value: string): string {
  return value.trim().toLowerCase()
}

function sortQuotes(rows: QuoteWallItem[]): QuoteWallItem[] {
  return [...rows].sort(
    (a, b) =>
      topicLabel(a.core_topic).localeCompare(topicLabel(b.core_topic)) ||
      a.muse.localeCompare(b.muse) ||
      a.quote.localeCompare(b.quote),
  )
}

export function QuoteWall() {
  const { data, error, loading } = useQuotesWall()
  const rows = useMemo(() => data ?? [], [data])
  const [topicFilter, setTopicFilter] = useState('all')
  const [findQuote, setFindQuote] = useState('')
  const [filterBarExpanded, setFilterBarExpanded] = useState(false)

  const pageMeta = renderPageMeta({
    title: 'The Quotes',
    description: 'Explore the quotes and ideas behind BANANASUTRA songs, grouped by theme.',
    path: canonicalPathForRoute('/quotes'),
  })

  const topicOptions = useMemo(() => {
    const counts = new Map<string, number>()
    for (const row of rows) {
      const topic = topicLabel(row.core_topic)
      counts.set(topic, (counts.get(topic) ?? 0) + 1)
    }
    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [rows])

  const contextualTopicRows = useMemo(() => {
    const query = normalizeSearch(findQuote)
    return rows.filter((row) => {
      if (!query) return true
      return [
        row.quote,
        row.muse,
        row.primary_sutra,
        row.secondary_sutras,
        row.core_topic,
        row.inspired_song?.title ?? '',
      ].some((value) => normalizeSearch(value).includes(query))
    })
  }, [rows, findQuote])

  const filtered = useMemo(() => {
    const query = normalizeSearch(findQuote)
    return rows.filter((row) => {
      const topicOk = topicFilter === 'all' || topicLabel(row.core_topic) === topicFilter
      const searchOk =
        !query ||
        [
          row.quote,
          row.muse,
          row.primary_sutra,
          row.secondary_sutras,
          row.core_topic,
          row.inspired_song?.title ?? '',
        ].some((value) => normalizeSearch(value).includes(query))
      return topicOk && searchOk
    })
  }, [findQuote, rows, topicFilter])
  const sortedQuotes = useMemo(() => sortQuotes(filtered), [filtered])

  const findQuery = findQuote.trim()
  const quoteActivePills: CatalogFilterBarActivePill[] = []
  if (findQuery) {
    quoteActivePills.push({
      id: 'find',
      label: `Search: ${findQuery}`,
      onClick: () => setFindQuote(''),
    })
  }
  if (topicFilter !== 'all') {
    quoteActivePills.push({
      id: 'topic',
      label: `Topic: ${topicFilter}`,
      onClick: () => setTopicFilter('all'),
    })
  }

  const quoteFacetGroups: CatalogFilterBarFacetGroup[] = [
    {
      id: 'topic',
      label: 'Topic',
      allLabel: 'All topics',
      allCount: contextualTopicRows.length,
      onClearGroup: () => setTopicFilter('all'),
      options: topicOptions.map(([topic]) => {
        const count = contextualTopicRows.filter((row) => topicLabel(row.core_topic) === topic).length
        return {
          id: `topic-${topic}`,
          label: topic,
          count,
          active: topicFilter === topic,
          disabled: topicFilter !== topic && count === 0,
          onClick: () => setTopicFilter(topic),
          title: `${count} quotes`,
        }
      }),
    },
  ]

  const clearAllFilters = () => {
    setTopicFilter('all')
    setFindQuote('')
  }

  const resultSummary = `Showing ${formatCount(filtered.length)} of ${formatCount(rows.length)} quotes`

  if (loading) {
    return (
      <div className="about-page__body about-page__body--quotes about-page__body--loading">
        <section className="about-page__section about-page__section--loading" aria-labelledby="quotes-title-loading">
          <h2 id="quotes-title-loading" className="catalog-section-title about-page__anchor-target">
            The quotes
          </h2>
          <p className="about-page__prose">Loading quotes...</p>
        </section>
      </div>
    )
  }
  if (error || !data) return <p className="about-page__prose">{error ?? 'Could not load quotes data.'}</p>

  return (
    <div className="about-page__body about-page__body--quotes">
      {pageMeta}
      <section className="about-page__section" aria-labelledby="quotes-title">
        <h2 id="quotes-title" className="catalog-section-title about-page__anchor-target">
          The quotes
        </h2>
        <p className="about-page__prose">
          {formatCount(rows.length)} sparks that lit the songs. Filter by topic or search when you want a narrower lane.
        </p>

        <CatalogFilterBar
          ariaLabel="Filter quotes"
          panelId="quotes-filter-panel"
          resultSummary={resultSummary}
          activePills={quoteActivePills}
          onClearAll={clearAllFilters}
          facetGroups={quoteFacetGroups}
          search={{
            id: 'quotes-find-input',
            label: 'Search',
            ariaLabel: 'Find a quote, muse, sutra, topic, or song',
            value: findQuote,
            onChange: setFindQuote,
            inputName: 'quotes_find',
            placeholder: 'Find a quote, muse, sutra, topic, or song...',
          }}
          defaultExpanded={filterBarExpanded}
          onExpandedChange={setFilterBarExpanded}
        />

        <div className="quote-wall">
          <div className="quote-cluster__items">
            {sortedQuotes.map((item) => {
              const topic = topicLabel(item.core_topic)
              return (
                <figure key={item.quote_id || `${item.muse}-${item.quote}`} className="quote-item">
                  <span className="quote-item__mark" aria-hidden>
                    &ldquo;
                  </span>
                  <blockquote className="quote-item__text">{item.quote}</blockquote>
                  <figcaption className="quote-item__meta">
                    <span className="quote-item__topic">{topic}</span>
                    <Link to={`/muses?muse=${encodeURIComponent(item.muse)}`}>{item.muse}</Link>
                    {quoteSutras(item).map((sutra) => {
                      const family = sutraFamilyFromDisplay(sutra)
                      if (!family) return null
                      return (
                        <Link
                          key={sutra}
                          className={`quote-item__sutra-link catalog-facet-sutra-name ${sutraClassName(sutra)}`}
                          to={sutraHrefForFamily(family)}
                        >
                          {sutra}
                        </Link>
                      )
                    })}
                    {item.inspired_song ? (
                      <Link className="quote-item__song" to={songCatalogPath(item.inspired_song.title, item.inspired_song.slug)}>
                        inspired: {item.inspired_song.title}
                      </Link>
                    ) : null}
                  </figcaption>
                </figure>
              )
            })}
          </div>
        </div>
      </section>
    </div>
  )
}
