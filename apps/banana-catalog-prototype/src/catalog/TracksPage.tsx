import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent, MouseEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { catalogDataFileUrl, fetchCatalogData } from './catalogDataUrl'
import { TRACKS_BROWSER_FACET_ORDER, TRACKS_FACET_LABELS } from './catalogFacetConfig'
import { CatalogInfiniteScrollFooter } from './CatalogInfiniteScrollFooter'
import {
  catalogInfiniteScrollStorageKey,
  useCatalogInfiniteScroll,
} from './useCatalogInfiniteScroll'
import { facetCountsFromTracks } from './facetCountsFromTracks'
import { buildContextualTrackFacetEntries } from './facetCountsContextual'
import { reportTracksFilterPatch } from './catalogAnalytics'
import { filterTracksByFindQuery, sortTrackCatalog, trackMatchesFilters } from './filterTracks'
import {
  CatalogFilterBar,
  type CatalogFilterBarActivePill,
  type CatalogFilterBarFacetGroup,
} from './CatalogFilterBar'
import { facetEntriesToToggleChips } from './catalogFilterBarBuilders'
import { GlobalFooter } from './GlobalFooter'
import { GlobalHeader } from './GlobalHeader'
import { LazySoundCloudEmbed } from './LazySoundCloudEmbed'
import { songCatalogPath } from './songPaths'
import type { FacetEntry, TrackCatalogItem, TrackSortMode, TracksFacetFilterKey, TracksFilterState } from './types'
import { emptyTracksFilterState } from './types'
import {
  buildTracksBrowsePathFull,
  readTracksBrowseFromSearch,
  serializeTracksBrowseQuery,
} from './urlState'
import { buildSrcset } from '../seo/imageUrl'
import { CoverImage } from './CoverImage'
import { canonicalPathForRoute } from './seoPaths'
import { usePlayAllDesktopAvailable } from './playAllPlatform'
import { persistentBarOwnsQueueChrome } from './playerQueue/pageQueueChrome'
import { songbookHintForTracksFilters } from './tracksFilterSongbookHint'
import { renderPageMeta } from './usePageMeta'
import { useSyncCatalogHeaderHeight } from './useSyncCatalogHeaderHeight'
import { formatDurationDisplay } from './durationFormat'
import {
  trackCatalogItemToPlayable,
  queueContextLine,
  queueSessionActive,
  queueSessionOwnsPage,
  selectedTrackId,
  usePlayerQueue,
  usePlayerQueueInternals,
  usePlayerQueuePageBridge,
  useTracksPagePlayerQueue,
} from './playerQueue'
import { sutraQuestionFromDisplay } from './sutraContext'
import { sutraClassName } from './sutraTheme'
import './CatalogApp.css'
import './AboutPage.css'
import './TracksPage.css'

const FIND_DEBOUNCE_MS = 350
const EMPTY_TRACK_FACETS: Record<TracksFacetFilterKey, FacetEntry[]> = {
  sutra: [],
  light_shadow: [],
  primary_genre: [],
  secondary_genre: [],
  mood: [],
  instrument: [],
  tempo_feel: [],
}

function thumbSrc(url: string, size = 't200x200'): string {
  const u = url.trim()
  if (!u) return ''
  return u
    .replace(/-t\d+x\d+\./i, `-${size}.`)
    .replace(/-toriginal\./i, `-${size}.`)
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 10_000) return `${Math.round(n / 1000)}k`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

function genreLine(t: TrackCatalogItem): string {
  const parts = [t.primary_genre, ...(t.secondary_genres ?? [])].map((s) => s.trim()).filter(Boolean)
  return [...new Set(parts.map((p) => p))].slice(0, 6).join(' · ')
}

function toggleSetMember(set: Set<string>, value: string): Set<string> {
  const next = new Set(set)
  if (next.has(value)) next.delete(value)
  else next.add(value)
  return next
}

function countTracksSelections(f: TracksFilterState): number {
  return (
    f.sutra.size +
    f.light_shadow.size +
    f.primary_genre.size +
    f.secondary_genre.size +
    f.mood.size +
    f.instrument.size +
    f.tempo_feel.size
  )
}

