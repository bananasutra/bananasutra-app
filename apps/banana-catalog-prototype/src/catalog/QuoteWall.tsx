import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuotesWall } from './generatedData'
import type { QuoteWallItem } from './types'
import { sutraClassName, sutraFilterChipClassName } from './sutraTheme'
import {
  SUTRA_CONTEXT,
  sortSutraDisplayNames,
  sutraHrefForFamily,
  sutraQuestionFromDisplay,
  type SutraFamilyKey,
} from './sutraContext'
import { songCatalogPath } from './songPaths'
import { canonicalPathForRoute } from './seoPaths'
import { renderPageMeta } from './usePageMeta'
import {
  CatalogFilterBar,
  type CatalogFilterBarActivePill,
  type CatalogFilterBarFacetGroup,
} from './CatalogFilterBar'
import { CatalogInfiniteScrollFooter } from './CatalogInfiniteScrollFooter'
import { CatalogProgressiveLoading } from './CatalogProgressiveLoading'
import {
  catalogInfiniteScrollStorageKey,
  useCatalogInfiniteScroll,
} from './useCatalogInfiniteScroll'
import './catalog-page-shell.css'

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

function secondarySutras(item: QuoteWallItem): string[] {
  return item.secondary_sutras
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
}

function quoteSutras(item: QuoteWallItem): string[] {
  const values = [item.primary_sutra, ...secondarySutras(item)].map((value) => value.trim()).filter(Boolean)
  return [...new Set(values)]
}

function quoteMatchesSearch(row: QuoteWallItem, query: string): boolean {
  if (!query) return true
  return [
    row.quote,
    row.muse,
    row.primary_sutra,
    row.secondary_sutras,
    row.core_topic,
    row.inspired_song?.title ?? '',
  ].some((value) => normalizeSearch(value).includes(query))
}

function quoteMatchesFilters(
  row: QuoteWallItem,
  filters: {
    topic: string
    primarySutra: string
    secondarySutra: string
    query: string
  },
): boolean {
  if (filters.topic !== 'all' && topicLabel(row.core_topic) !== filters.topic) return false
  if (filters.primarySutra !== 'all' && row.primary_sutra.trim() !== filters.primarySutra) return false
  if (filters.secondarySutra !== 'all' && !secondarySutras(row).includes(filters.secondarySutra)) return false
  return quoteMatchesSearch(row, filters.query)
}

