import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuotesWall } from './generatedData'
import type { QuoteWallItem } from './types'
import { sutraClassName } from './sutraTheme'
import { SUTRA_CONTEXT, sutraHrefForFamily, type SutraFamilyKey } from './sutraContext'
import { usePageMeta } from './usePageMeta'

function formatCount(n: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(n)
}

function topicLabel(topic: string): string {
  return topic.trim() || 'Other'
}

function topicDomId(topic: string): string {
  return `quote-topic-${topic.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'other'}`
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

function groupQuotes(rows: QuoteWallItem[]): [string, QuoteWallItem[]][] {
  const grouped = new Map<string, QuoteWallItem[]>()
  for (const row of rows) {
    const key = topicLabel(row.core_topic)
    grouped.set(key, [...(grouped.get(key) ?? []), row])
  }
  return [...grouped.entries()]
    .map(([topic, quotes]) => [
      topic,
      quotes.sort((a, b) => a.muse.localeCompare(b.muse) || a.quote.localeCompare(b.quote)),
    ] as [string, QuoteWallItem[]])
    .sort((a, b) => a[0].localeCompare(b[0]))
}

export function QuoteWall() {
  const { data, error, loading } = useQuotesWall()
  const rows = useMemo(() => data ?? [], [data])
  const [topicFilter, setTopicFilter] = useState('all')
  const [findQuote, setFindQuote] = useState('')

  usePageMeta({
    title: 'The Quotes',
    description: 'Explore the quotes and ideas behind BANANASUTRA songs, grouped by theme.',
    path: '/about/quotes',
  })

  const topicOptions = useMemo(() => {
    const counts = new Map<string, number>()
    for (const row of rows) {
      const topic = topicLabel(row.core_topic)
      counts.set(topic, (counts.get(topic) ?? 0) + 1)
    }
    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [rows])

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
  const grouped = useMemo(() => groupQuotes(filtered), [filtered])

  if (loading) return <p className="about-page__prose">Loading quotes...</p>
  if (error || !data) return <p className="about-page__prose">{error ?? 'Could not load quotes data.'}</p>

  return (
    <div className="about-page__body">
      <section className="about-page__section" aria-labelledby="quotes-title">
        <h2 id="quotes-title" className="catalog-section-title about-page__anchor-target">
          The quotes
        </h2>
        <p className="about-page__prose">
          {formatCount(rows.length)} sparks that lit the songs, grouped by what they&apos;re about.
        </p>

        <label className="about-page-search">
          <span>Search quotes</span>
          <input
            type="search"
            value={findQuote}
            onChange={(event) => setFindQuote(event.target.value)}
            placeholder="Find a quote, muse, sutra, topic, or song..."
          />
        </label>

        <div className="about-filter-stack" aria-label="Quote filters">
          <div className="about-filter-group" aria-label="Filter quotes by topic">
            <button
              type="button"
              className={`about-filter-pill${topicFilter === 'all' ? ' is-active' : ''}`}
              onClick={() => setTopicFilter('all')}
            >
              All topics <span>{formatCount(rows.length)}</span>
            </button>
            {topicOptions.map(([topic, count]) => (
              <button
                key={topic}
                type="button"
                className={`about-filter-pill${topicFilter === topic ? ' is-active' : ''}`}
                onClick={() => setTopicFilter(topic)}
              >
                {topic} <span>{formatCount(count)}</span>
              </button>
            ))}
          </div>
        </div>

        <p className="about-result-count" aria-live="polite">
          Showing {formatCount(filtered.length)} of {formatCount(rows.length)} quotes.
        </p>

        <div className="quote-wall">
          {grouped.map(([topic, quotes]) => (
            <section key={topic} className="quote-cluster" aria-labelledby={topicDomId(topic)}>
              <h3 id={topicDomId(topic)} className="quote-cluster__title">
                {topic} <span>{formatCount(quotes.length)}</span>
              </h3>
              <div className="quote-cluster__items">
                {quotes.map((item) => {
                  return (
                    <figure key={item.quote_id || `${item.muse}-${item.quote}`} className="quote-item">
                      <span className="quote-item__mark" aria-hidden>
                        &ldquo;
                      </span>
                      <blockquote className="quote-item__text">{item.quote}</blockquote>
                      <figcaption className="quote-item__meta">
                        <Link to={`/about/muses?muse=${encodeURIComponent(item.muse)}`}>{item.muse}</Link>
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
                          <Link className="quote-item__song" to={`/songs/${item.inspired_song.slug}`}>
                            inspired: {item.inspired_song.title}
                          </Link>
                        ) : null}
                      </figcaption>
                    </figure>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      </section>
    </div>
  )
}
