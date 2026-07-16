import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  DISCOVERY_FACET_LABELS as FACET_LABELS,
  CATALOG_BROWSER_FACET_ORDER as FACET_GROUPS,
} from './catalogFacetConfig'
import { facetCountsFromSongs } from './facetCountsFromSongs'
import { buildContextualSongFacetEntries } from './facetCountsContextual'
import { filterSongsByFindAnyQuery } from './searchMatch'
import { emptyFilterState, type FacetGroupKey, type FilterFacetKey, type FilterState, type SongDetailNavState, type SortMode } from './types'
import { reportWordsFilterPatch } from './catalogAnalytics'
import { songMatchesFilters, sortSongs } from './filterSongs'
import { songCatalogPath } from './songPaths'
import { sutraClassName } from './sutraTheme'
import { sutraQuestionFromDisplay } from './sutraContext'
import { CatalogInfiniteScrollFooter } from './CatalogInfiniteScrollFooter'
import {
  catalogInfiniteScrollStorageKey,
  useCatalogInfiniteScroll,
} from './useCatalogInfiniteScroll'
import { GlobalFooter } from './GlobalFooter'
import { GlobalHeader } from './GlobalHeader'
import { CatalogProgressiveLoading } from './CatalogProgressiveLoading'
import { coverImageUrl } from '../seo/imageUrl'
import { canonicalPathForRoute } from './seoPaths'
import { renderPageMeta } from './usePageMeta'
import { useSyncCatalogHeaderHeight } from './useSyncCatalogHeaderHeight'
import { useSongCatalog } from './generatedData'
import { searchParamsFromSearchString } from './urlSearchParams'
import { parseSort, readCatalogBrowsePage, serializeBrowseQuery } from './urlState'
import { buildWordsPath, normalizeSortForWords, readWordsStateFromUrl } from './wordsUrlState'
import {
  songMatchesWordsBucket,
  songOnWordsSurface,
  wordsCardStoryBadge,
  type WordsStoryBucket,
} from './wordsStory'
import {
  CatalogFilterBar,
  type CatalogFilterBarActivePill,
  type CatalogFilterBarFacetGroup,
} from './CatalogFilterBar'
import { facetEntriesToToggleChips } from './catalogFilterBarBuilders'
import './CatalogApp.css'
import './WordsPage.css'

