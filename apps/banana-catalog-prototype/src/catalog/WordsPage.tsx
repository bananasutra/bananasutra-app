import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  DISCOVERY_FACET_HELP as FACET_HELP,
  DISCOVERY_FACET_LABELS as FACET_LABELS,
  CATALOG_BROWSER_FACET_ORDER as FACET_GROUPS,
} from './catalogFacetConfig'
import { facetCountsFromSongs } from './facetCountsFromSongs'
import { filterSongsByFindAnyQuery } from './searchMatch'
import { emptyFilterState, type FacetGroupKey, type FilterState, type SongDetailNavState, type SortMode } from './types'
import { songMatchesFilters, sortSongs } from './filterSongs'
import { songCatalogPath } from './songPaths'
import { sutraClassName } from './sutraTheme'
import { sutraQuestionFromDisplay } from './sutraContext'
import { CatalogPager } from './CatalogPager'
import './CatalogPager.css'
import { GlobalFooter } from './GlobalFooter'
import { GlobalHeader } from './GlobalHeader'
import { canonicalPathForRoute } from './seoPaths'
import { renderPageMeta } from './usePageMeta'
import { useSyncCatalogHeaderHeight } from './useSyncCatalogHeaderHeight'
import { useSongCatalog } from './generatedData'
import { searchParamsFromSearchString } from './urlSearchParams'
import { parseSort, readCatalogBrowsePage } from './urlState'
import {
  songMatchesWordsBucket,
  songOnWordsSurface,
  wordsCardStoryBadge,
  type WordsStoryBucket,
} from './wordsStory'
import { buildWordsPath, normalizeSortForWords, readWordsStateFromUrl } from './wordsUrlState'
import './CatalogApp.css'
import './WordsPage.css'

const FIND_DEBOUNCE_MS = 350
const PAGE_SIZE = 30

function toggleSetMember(set: Set<string>, value: string): Set<string> {
  const next = new Set(set)
  if (next.has(value)) next.delete(value)
  else next.add(value)
  return next
}

function countFacetSelections(f: FilterState): number {
  return (
    f.sutra.size +
    f.topic.size +
    f.intention.size +
    f.light_shadow.size +
    f.written_year.size +
    f.track_genre.size +
    f.track_secondary_genre.size +
    f.track_instrument.size +
    f.lang.size
  )
}

const BUCKET_OPTIONS: { id: WordsStoryBucket; label: string; help: string }[] = [
  {
    id: 'all',
    label: 'All',
    help: 'Every unreleased lyric in this list, any stage of writing or production.',
  },
  {
    id: 'seedling',
    label: 'New seedling',
    help: 'Freshly written, just landed, still finding its shape.',
  },
  {
    id: 'works',
    label: 'In the works',
    help: 'In production: being arranged, mixed, or readied for release.',
  },
]