export function TracksPage() {
  const pageRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLElement>(null)
  const location = useLocation()
  const navigate = useNavigate()
  const playAllDesktopAvailable = usePlayAllDesktopAvailable()
  const [trackCatalog, setTrackCatalog] = useState<TrackCatalogItem[] | null>(null)
  const [catalogLoadError, setCatalogLoadError] = useState<string | null>(null)

  const [filterBarExpanded, setFilterBarExpanded] = useState(false)

  const { filters: urlFilters, find: urlFind, page: urlPage, sort: urlSort } = useMemo(
    () => readTracksBrowseFromSearch(location.search),
    [location.search],
  )
  const [legacyPageSeed] = useState(() => urlPage)

  const [filters, setFilters] = useState<TracksFilterState>(urlFilters)
  const [findDraft, setFindDraft] = useState(urlFind)
  const filtersRef = useRef(filters)
  const urlSortRef = useRef(urlSort)
  useEffect(() => {
    filtersRef.current = filters
  }, [filters])
  useEffect(() => {
    urlSortRef.current = urlSort
  }, [urlSort])

  useEffect(() => {
    let cancelled = false
    const loadCatalog = async () => {
      // Keep no-store for local preview reliability: stale/corrupt cached JSON (or cached HTML fallback)
      // can otherwise persist after a port/server swap and look like intermittent data loss.
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          const r = await fetchCatalogData(catalogDataFileUrl('track_catalog.json'))
          if (!cancelled) setCatalogLoadError(null)
          if (!r.ok) throw new Error(`HTTP ${r.status}`)
          const rows = (await r.json()) as unknown
          if (!Array.isArray(rows)) throw new Error('Invalid track catalog payload')
          if (!cancelled) setTrackCatalog(rows as TrackCatalogItem[])
          return
        } catch {
          if (attempt === 0) {
            await new Promise((resolve) => window.setTimeout(resolve, 350))
            continue
          }
          if (!cancelled) {
            setTrackCatalog(null)
            setCatalogLoadError('Could not load track catalog data.')
          }
        }
      }
    }
    void loadCatalog()
    return () => {
      cancelled = true
    }
  }, [])

  const [nonCriticalReady, setNonCriticalReady] = useState(
    () =>
      typeof window === 'undefined' ||
      countTracksSelections(urlFilters) > 0 ||
      Boolean(urlFind.trim()) ||
      urlSort !== 'likes' ||
      legacyPageSeed > 1,
  )

  useEffect(() => {
    if (nonCriticalReady) return
    let cancelled = false
    const activate = () => {
      if (!cancelled) setNonCriticalReady(true)
    }
    const requestIdle = (
      window as Window & {
        requestIdleCallback?: (cb: () => void, options?: { timeout: number }) => number
      }
    ).requestIdleCallback
    const cancelIdle = (window as Window & { cancelIdleCallback?: (handle: number) => void }).cancelIdleCallback
    if (typeof requestIdle === 'function') {
      const idleId = requestIdle(activate, { timeout: 900 })
      return () => {
        cancelled = true
        if (typeof cancelIdle === 'function') cancelIdle(idleId)
      }
    }
    const timeoutId = window.setTimeout(activate, 0)
    return () => {
      cancelled = true
      window.clearTimeout(timeoutId)
    }
  }, [nonCriticalReady])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mirror URL into tracks panel (history / shared links)
    setFilters(urlFilters)
    setFindDraft(urlFind)
  }, [urlFilters, urlFind])

  useEffect(() => {
    if (findDraft === urlFind) return
    const tid = window.setTimeout(() => {
      const preserve = new URLSearchParams(location.search)
      navigate(
        buildTracksBrowsePathFull(filtersRef.current, findDraft, 1, preserve, urlSortRef.current),
        { replace: true },
      )
    }, FIND_DEBOUNCE_MS)
    return () => window.clearTimeout(tid)
  }, [findDraft, urlFind, location.search, navigate])

  const [embedHeight, setEmbedHeight] = useState(300)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)')
    const apply = () => setEmbedHeight(mq.matches ? 180 : 300)
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])

  const catalogList = useMemo(() => trackCatalog ?? [], [trackCatalog])
  const fullFacetEntries = useMemo(
    () => (nonCriticalReady ? facetCountsFromTracks(catalogList) : EMPTY_TRACK_FACETS),
    [catalogList, nonCriticalReady],
  )
  const facetEntries = useMemo(
    () =>
      buildContextualTrackFacetEntries(
        catalogList,
        fullFacetEntries,
        TRACKS_BROWSER_FACET_ORDER,
        filters,
        urlFind,
      ),
    [catalogList, fullFacetEntries, filters, urlFind],
  )

  const filtered = useMemo(() => {
    let list = catalogList.filter((t) => trackMatchesFilters(t, filters))
    list = filterTracksByFindQuery(list, urlFind)
    list = sortTrackCatalog(list, urlSort)
    return list
  }, [catalogList, filters, urlFind, urlSort])

  const tracksScrollResetKey = useMemo(
    () => serializeTracksBrowseQuery(filters, urlFind, 1, new URLSearchParams(), urlSort),
    [filters, urlFind, urlSort],
  )

  const {
    visibleItems: listRows,
    visibleCount: tracksVisibleCount,
    totalCount: tracksTotalCount,
    hasMore: tracksHasMore,
    loadMore: loadMoreTracks,
    ensureVisibleThroughIndex,
    resetVisible,
  } = useCatalogInfiniteScroll({
    items: filtered,
    resetKey: tracksScrollResetKey,
    storageKey: catalogInfiniteScrollStorageKey('/tracks', tracksScrollResetKey),
    legacyPage: legacyPageSeed,
  })

  useEffect(() => {
    if (urlPage <= 1) return
    const preserve = new URLSearchParams(location.search)
    navigate(buildTracksBrowsePathFull(filters, urlFind, 1, preserve, urlSort), { replace: true })
  }, [urlPage, filters, urlFind, urlSort, location.search, navigate])

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [embedReloadKey, setEmbedReloadKey] = useState(0)
  /** SoundCloud `auto_play` only after an explicit row action — not on first paint / URL-driven page slice. */
  const [scAutoplay, setScAutoplay] = useState(false)
  const skipScAutoplayOffOnNextSelectionChange = useRef(false)

  const playerWrapRef = useRef<HTMLDivElement>(null)
  const filteredRef = useRef<TrackCatalogItem[]>([])
  const selectedIdRef = useRef<string | null>(null)
  const filtersRefForAdvance = useRef<TracksFilterState>(filters)
  const urlFindRefForAdvance = useRef<string>(urlFind)
  const urlSortRefForAdvance = useRef<TrackSortMode>(urlSort)
  const scrollActiveRowOnNextPaintRef = useRef(false)
  const trackListRef = useRef<HTMLUListElement>(null)

  useEffect(() => {
    filteredRef.current = filtered
  }, [filtered])
  useEffect(() => {
    selectedIdRef.current = selectedId
  }, [selectedId])
  useEffect(() => {
    filtersRefForAdvance.current = filters
  }, [filters])
  useEffect(() => {
    urlFindRefForAdvance.current = urlFind
  }, [urlFind])
  useEffect(() => {
    urlSortRefForAdvance.current = urlSort
  }, [urlSort])

  const { registration, startPlayAllFromPage } = useTracksPagePlayerQueue({
    filteredRef,
    selectedIdRef,
    filtersRef: filtersRefForAdvance,
    urlFindRef: urlFindRefForAdvance,
    urlSortRef: urlSortRefForAdvance,
    onBeforePlayTrack: () => {
      skipScAutoplayOffOnNextSelectionChange.current = true
    },
    ensureVisibleThroughIndex,
    resetVisible,
    scrollActiveRowOnNextPaintRef,
    setScAutoplay,
    setSelectedId,
    setEmbedReloadKey,
  })
  const { bindWidgetOnLoad, resetSession } = usePlayerQueueInternals()
  usePlayerQueuePageBridge('tracks-page', registration, {
    startPlayAllFromPage,
    resetSession,
    bindWidgetOnLoad,
  })
  const { state: queueState, actions: queueActions } = usePlayerQueue()
  const playAllActive = queueState.playAllActive
  const isScPlaying = queueState.playing
  const persistentBarOwnsQueue = persistentBarOwnsQueueChrome(playAllDesktopAvailable, playAllActive)
  const mobileSongbookHint = useMemo(
    () => songbookHintForTracksFilters(filters, urlFind),
    [filters, urlFind],
  )
  const playingTrackId = selectedTrackId(queueState)
  const sessionActive = queueSessionActive(queueState)
  const queueOwnsPage = queueSessionOwnsPage(queueState, 'tracks')
  const foreignSessionActive = sessionActive && !queueOwnsPage
  const foreignPlaybackNote = useMemo(() => {
    const line = queueContextLine(queueState).trim()
    if (!line) return 'Playing in mini player below. Use the bar for controls.'
    return `${line}. Use the mini player for controls.`
  }, [queueState])

  useEffect(() => {
    if (!listRows.length) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clear player when list slice is empty
      setSelectedId(null)
      setScAutoplay(false)
      if (trackCatalog === null) return
      if (sessionActive) return
      if (filtered.length === 0) {
        resetSession()
      }
      return
    }
    setSelectedId((prev) => {
      if (playingTrackId && listRows.some((t) => t.track_id === playingTrackId)) {
        return playingTrackId
      }
      if (sessionActive && playingTrackId) return null
      if (prev && listRows.some((t) => t.track_id === prev)) return prev
      return listRows[0]?.track_id ?? null
    })
  }, [
    filtered.length,
    listRows,
    playingTrackId,
    resetSession,
    sessionActive,
    trackCatalog,
  ])

  useEffect(() => {
    if (skipScAutoplayOffOnNextSelectionChange.current) {
      skipScAutoplayOffOnNextSelectionChange.current = false
      return
    }
    setScAutoplay(false)
  }, [selectedId])

  useLayoutEffect(() => {
    if (!scrollActiveRowOnNextPaintRef.current || !selectedId) return
    scrollActiveRowOnNextPaintRef.current = false
    const row = trackListRef.current?.querySelector<HTMLElement>(
      `[data-track-id="${CSS.escape(selectedId)}"]`,
    )
    if (!row) return
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    row.scrollIntoView({ block: 'nearest', behavior: reduceMotion ? 'auto' : 'smooth' })
  }, [selectedId, listRows])

  const pageMeta = renderPageMeta({
    title: 'Top Tracks on SoundCloud',
    description:
      'The best BANANASUTRA tracks, ranked and filterable by tempo, genre, instruments, and moods.',
    path: canonicalPathForRoute('/tracks'),
  })
  useSyncCatalogHeaderHeight(pageRef, headerRef, [
    filterBarExpanded,
    countTracksSelections(filters),
    urlFind,
    filtered.length,
    tracksVisibleCount,
    trackCatalog === null ? -1 : catalogList.length,
  ])

  const selected = useMemo(
    () => listRows.find((t) => t.track_id === selectedId) ?? filtered.find((t) => t.track_id === selectedId) ?? listRows[0],
    [listRows, filtered, selectedId],
  )
  const highlightTrackId = useMemo(() => {
    if (playingTrackId && listRows.some((t) => t.track_id === playingTrackId)) return playingTrackId
    return selectedId
  }, [listRows, playingTrackId, selectedId])
  const showNowPlayingSection = Boolean(selected?.sc_url) && !playAllDesktopAvailable
  const queueIndex =
    queueOwnsPage && playAllActive
      ? queueState.position
      : selected?.track_id
        ? filtered.findIndex((t) => t.track_id === selected.track_id)
        : -1
  const canGoPrevious = queueOwnsPage && playAllActive ? queueState.position > 0 : queueIndex > 0
  const canGoNext =
    queueOwnsPage && playAllActive
      ? queueState.position >= 0 && queueState.position < queueState.tracks.length - 1
      : queueIndex >= 0 && queueIndex < filtered.length - 1
  const queueStatusTotal =
    queueOwnsPage && playAllActive && queueState.tracks.length > 0 ? queueState.tracks.length : filtered.length

  const syncToUrl = useCallback(
    (nextFilters: TracksFilterState, find: string, page: number, sort: TrackSortMode) => {
      const preserve = new URLSearchParams(location.search)
      navigate(buildTracksBrowsePathFull(nextFilters, find, page, preserve, sort), { replace: true })
    },
    [location.search, navigate],
  )

  const patchFilters = (next: TracksFilterState) => {
    reportTracksFilterPatch(filters, next)
    setFilters(next)
    syncToUrl(next, urlFind, 1, urlSort)
  }

  const clearFindChip = () => {
    setFindDraft('')
    syncToUrl(filters, '', 1, urlSort)
  }

  const clearAllFilters = () => {
    const cleared = emptyTracksFilterState()
    reportTracksFilterPatch(filters, cleared)
    setFilters(cleared)
    setFindDraft('')
    syncToUrl(cleared, '', 1, urlSort)
  }

  const setTrackSort = (next: TrackSortMode) => {
    const preserve = new URLSearchParams(location.search)
    navigate(buildTracksBrowsePathFull(filters, urlFind, 1, preserve, next), { replace: true })
  }

  const pickTrack = useCallback(
    (t: TrackCatalogItem, options?: { keepPlayAll?: boolean }) => {
      queueActions.pickTrack(trackCatalogItemToPlayable(t), options)
    },
    [queueActions],
  )

  const rowActivate = (e: MouseEvent | KeyboardEvent, t: TrackCatalogItem) => {
    if ((e.target as HTMLElement).closest('a')) return
    pickTrack(t)
  }

  const rowKeyDown = (e: KeyboardEvent<HTMLDivElement>, t: TrackCatalogItem) => {
    if ((e.target as HTMLElement).closest('a')) return
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      pickTrack(t)
    }
  }

  const handlePlayerLoad = useCallback(() => {
    bindWidgetOnLoad(playerWrapRef.current)
  }, [bindWidgetOnLoad])

  const facetSelections = countTracksSelections(filters)
  const hasActiveContext = facetSelections > 0 || Boolean(urlFind.trim())
  const contextSummary = hasActiveContext
    ? `${filtered.length} of ${catalogList.length} top tracks · ${facetSelections} filter${facetSelections === 1 ? '' : 's'}${urlFind.trim() ? ' · search' : ''}`
    : `${catalogList.length} top tracks`

  const trackActivePills: CatalogFilterBarActivePill[] = []
  if (urlFind.trim()) {
    trackActivePills.push({
      id: 'find',
      label: <>Search: {urlFind}</>,
      onClick: clearFindChip,
      title: 'Remove text filter',
    })
  }
  for (const key of Object.keys(filters) as TracksFacetFilterKey[]) {
    for (const value of filters[key]) {
      trackActivePills.push({
        id: `${key}-${value}`,
        label: (
          <>
            {TRACKS_FACET_LABELS[key]}:{' '}
            {key === 'sutra' ? (
              <span className={`catalog-facet-sutra-name ${sutraClassName(value)}`} title={sutraQuestionFromDisplay(value)}>
                {value}
              </span>
            ) : (
              value
            )}
          </>
        ),
        onClick: () =>
          patchFilters({
            ...filters,
            [key]: toggleSetMember(filters[key], value),
          }),
        title: key === 'sutra' ? sutraQuestionFromDisplay(value) : undefined,
      })
    }
  }

  const trackFacetGroups: CatalogFilterBarFacetGroup[] = TRACKS_BROWSER_FACET_ORDER.flatMap((group) => {
    const entries = facetEntries[group] ?? []
    if (!entries.length) return []
    return [
      {
        id: group,
        label: TRACKS_FACET_LABELS[group],
        showAllChip: false,
        options: facetEntriesToToggleChips({
          groupId: group,
          entries,
          isSutra: group === 'sutra',
          isActive: (value) => filters[group].has(value),
          onToggle: (value) =>
            patchFilters({
              ...filters,
              [group]: toggleSetMember(filters[group], value),
            }),
          countLabel: 'top tracks',
        }),
      },
    ]
  })

  const total = catalogList.length

  return (
    <div ref={pageRef} className="catalog catalog-page catalog-page--shell">
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
            Tracks
          </span>
        </nav>

        <div className="catalog-page-intro catalog-page-intro--song-catalog">
          <h1 className="catalog-page-h1">Top Tracks</h1>
          <p className="catalog-page-sub">
            The SoundCloud algorithm side of things. Same songs, sorted by top tracks. Search, or filter by
            tempo, mood, genre, or instrument. If you want the meaning behind the music,{' '}
            <Link to={canonicalPathForRoute('/songs')}>Songs</Link>{' '}
            has the story.
          </p>
        </div>

        {catalogLoadError ? (
          <article className="about-page catalog-layout-shell" id="main-content">
            <p className="about-page__p">{catalogLoadError}</p>
            <p className="about-page__p">Try refreshing the page. If this persists, the catalog asset may be missing from the build.</p>
          </article>
        ) : trackCatalog === null ? (
          <article className="about-page catalog-layout-shell tracks-page__loading-shell" id="main-content">
            <p className="about-page__p">Loading track catalog…</p>
          </article>
        ) : total === 0 ? (
          <article className="about-page catalog-layout-shell" id="main-content">
            <h2 className="about-page__p" style={{ fontWeight: 700, marginBottom: '0.5rem' }}>
              No top tracks in this snapshot
            </h2>
            <p className="about-page__p">
              The build completed, but there are no in-app SoundCloud rows in <code>track_catalog.json</code> right now.
              That usually means the snapshot export had no qualifying SoundCloud top tracks, not that your filters are wrong.
            </p>
          </article>
        ) : (
          <>
            <div className="tracks-page__content">
              <CatalogFilterBar
                ariaLabel="Filter top tracks"
                panelId="tracks-filter-panel"
                resultSummary={contextSummary}
                activePills={trackActivePills}
                onClearAll={clearAllFilters}
                facetGroups={trackFacetGroups}
                search={{
                  id: 'tracks-find-input',
                  label: 'Search',
                  ariaLabel: 'Search top tracks by title or tag',
                  value: findDraft,
                  onChange: setFindDraft,
                  inputName: 'tracks_q',
                }}
                defaultExpanded={filterBarExpanded}
                onExpandedChange={setFilterBarExpanded}
                toolbarEnd={
                  <div className="catalog-sort tracks-page__sort" aria-label="Sort top tracks">
                    <label className="catalog-sort-label" htmlFor="tracks-sort-select">
                      Sort
                    </label>
                    <select
                      id="tracks-sort-select"
                      className="catalog-sort-select"
                      value={urlSort}
                      onChange={(e) => setTrackSort(e.target.value as TrackSortMode)}
                    >
                      <option value="engagement">Most engagement</option>
                      <option value="likes">Most likes</option>
                      <option value="plays">Most plays</option>
                      <option value="newest">Newest (publish date)</option>
                      <option value="title_az">Track title (A–Z)</option>
                    </select>
                  </div>
                }
              />

              <main id="main-content" className="catalog-main tracks-page__main">
                {showNowPlayingSection ? (
                  <section className="tracks-page__player" aria-label="Now playing">
                    <h2 className="tracks-page__player-h catalog-section-title">Now playing</h2>
                    {!playAllDesktopAvailable ? (
                      <div className="tracks-page__player-frame" ref={playerWrapRef}>
                        <LazySoundCloudEmbed
                          scUrl={selected.sc_url}
                          title={selected.track_title || 'SoundCloud track'}
                          height={embedHeight}
                          mode="visual"
                          autoPlay={scAutoplay}
                          reloadKey={embedReloadKey}
                          onLoad={handlePlayerLoad}
                        />
                      </div>
                    ) : null}
                    <p className="tracks-page__sc-link-wrap">
                      <a
                        className="tracks-page__sc-link"
                        href={selected.sc_url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Listen on SoundCloud
                      </a>
                    </p>
                  </section>
                ) : null}

                {filtered.length > 0 ? (
                  <div
                    className="tracks-page__play-all"
                    role={playAllDesktopAvailable && !foreignSessionActive ? 'group' : undefined}
                    aria-label={playAllDesktopAvailable && !foreignSessionActive ? 'Play all top tracks' : undefined}
                  >
                    {foreignSessionActive ? (
                      <>
                        <p className="tracks-page__play-all-note tracks-page__play-all-note--foreign">
                          {foreignPlaybackNote}
                        </p>
                        {playAllDesktopAvailable && filtered.length > 1 && !playAllActive ? (
                          <div className="tracks-page__play-all-row">
                            <button
                              type="button"
                              className="tracks-page__play-all-btn"
                              onClick={startPlayAllFromPage}
                            >
                              <span className="tracks-page__play-all-glyph" aria-hidden>
                                ▶
                              </span>
                              {`Play all ${filtered.length} top tracks`}
                            </button>
                          </div>
                        ) : null}
                      </>
                    ) : playAllDesktopAvailable || playAllActive ? (
                      <div className="tracks-page__play-all-row">
                        {playAllActive ? (
                          persistentBarOwnsQueue ? null : (
                            <>
                              {isScPlaying ? (
                                <button
                                  type="button"
                                  className="tracks-page__play-all-btn"
                                  onClick={() => queueActions.pause()}
                                >
                                  <span className="tracks-page__play-all-glyph" aria-hidden>
                                    ❚❚
                                  </span>
                                  Pause
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  className="tracks-page__play-all-btn"
                                  onClick={() => queueActions.resume()}
                                >
                                  <span className="tracks-page__play-all-glyph" aria-hidden>
                                    ▶
                                  </span>
                                  Resume
                                </button>
                              )}
                              <button
                                type="button"
                                className="tracks-page__play-all-btn tracks-page__play-all-btn--stop"
                                onClick={() => queueActions.stop()}
                              >
                                <span className="tracks-page__play-all-glyph" aria-hidden>
                                  ■
                                </span>
                                Stop playing all
                              </button>
                            </>
                          )
                        ) : playAllDesktopAvailable && filtered.length > 1 ? (
                          <button
                            type="button"
                            className="tracks-page__play-all-btn"
                            onClick={startPlayAllFromPage}
                          >
                            <span className="tracks-page__play-all-glyph" aria-hidden>
                              ▶
                            </span>
                            {`Play all ${filtered.length} top tracks`}
                          </button>
                        ) : null}
                        {playAllDesktopAvailable || playAllActive ? (
                          <>
                            {persistentBarOwnsQueue ? null : (
                              <div className="tracks-page__queue-nav" role="group" aria-label="Track queue navigation">
                                <button
                                  type="button"
                                  className="tracks-page__play-all-btn tracks-page__play-all-btn--queue-nav"
                                  onClick={() => queueActions.jump(-1)}
                                  disabled={!canGoPrevious}
                                >
                                  Previous
                                </button>
                                <button
                                  type="button"
                                  className="tracks-page__play-all-btn tracks-page__play-all-btn--queue-nav"
                                  onClick={() => queueActions.jump(1)}
                                  disabled={!canGoNext}
                                >
                                  Next
                                </button>
                              </div>
                            )}
                            <span className="tracks-page__play-all-status" aria-live="polite">
                              {queueIndex >= 0
                                ? `Top track ${queueIndex + 1} of ${queueStatusTotal}`
                                : `Top track 0 of ${queueStatusTotal}`}
                            </span>
                          </>
                        ) : null}
                      </div>
                    ) : null}
                    {!playAllDesktopAvailable ? (
                      <div className="tracks-page__mobile-listen-hint" role="note">
                        <p className="tracks-page__mobile-listen-hint-text">
                          Continuous listening works best on desktop. On mobile, open a songbook for
                          uninterrupted play.{' '}
                          {mobileSongbookHint ? (
                            <>
                              Try{' '}
                              <Link to={mobileSongbookHint.href} className="tracks-page__mobile-listen-hint-link">
                                {mobileSongbookHint.songbook}
                              </Link>
                              , or{' '}
                            </>
                          ) : null}
                          <Link to="/songbooks/" className="tracks-page__mobile-listen-hint-link">
                            browse all songbooks →
                          </Link>
                        </p>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <ul ref={trackListRef} className="tracks-page__list">
                  {listRows.map((t) => {
                    const active = t.track_id === highlightTrackId
                    /** Wave overlay reads as “now playing”; only when this row matches the persistent queue track. */
                    const showPlayingWave =
                      isScPlaying && playingTrackId != null && t.track_id === playingTrackId
                    const href = songCatalogPath(t.lyrics_title, t.url_slug)
                    const thumb = thumbSrc(t.list_cover_url)
                    const coverSrcSet = buildSrcset(thumb, [100, 200])
                    const g = genreLine(t)
                    const genreSecondary = g.trim()
                    const sutraText = (t.sutra || '').trim()
                    const metaTail = genreSecondary
                    const showRailMeta = Boolean(sutraText) || Boolean(metaTail)
                    const durationLabel = formatDurationDisplay(t.duration_raw)
                    const railMetaAria = [sutraText, metaTail].filter(Boolean).join('; ') || 'Track details'
                    const statLine = [
                      durationLabel,
                      `${formatCount(t.play_count)} plays`,
                      `${formatCount(t.like_count)} likes`,
                    ]
                      .filter(Boolean)
                      .join(' · ')
                    return (
                      <li key={t.track_id} className="tracks-page__item" data-track-id={t.track_id}>
                        <div
                          role="button"
                          tabIndex={0}
                          className={`tracks-page__row${active ? ' tracks-page__row--selected' : ''}`}
                          onClick={(e) => rowActivate(e, t)}
                          onKeyDown={(e) => rowKeyDown(e, t)}
                          aria-current={active ? 'true' : undefined}
                        >
                          <div className="tracks-page__row-main">
                            <div className="tracks-page__text-stack">
                              <div className="tracks-page__body">
                                <h3 className="tracks-page__title" title={t.track_title}>
                                  {t.track_title}
                                </h3>
                              </div>
                              <div className="tracks-page__rail">
                                {showRailMeta ? (
                                  <p className="tracks-page__rail-meta" aria-label={railMetaAria}>
                                    {sutraText ? (
                                      <span className={`catalog-sutra-word ${sutraClassName(sutraText)}`}>
                                        {sutraText}
                                      </span>
                                    ) : null}
                                    {metaTail ? (
                                      <span
                                        className="catalog-card-meta-secondary tracks-page__rail-meta-tail"
                                        title={metaTail}
                                      >
                                        {metaTail}
                                      </span>
                                    ) : null}
                                  </p>
                                ) : null}
                                <div className="tracks-page__rail-stats">
                                  <span className="tracks-page__stat" title={statLine}>
                                    {statLine}
                                  </span>
                                  <Link
                                    className="catalog-song-page-cta"
                                    to={href}
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    Song page
                                  </Link>
                                </div>
                              </div>
                            </div>
                          </div>
                          <div
                            className={`tracks-page__thumb-wrap${active ? ' tracks-page__thumb-wrap--active' : ''}`}
                          >
                            {thumb ? (
                              <CoverImage
                                className="tracks-page__thumb"
                                source={thumb}
                                requestWidth={200}
                                srcSet={coverSrcSet || undefined}
                                sizes="48px"
                                alt=""
                                width={48}
                                height={48}
                                loading="lazy"
                                decoding="async"
                              />
                            ) : (
                              <span className="tracks-page__thumb tracks-page__thumb--empty" />
                            )}
                            {showPlayingWave ? (
                              <div className="tracks-page__wave" aria-hidden>
                                <span className="tracks-page__wave-bar" />
                                <span className="tracks-page__wave-bar" />
                                <span className="tracks-page__wave-bar" />
                                <span className="tracks-page__wave-bar" />
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </li>
                    )
                  })}
                </ul>

                {filtered.length === 0 ? (
                  <div className="catalog-empty tracks-page__empty-filtered">
                    <p>
                      <strong>No top tracks match this view.</strong> Filters and search combine with AND: every filter and
                      every word in your search has to match the same row.
                    </p>
                    <p>
                      Try removing one filter or shortening the search.{' '}
                      <button type="button" className="catalog-clear" onClick={clearAllFilters}>
                        Clear all filters and search
                      </button>
                    </p>
                  </div>
                ) : null}

                {filtered.length > 0 ? (
                  <CatalogInfiniteScrollFooter
                    visibleCount={tracksVisibleCount}
                    totalCount={tracksTotalCount}
                    hasMore={tracksHasMore}
                    loadMore={loadMoreTracks}
                    noun="top tracks"
                    formatCount={formatCount}
                  />
                ) : null}
              </main>
            </div>
          </>
        )}
      </div>

      <GlobalFooter />
    </div>
  )
}