const FIND_DEBOUNCE_MS = 350

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
  const [legacyPageSeed] = useState(() => urlBrowsePage)
  const pageRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLElement>(null)
  const [sort, setSort] = useState<SortMode>(() => readWordsStateFromUrl().sort)
  const [filters, setFilters] = useState<FilterState>(() => readWordsStateFromUrl().filters)
  const [bucket, setBucket] = useState<WordsStoryBucket>(() => readWordsStateFromUrl().bucket)
  const [findDraft, setFindDraft] = useState(findQuery)
  const [filterBarExpanded, setFilterBarExpanded] = useState(false)

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

  const wordsPool = useMemo(() => {
    if (!songCatalogRows) return []
    return songCatalogRows.filter(songOnWordsSurface)
  }, [songCatalogRows])
  const fullFacetEntries = useMemo(() => facetCountsFromSongs(wordsPool), [wordsPool])

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
    let base = wordsPool.filter((song) => songMatchesFilters(song, filters))
    if (findQuery) base = filterSongsByFindAnyQuery(base, findQuery)
    const counts: Record<WordsStoryBucket, number> = { all: base.length, seedling: 0, works: 0 }
    for (const s of base) {
      if (songMatchesWordsBucket(s, 'seedling')) counts.seedling += 1
      if (songMatchesWordsBucket(s, 'works')) counts.works += 1
    }
    return counts
  }, [wordsPool, filters, findQuery])

  const contextualFacetEntries = useMemo(
    () =>
      buildContextualSongFacetEntries(
        wordsPool.filter((song) => songMatchesWordsBucket(song, bucket)),
        Object.fromEntries(
          FACET_GROUPS.map((group) => [group, fullFacetEntries[group] ?? []]),
        ) as Record<FilterFacetKey, { value: string; count: number }[]>,
        FACET_GROUPS,
        filters,
        'all',
        findQuery,
      ),
    [wordsPool, bucket, fullFacetEntries, filters, findQuery],
  )

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
    reportWordsFilterPatch(filters, next)
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

  const wordsScrollResetKey = useMemo(() => {
    const base = serializeBrowseQuery(sort, filters, findQuery || undefined, 'all', 1)
    return bucket === 'all' ? base : `${base}|wb=${bucket}`
  }, [sort, filters, findQuery, bucket])

  const {
    visibleItems: pagedWords,
    visibleCount: wordsVisibleCount,
    totalCount: wordsTotalCount,
    hasMore: wordsHasMore,
    loadMore: loadMoreWords,
  } = useCatalogInfiniteScroll({
    items: filteredSorted,
    resetKey: wordsScrollResetKey,
    storageKey: catalogInfiniteScrollStorageKey('/words', wordsScrollResetKey),
    legacyPage: legacyPageSeed,
  })

  useEffect(() => {
    if (urlBrowsePage <= 1) return
    navigate(buildWordsPath(sort, filters, findQuery || undefined, bucket, 1), { replace: true })
  }, [urlBrowsePage, sort, filters, findQuery, bucket, navigate])

  const facetSelections = countFacetSelections(filters)
  const hasActiveContext = facetSelections > 0 || bucket !== 'all' || Boolean(findQuery)
  const contextSummary = hasActiveContext
    ? `${filteredSorted.length} of ${wordsPool.length} lyrics · ${facetSelections} filter${
        facetSelections === 1 ? '' : 's'
      }${bucket !== 'all' ? ' · story filter' : ''}${findQuery ? ' · discovery filter' : ''}`
    : `${wordsPool.length} lyrics (unreleased)`

  const clearAllFilters = () => {
    const cleared = emptyFilterState()
    reportWordsFilterPatch(filters, cleared)
    setFilters(cleared)
    setBucket('all')
    setFindDraft('')
    syncUrl(sort, cleared, '', 'all', 1)
  }

  useSyncCatalogHeaderHeight(pageRef, headerRef, [
    sort,
    filterBarExpanded,
    facetSelections,
    bucket,
    filteredSorted.length,
    findQuery,
    findDraft,
    wordsVisibleCount,
  ])

  const wordsActivePills: CatalogFilterBarActivePill[] = []
  if (findQuery) {
    wordsActivePills.push({
      id: 'find',
      label: `Search: ${findQuery}`,
      onClick: () => syncUrl(sort, filters, '', bucket, 1),
    })
  }
  if (bucket !== 'all') {
    wordsActivePills.push({
      id: 'bucket',
      label: `Story: ${BUCKET_OPTIONS.find((b) => b.id === bucket)?.label}`,
      onClick: () => setBucketAndSync('all'),
    })
  }
  for (const key of Object.keys(filters) as (keyof FilterState)[]) {
    for (const value of filters[key]) {
      wordsActivePills.push({
        id: `${key}-${value}`,
        label: (
          <>
            {FACET_LABELS[key as FacetGroupKey] ?? key}:{' '}
            {key === 'sutra' ? (
              <span className={`catalog-facet-sutra-name ${sutraClassName(value)}`} title={sutraQuestionFromDisplay(value)}>
                {value}
              </span>
            ) : (
              value
            )}
          </>
        ),
        onClick: () => patchFilters({ ...filters, [key]: toggleSetMember(filters[key], value) }),
      })
    }
  }

  const wordsFacetGroups: CatalogFilterBarFacetGroup[] = [
    {
      id: 'story',
      label: 'Story',
      showAllChip: false,
      options: BUCKET_OPTIONS.map(({ id, label, help }) => {
        const active = bucket === id
        const count = bucketCounts[id]
        return {
          id: `bucket-${id}`,
          label,
          count,
          active,
          disabled: !active && count === 0,
          onClick: () => setBucketAndSync(id),
          title: help,
        }
      }),
    },
    ...FACET_GROUPS.flatMap((group) => {
      const entries = contextualFacetEntries[group] ?? []
      if (!entries.length) return []
      const filterKey = group as keyof FilterState
      return [
        {
          id: group,
          label: FACET_LABELS[group],
          showAllChip: false,
          options: facetEntriesToToggleChips({
            groupId: group,
            entries,
            isSutra: group === 'sutra',
            isActive: (value) => filters[filterKey].has(value),
            onToggle: (value) =>
              patchFilters({
                ...filters,
                [filterKey]: toggleSetMember(filters[filterKey], value),
              }),
            countLabel: 'lyrics',
          }),
        },
      ]
    }),
  ]

  if (catalogLoading) {
    return (
      <div ref={pageRef} className="catalog catalog-page catalog-page--shell words-page">
        <GlobalHeader ref={headerRef} />
        <div className="catalog-page__main">
          <article className="about-page catalog-layout-shell" id="main-content">
            <CatalogProgressiveLoading label="Loading song catalog" variant="page" />
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

        <div className="words-page__content">
          <CatalogFilterBar
            ariaLabel="Filter lyrics"
            panelId="words-filter-panel"
            resultSummary={contextSummary}
            activePills={wordsActivePills}
            onClearAll={clearAllFilters}
            facetGroups={wordsFacetGroups}
            search={{
              id: 'words-find-input',
              label: 'Search',
              ariaLabel: 'Search by title, summary, or lyric notes',
              value: findDraft,
              onChange: setFindDraft,
              inputName: 'words_find',
            }}
            defaultExpanded={filterBarExpanded}
            onExpandedChange={setFilterBarExpanded}
            toolbarEnd={
              <div className="catalog-sort words-page__sort" aria-label="Sort Words list by date or title">
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
            }
          />

          <main id="main-content" className="catalog-main words-page__main">
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
                        <img
                          src={coverImageUrl(song.cover_image_url, { width: 200 })}
                          alt=""
                          loading="lazy"
                          width={120}
                          height={120}
                        />
                      </div>
                    ) : null}
                  </Link>
                )
              })}
            </div>
            {filteredSorted.length > 0 ? (
              <CatalogInfiniteScrollFooter
                visibleCount={wordsVisibleCount}
                totalCount={wordsTotalCount}
                hasMore={wordsHasMore}
                loadMore={loadMoreWords}
                noun="lyrics"
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