export function WordsPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { data: songCatalogRows, error: catalogError, loading: catalogLoading } = useSongCatalog()
  const findQuery = useMemo(
    () => searchParamsFromSearchString(location.search).get('find')?.trim() ?? '',
    [location.search],
  )
  const urlBrowsePage = useMemo(() => readCatalogBrowsePage(location.search), [location.search])
  const pageRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLElement>(null)
  const [sort, setSort] = useState<SortMode>(() => readWordsStateFromUrl().sort)
  const [filters, setFilters] = useState<FilterState>(() => readWordsStateFromUrl().filters)
  const [bucket, setBucket] = useState<WordsStoryBucket>(() => readWordsStateFromUrl().bucket)
  const [findDraft, setFindDraft] = useState(findQuery)
  const [filtersOpen, setFiltersOpen] = useState(() =>
    typeof window === 'undefined' ? true : window.innerWidth >= 900,
  )

  const sortRef = useRef(sort)
  const filtersRef = useRef(filters)
  const bucketRef = useRef(bucket)
  useEffect(() => {
    sortRef.current = sort
    filtersRef.current = filters
    bucketRef.current = bucket
  }, [sort, filters, bucket])

  const pageMeta = renderPageMeta({
    title: 'Lyrics & Words',
    description: 'Read BANANASUTRA lyrics. Searchable song words, meaning first.',
    path: canonicalPathForRoute('/words'),
  })

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 899px)')
    const syncFiltersToViewport = () => {
      if (mq.matches) setFiltersOpen(false)
    }
    syncFiltersToViewport()
    mq.addEventListener('change', syncFiltersToViewport)
    return () => mq.removeEventListener('change', syncFiltersToViewport)
  }, [])

  const wordsPool = useMemo(() => {
    if (!songCatalogRows) return []
    return songCatalogRows.filter(songOnWordsSurface)
  }, [songCatalogRows])
  const facets = useMemo(() => facetCountsFromSongs(wordsPool), [wordsPool])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- keep find draft aligned when `find` param changes externally
    setFindDraft(findQuery)
  }, [findQuery])

  useEffect(() => {
    if (findDraft === findQuery) return
    const tid = window.setTimeout(() => {
      navigate(
        buildWordsPath(
          sortRef.current,
          filtersRef.current,
          findDraft.trim() || undefined,
          bucketRef.current,
          1,
        ),
        { replace: true },
      )
    }, FIND_DEBOUNCE_MS)
    return () => window.clearTimeout(tid)
  }, [findDraft, findQuery, navigate])

  const bucketCounts = useMemo(() => {
    const counts: Record<WordsStoryBucket, number> = { all: wordsPool.length, seedling: 0, works: 0 }
    for (const s of wordsPool) {
      if (songMatchesWordsBucket(s, 'seedling')) counts.seedling += 1
      if (songMatchesWordsBucket(s, 'works')) counts.works += 1
    }
    return counts
  }, [wordsPool])

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const parsedFromUrl = parseSort(params.get('sort'))
    const next = readWordsStateFromUrl()
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync Words UI from URL (history / manual query edits)
    setSort(next.sort)
    setFilters(next.filters)
    setBucket(next.bucket)
    if (normalizeSortForWords(parsedFromUrl) !== parsedFromUrl) {
      navigate(
        buildWordsPath(
          next.sort,
          next.filters,
          next.find || undefined,
          next.bucket,
          readCatalogBrowsePage(location.search),
        ),
        { replace: true },
      )
    }
  }, [location.search, navigate])

  const syncUrl = useCallback(
    (
      nextSort: SortMode,
      nextFilters: FilterState,
      findOverride: string | undefined,
      nextBucket: WordsStoryBucket,
      nextPage?: number,
    ) => {
      const nextFind = findOverride !== undefined ? findOverride.trim() : findQuery
      const p = nextPage !== undefined ? nextPage : urlBrowsePage
      navigate(buildWordsPath(nextSort, nextFilters, nextFind || undefined, nextBucket, p), { replace: true })
    },
    [findQuery, navigate, urlBrowsePage],
  )

  const setSortAndSync = (mode: SortMode) => {
    setSort(mode)
    syncUrl(mode, filters, undefined, bucket, 1)
  }

  const patchFilters = (next: FilterState) => {
    setFilters(next)
    syncUrl(sort, next, undefined, bucket, 1)
  }

  const setBucketAndSync = (next: WordsStoryBucket) => {
    setBucket(next)
    syncUrl(sort, filters, undefined, next, 1)
  }

  const filteredSorted = useMemo(() => {
    let list = wordsPool.filter(
      (s) => songMatchesFilters(s, filters) && songMatchesWordsBucket(s, bucket),
    )
    if (findQuery) list = filterSongsByFindAnyQuery(list, findQuery)
    return sortSongs(list, sort)
  }, [wordsPool, filters, bucket, sort, findQuery])

  const pageCount = Math.max(1, Math.ceil(filteredSorted.length / PAGE_SIZE))
  const safePage = Math.min(urlBrowsePage, pageCount)
  const pagedWords = useMemo(
    () => filteredSorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [filteredSorted, safePage],
  )

  useEffect(() => {
    if (urlBrowsePage !== safePage) {
      navigate(buildWordsPath(sort, filters, findQuery || undefined, bucket, safePage), { replace: true })
    }
  }, [urlBrowsePage, safePage, sort, filters, findQuery, bucket, navigate])

  const pagerLink = useCallback(
    (target: number) => buildWordsPath(sort, filters, findQuery || undefined, bucket, target),
    [sort, filters, findQuery, bucket],
  )

  const facetSelections = countFacetSelections(filters)
  const hasActiveContext = facetSelections > 0 || bucket !== 'all' || Boolean(findQuery)
  const contextSummary = hasActiveContext
    ? `${filteredSorted.length} of ${wordsPool.length} lyrics · ${facetSelections} filter${
        facetSelections === 1 ? '' : 's'
      }${bucket !== 'all' ? ' · story filter' : ''}${findQuery ? ' · discovery filter' : ''}`
    : `${wordsPool.length} lyrics (unreleased)`

  const clearAllFilters = () => {
    const cleared = emptyFilterState()
    setFilters(cleared)
    setBucket('all')
    setFindDraft('')
    syncUrl(sort, cleared, '', 'all', 1)
  }

  useSyncCatalogHeaderHeight(pageRef, headerRef, [
    sort,
    filtersOpen,
    facetSelections,
    bucket,
    filteredSorted.length,
    findQuery,
    findDraft,
    urlBrowsePage,
    safePage,
  ])

  const activeFilterContext = (
    <section
      className="catalog-active-context"
      aria-label={hasActiveContext ? 'Active filters and result count' : 'Words result count'}
    >
      <p className="catalog-active-context__summary">{contextSummary}</p>
      {hasActiveContext ? (
        <div className="catalog-chips">
          {findQuery ? (
            <button type="button" className="catalog-chip catalog-chip--find" onClick={() => syncUrl(sort, filters, '', bucket, 1)}>
              Discovery: {findQuery}
              <span className="catalog-chip-x" aria-hidden>
                ×
              </span>
            </button>
          ) : null}
          {bucket !== 'all' ? (
            <button type="button" className="catalog-chip" onClick={() => setBucketAndSync('all')}>
              Story: {BUCKET_OPTIONS.find((b) => b.id === bucket)?.label}
              <span className="catalog-chip-x" aria-hidden>
                ×
              </span>
            </button>
          ) : null}
          {(Object.keys(filters) as (keyof FilterState)[]).flatMap((key) =>
            [...filters[key]].map((value) => (
              <button
                key={`${key}-${value}`}
                type="button"
                className="catalog-chip"
                onClick={() => patchFilters({ ...filters, [key]: toggleSetMember(filters[key], value) })}
              >
                {FACET_LABELS[key as FacetGroupKey] ?? key}:{' '}
                {key === 'sutra' ? (
                  <span className={`catalog-facet-sutra-name ${sutraClassName(value)}`} title={sutraQuestionFromDisplay(value)}>{value}</span>
                ) : (
                  value
                )}
                <span className="catalog-chip-x" aria-hidden>
                  ×
                </span>
              </button>
            )),
          )}
          <button type="button" className="catalog-clear" onClick={clearAllFilters}>
            Clear all
          </button>
        </div>
      ) : null}
    </section>
  )

  if (catalogLoading) {
    return (
      <div ref={pageRef} className="catalog catalog-page catalog-page--shell words-page">
        <GlobalHeader ref={headerRef} />
        <div className="catalog-page__main">
          <article className="about-page catalog-layout-shell" id="main-content">
            <p className="about-page__p">Loading song catalog…</p>
          </article>
        </div>
        <GlobalFooter />
      </div>
    )
  }

  if (catalogError || songCatalogRows === null) {
    return (
      <div ref={pageRef} className="catalog catalog-page catalog-page--shell words-page">
        <GlobalHeader ref={headerRef} />
        <div className="catalog-page__main">
          <article className="about-page catalog-layout-shell" id="main-content">
            <p className="about-page__p">{catalogError ?? 'Could not load song catalog data.'}</p>
            <p className="about-page__p">
              Try refreshing the page. If this persists, the catalog asset may be missing from the build.
            </p>
          </article>
        </div>
        <GlobalFooter />
      </div>
    )
  }

  return (
    <div ref={pageRef} className="catalog catalog-page catalog-page--shell words-page">
      {pageMeta}
      <GlobalHeader ref={headerRef} />

      <div className="catalog-page__main">
        <nav className="catalog-breadcrumbs" aria-label="Breadcrumb">
          <Link className="catalog-breadcrumbs__link" to="/">
            Home
          </Link>
          <span className="catalog-breadcrumbs__sep" aria-hidden>
            /
          </span>
          <span className="catalog-breadcrumbs__current" aria-current="page">
            Words
          </span>
        </nav>

        <div className="catalog-page-intro catalog-page-intro--song-catalog">
          <h1 className="catalog-page-h1">The Words</h1>
          <p className="catalog-page-sub">
            Lyrics without music. Pieces still brewing, seedlings waiting for a voice, or songs that live as text
            alone. When they find their sound, they move to{' '}
            <Link to={canonicalPathForRoute('/songs')}>
              Songs
            </Link>
            .
          </p>
        </div>

        <div className={`catalog-layout${filtersOpen ? '' : ' catalog-layout--filters-collapsed'}`}>
          <aside
            className={`catalog-filters${filtersOpen ? ' is-open' : ''}`}
            aria-labelledby="words-filters-heading"
          >
            <div className="catalog-filters-head">
              <h2 id="words-filters-heading" className="catalog-section-title">
                Filters
              </h2>
              <button
                type="button"
                className="catalog-icon-btn"
                onClick={() => setFiltersOpen(false)}
                aria-expanded={filtersOpen}
                aria-controls="words-filter-panel"
              >
                Hide
              </button>
            </div>

            {filtersOpen ? activeFilterContext : null}

            <div id="words-filter-panel" className="catalog-facet-stack">
              <section className="catalog-facet" aria-labelledby="words-search-heading">
                <h3 id="words-search-heading">Search</h3>
                <label className="catalog-facet-find-label" htmlFor="words-find-input">
                  Search by title, summary, or lyric notes
                </label>
                <input
                  id="words-find-input"
                  className="catalog-facet-find-input"
                  type="search"
                  name="words_find"
                  inputMode="search"
                  autoComplete="off"
                  spellCheck={false}
                  enterKeyHint="search"
                  value={findDraft}
                  onChange={(e) => setFindDraft(e.target.value)}
                />
              </section>
              <section className="catalog-facet" aria-labelledby="words-bucket-heading">
                <h3 id="words-bucket-heading">Story</h3>
                <p className="catalog-facet-help" id="words-bucket-desc">
                  Lyrics without a release yet, songs still growing. <em>New seedling</em> = freshly written.{' '}
                  <em>In the works</em> = being produced. Songs that are already published live on{' '}
                  <Link to={canonicalPathForRoute('/songs')}>
                    Songs
                  </Link>{' '}
                  instead.
                </p>
                <div className="catalog-facet-chips" role="group" aria-describedby="words-bucket-desc">
                  {BUCKET_OPTIONS.map(({ id, label, help }) => {
                    const active = bucket === id
                    const count = bucketCounts[id]
                    return (
                      <button
                        key={id}
                        type="button"
                        className={`catalog-facet-chip${active ? ' is-active' : ''}`}
                        onClick={() => setBucketAndSync(id)}
                        title={help}
                      >
                        <span>{label}</span>
                        <span className="catalog-facet-count">{` (${count})`}</span>
                      </button>
                    )
                  })}
                </div>
              </section>
              {FACET_GROUPS.map((group) => {
                const entries = facets[group] ?? []
                if (!entries.length) return null
                const filterKey = group as keyof FilterState
                const headingId = `words-${group}-heading`
                return (
                  <section key={group} className="catalog-facet" aria-labelledby={headingId}>
                    <h3 id={headingId} title={FACET_HELP[group]}>
                      {FACET_LABELS[group]}
                    </h3>
                    <div className="catalog-facet-chips" role="group" aria-labelledby={headingId}>
                      {entries.map(({ value, count }) => {
                        const active = filters[filterKey].has(value)
                        return (
                          <button
                            key={value}
                            type="button"
                            className={`catalog-facet-chip${active ? ' is-active' : ''}`}
                            onClick={() =>
                              patchFilters({
                                ...filters,
                                [filterKey]: toggleSetMember(filters[filterKey], value),
                              })
                            }
                            title={group === 'sutra' ? `${sutraQuestionFromDisplay(value)} (${count} lyrics)` : `${count} lyrics`}
                          >
                            {group === 'sutra' ? (
                              <span className={`catalog-facet-sutra-name ${sutraClassName(value)}`}>{value}</span>
                            ) : (
                              <span>{value}</span>
                            )}
                            <span className="catalog-facet-count">{` (${count})`}</span>
                          </button>
                        )
                      })}
                    </div>
                  </section>
                )
              })}
            </div>
          </aside>

          <main id="main-content" className="catalog-main">
            <div className="catalog-main__sort-row">
              <div className="catalog-sort" aria-label="Sort Words list by date or title">
                <label className="catalog-sort-label" htmlFor="words-sort-select">
                  Sort
                </label>
                <select
                  id="words-sort-select"
                  className="catalog-sort-select"
                  value={sort}
                  onChange={(e) => setSortAndSync(e.target.value as SortMode)}
                >
                  <option value="newest">Newest (catalog publish date)</option>
                  <option value="title_az">Song title (A–Z)</option>
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
                  aria-controls="words-filter-panel"
                >
                  Show filters
                </button>
              </>
            ) : null}

            {filteredSorted.length > 0 ? (
              <CatalogPager
                variant="top"
                safePage={safePage}
                pageCount={pageCount}
                totalInView={filteredSorted.length}
                pageSize={PAGE_SIZE}
                pagerLink={pagerLink}
              />
            ) : null}
            <div className="words-page__grid">
              {pagedWords.map((song) => {
                const secondaryMeta = [song.topic, song.intention, song.light_shadow]
                  .map((value) => value.trim())
                  .filter(Boolean)
                const story = wordsCardStoryBadge(song)
                const storyLabel =
                  story === 'seedling'
                    ? '(New seedling)'
                    : story === 'works'
                      ? '(In the works)'
                      : ''
                const secondaryParts = storyLabel ? [...secondaryMeta, storyLabel] : secondaryMeta
                const secondaryLine = secondaryParts.join(' · ')
                return (
                  <Link
                    key={song.lyrics_id}
                    to={songCatalogPath(song.lyrics_title, song.url_slug)}
                    state={
                      {
                        wordsListReturn: `${location.pathname}${location.search}`,
                      } satisfies SongDetailNavState
                    }
                    className="words-card words-card-link"
                  >
                    <div className="words-card__text">
                      <h2 className="words-card__title song-title">{song.lyrics_title}</h2>
                      {song.summary_short ? <p className="words-card__summary">{song.summary_short}</p> : null}
                      <div className="words-card__meta catalog-card-meta">
                        {song.sutra.trim() ? (
                          <span className={`catalog-sutra-word ${sutraClassName(song.sutra.trim())}`}>{song.sutra.trim()}</span>
                        ) : null}
                        {secondaryLine ? (
                          <span
                            className="catalog-card-meta-secondary"
                            title={secondaryLine}
                            aria-label={`Tags: ${secondaryParts.join(', ')}`}
                          >
                            {secondaryLine}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    {song.cover_image_url ? (
                      <div className="words-card__thumb" aria-hidden>
                        <img src={song.cover_image_url} alt="" loading="lazy" width={120} height={120} />
                      </div>
                    ) : null}
                  </Link>
                )
              })}
            </div>
            {filteredSorted.length > 0 ? (
              <CatalogPager
                variant="bottom"
                safePage={safePage}
                pageCount={pageCount}
                totalInView={filteredSorted.length}
                pageSize={PAGE_SIZE}
                pagerLink={pagerLink}
              />
            ) : null}
            {filteredSorted.length === 0 ? (
              <p className="catalog-empty">Nothing matches these filters. Try clearing the story filter or another filter.</p>
            ) : null}
          </main>
        </div>
      </div>

      <GlobalFooter />
    </div>
  )
}