function sutraFacetChipOption(args: {
  groupId: string
  sutra: string
  count: number
  active: boolean
  disabled: boolean
  onClick: () => void
}): CatalogFilterBarFacetGroup['options'][number] {
  return {
    id: `${args.groupId}-${args.sutra}`,
    label: <span className={`catalog-facet-sutra-name ${sutraClassName(args.sutra)}`}>{args.sutra}</span>,
    count: args.count,
    active: args.active,
    disabled: args.disabled,
    onClick: args.onClick,
    className: sutraFilterChipClassName(args.sutra),
    title: `${sutraQuestionFromDisplay(args.sutra)} (${args.count} quotes)`,
  }
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

function museHref(muse: string): string {
  return `${canonicalPathForRoute('/muses')}?muse=${encodeURIComponent(muse)}`
}

type QuoteTopicCluster = {
  topic: string
  quotes: QuoteWallItem[]
}

function buildTopicClusters(rows: QuoteWallItem[]): QuoteTopicCluster[] {
  const byTopic = new Map<string, QuoteWallItem[]>()
  for (const row of rows) {
    const topic = topicLabel(row.core_topic)
    const list = byTopic.get(topic) ?? []
    list.push(row)
    byTopic.set(topic, list)
  }
  return [...byTopic.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([topic, items]) => ({
      topic,
      quotes: sortQuotes(items),
    }))
}

function QuoteItem({ item, showTopic = true }: { item: QuoteWallItem; showTopic?: boolean }) {
  const topic = topicLabel(item.core_topic)
  return (
    <figure className="quote-item">
      <span className="quote-item__mark" aria-hidden>
        &ldquo;
      </span>
      <blockquote className="quote-item__text">{item.quote}</blockquote>
      <figcaption className="quote-item__meta">
        {showTopic ? <span className="quote-item__topic">{topic}</span> : null}
        <Link to={museHref(item.muse)}>{item.muse}</Link>
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
}

export function QuoteWall() {
  const { data, error, loading } = useQuotesWall()
  const rows = useMemo(() => data ?? [], [data])
  const [topicFilter, setTopicFilter] = useState('all')
  const [primarySutraFilter, setPrimarySutraFilter] = useState('all')
  const [secondarySutraFilter, setSecondarySutraFilter] = useState('all')
  const [findQuote, setFindQuote] = useState('')
  const [filterBarExpanded, setFilterBarExpanded] = useState(false)

  const pageMeta = renderPageMeta({
    title: 'The Quotes',
    description:
      'Explore the quotes and ideas behind BANANASUTRA songs. Filter by primary or secondary sutra, topic, or search.',
    path: canonicalPathForRoute('/quotes'),
  })

  const primarySutraOptions = useMemo(() => {
    const counts = new Map<string, number>()
    for (const row of rows) {
      const sutra = row.primary_sutra.trim()
      if (sutra) counts.set(sutra, (counts.get(sutra) ?? 0) + 1)
    }
    return sortSutraDisplayNames([...counts.keys()]).map((sutra) => [sutra, counts.get(sutra) ?? 0] as const)
  }, [rows])

  const secondarySutraOptions = useMemo(() => {
    const counts = new Map<string, number>()
    for (const row of rows) {
      for (const sutra of secondarySutras(row)) {
        counts.set(sutra, (counts.get(sutra) ?? 0) + 1)
      }
    }
    return sortSutraDisplayNames([...counts.keys()]).map((sutra) => [sutra, counts.get(sutra) ?? 0] as const)
  }, [rows])

  const topicOptions = useMemo(() => {
    const counts = new Map<string, number>()
    for (const row of rows) {
      const topic = topicLabel(row.core_topic)
      counts.set(topic, (counts.get(topic) ?? 0) + 1)
    }
    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [rows])

  const normalizedFindQuery = useMemo(() => normalizeSearch(findQuote), [findQuote])
  const activeQuoteFilters = useMemo(
    () => ({
      topic: topicFilter,
      primarySutra: primarySutraFilter,
      secondarySutra: secondarySutraFilter,
      query: normalizedFindQuery,
    }),
    [topicFilter, primarySutraFilter, secondarySutraFilter, normalizedFindQuery],
  )

  const contextualPrimarySutraRows = useMemo(
    () =>
      rows.filter((row) =>
        quoteMatchesFilters(row, {
          topic: topicFilter,
          primarySutra: 'all',
          secondarySutra: secondarySutraFilter,
          query: normalizedFindQuery,
        }),
      ),
    [rows, topicFilter, secondarySutraFilter, normalizedFindQuery],
  )
  const contextualSecondarySutraRows = useMemo(
    () =>
      rows.filter((row) =>
        quoteMatchesFilters(row, {
          topic: topicFilter,
          primarySutra: primarySutraFilter,
          secondarySutra: 'all',
          query: normalizedFindQuery,
        }),
      ),
    [rows, topicFilter, primarySutraFilter, normalizedFindQuery],
  )
  const contextualTopicRows = useMemo(
    () =>
      rows.filter((row) =>
        quoteMatchesFilters(row, {
          topic: 'all',
          primarySutra: primarySutraFilter,
          secondarySutra: secondarySutraFilter,
          query: normalizedFindQuery,
        }),
      ),
    [rows, primarySutraFilter, secondarySutraFilter, normalizedFindQuery],
  )

  const filtered = useMemo(
    () => rows.filter((row) => quoteMatchesFilters(row, activeQuoteFilters)),
    [rows, activeQuoteFilters],
  )
  const sortedQuotes = useMemo(() => sortQuotes(filtered), [filtered])
  const quotesScrollResetKey = useMemo(
    () =>
      `${topicFilter}|${primarySutraFilter}|${secondarySutraFilter}|${normalizedFindQuery}`,
    [topicFilter, primarySutraFilter, secondarySutraFilter, normalizedFindQuery],
  )
  const {
    visibleItems: visibleQuotes,
    visibleCount: quotesVisibleCount,
    totalCount: quotesTotalCount,
    hasMore: quotesHasMore,
    loadMore: loadMoreQuotes,
  } = useCatalogInfiniteScroll({
    items: sortedQuotes,
    resetKey: quotesScrollResetKey,
    storageKey: catalogInfiniteScrollStorageKey('/quotes', quotesScrollResetKey),
  })
  const topicClusters = useMemo(() => buildTopicClusters(visibleQuotes), [visibleQuotes])
  const showGrouped = !normalizedFindQuery

  const findQuery = findQuote.trim()
  const quoteActivePills: CatalogFilterBarActivePill[] = []
  if (findQuery) {
    quoteActivePills.push({
      id: 'find',
      label: `Search: ${findQuery}`,
      onClick: () => setFindQuote(''),
    })
  }
  if (primarySutraFilter !== 'all') {
    quoteActivePills.push({
      id: 'primary-sutra',
      label: (
        <>
          Primary sutra:{' '}
          <span className={`catalog-facet-sutra-name ${sutraClassName(primarySutraFilter)}`}>
            {primarySutraFilter}
          </span>
        </>
      ),
      onClick: () => setPrimarySutraFilter('all'),
    })
  }
  if (secondarySutraFilter !== 'all') {
    quoteActivePills.push({
      id: 'secondary-sutra',
      label: (
        <>
          Secondary sutra:{' '}
          <span className={`catalog-facet-sutra-name ${sutraClassName(secondarySutraFilter)}`}>
            {secondarySutraFilter}
          </span>
        </>
      ),
      onClick: () => setSecondarySutraFilter('all'),
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
      id: 'primary-sutra',
      label: 'Primary sutra',
      allLabel: 'All primary sutras',
      allCount: contextualPrimarySutraRows.length,
      onClearGroup: () => setPrimarySutraFilter('all'),
      options: primarySutraOptions.map(([sutra]) => {
        const count = contextualPrimarySutraRows.filter((row) => row.primary_sutra.trim() === sutra).length
        return sutraFacetChipOption({
          groupId: 'primary-sutra',
          sutra,
          count,
          active: primarySutraFilter === sutra,
          disabled: primarySutraFilter !== sutra && count === 0,
          onClick: () => setPrimarySutraFilter(sutra),
        })
      }),
    },
    {
      id: 'secondary-sutra',
      label: 'Secondary sutra',
      allLabel: 'All secondary sutras',
      allCount: contextualSecondarySutraRows.length,
      onClearGroup: () => setSecondarySutraFilter('all'),
      options: secondarySutraOptions.map(([sutra]) => {
        const count = contextualSecondarySutraRows.filter((row) => secondarySutras(row).includes(sutra)).length
        return sutraFacetChipOption({
          groupId: 'secondary-sutra',
          sutra,
          count,
          active: secondarySutraFilter === sutra,
          disabled: secondarySutraFilter !== sutra && count === 0,
          onClick: () => setSecondarySutraFilter(sutra),
        })
      }),
    },
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
    setPrimarySutraFilter('all')
    setSecondarySutraFilter('all')
    setFindQuote('')
  }

  const resultSummary = `Showing ${formatCount(filtered.length)} of ${formatCount(rows.length)} quotes`

  if (loading) {
    return (
      <div className="about-page__body about-page__body--quotes about-page__body--loading">
        <section className="about-page__section about-page__section--loading" aria-labelledby="quotes-title-loading">
          <h2 id="quotes-title-loading" className="visually-hidden about-page__anchor-target">
            The quotes
          </h2>
          <CatalogProgressiveLoading label="Loading quotes" variant="page" />
        </section>
      </div>
    )
  }
  if (error || !data) return <p className="about-page__prose">{error ?? 'Could not load quotes data.'}</p>

  return (
    <div className="about-page__body about-page__body--quotes">
      {pageMeta}
      <section className="about-page__section" aria-labelledby="quotes-title">
        <h2 id="quotes-title" className="visually-hidden about-page__anchor-target">
          The quotes
        </h2>
        <p className="catalog-lp-section-intro">
          {formatCount(rows.length)} sparks that lit the songs. Grouped by what they&apos;re about. Filter by primary or
          secondary sutra, topic, or search when you want a narrower lane.
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
          {showGrouped ? (
            topicClusters.map((cluster) => (
              <section
                key={cluster.topic}
                className="quote-cluster"
                aria-labelledby={`quotes-topic-${cluster.topic.replace(/\s+/g, '-').toLowerCase()}`}
              >
                <h3
                  id={`quotes-topic-${cluster.topic.replace(/\s+/g, '-').toLowerCase()}`}
                  className="quote-cluster__title"
                >
                  {cluster.topic} <span>({formatCount(cluster.quotes.length)})</span>
                </h3>
                <div className="quote-cluster__items">
                  {cluster.quotes.map((item) => (
                    <QuoteItem
                      key={item.quote_id || `${item.muse}-${item.quote}`}
                      item={item}
                      showTopic={false}
                    />
                  ))}
                </div>
              </section>
            ))
          ) : (
            <div className="quote-cluster__items">
              {visibleQuotes.map((item) => (
                <QuoteItem key={item.quote_id || `${item.muse}-${item.quote}`} item={item} />
              ))}
            </div>
          )}
        </div>

        {sortedQuotes.length > 0 ? (
          <CatalogInfiniteScrollFooter
            visibleCount={quotesVisibleCount}
            totalCount={quotesTotalCount}
            hasMore={quotesHasMore}
            loadMore={loadMoreQuotes}
            noun="quotes"
            formatCount={formatCount}
          />
        ) : null}

        <Link className="catalog-section-cta about-quotes-crosslink" to={canonicalPathForRoute('/muses')}>
          Meet the muses →
        </Link>
      </section>
    </div>
  )
}
