import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent, MouseEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { catalogDataFileUrl, fetchCatalogData } from './catalogDataUrl'
import { TRACKS_BROWSER_FACET_ORDER, TRACKS_FACET_LABELS } from './catalogFacetConfig'
import { CatalogPager } from './CatalogPager'
import './CatalogPager.css'
import { facetCountsFromTracks } from './facetCountsFromTracks'
import { filterTracksByFindQuery, sortTrackCatalog, trackMatchesFilters } from './filterTracks'
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
import { coverImageUrl } from '../seo/imageUrl'
import { browsePathWithQuery, canonicalPathForRoute } from './seoPaths'
import { renderPageMeta } from './usePageMeta'
import { useSyncCatalogHeaderHeight } from './useSyncCatalogHeaderHeight'
import { sutraClassName } from './sutraTheme'
import './CatalogApp.css'
import './AboutPage.css'
import './TracksPage.css'

const PAGE_SIZE = 30
const FIND_DEBOUNCE_MS = 350
const EMPTY_TRACK_FACETS: Record<TracksFacetFilterKey, FacetEntry[]> = {
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
  const [trackCatalog, setTrackCatalog] = useState<TrackCatalogItem[] | null>(null)
  const [catalogLoadError, setCatalogLoadError] = useState<string | null>(null)

  const [filtersOpen, setFiltersOpen] = useState(() =>
    typeof window === 'undefined' ? true : window.innerWidth >= 900,
  )

  const { filters: urlFilters, find: urlFind, page: urlPage, sort: urlSort } = useMemo(
    () => readTracksBrowseFromSearch(location.search),
    [location.search],
  )

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
      urlPage > 1,
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
    const mq = window.matchMedia('(max-width: 899px)')
    const sync = () => {
      if (mq.matches) setFiltersOpen(false)
    }
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

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
  const facetEntries = useMemo(
    () => (nonCriticalReady ? facetCountsFromTracks(catalogList) : EMPTY_TRACK_FACETS),
    [catalogList, nonCriticalReady],
  )

  const filtered = useMemo(() => {
    let list = catalogList.filter((t) => trackMatchesFilters(t, filters))
    list = filterTracksByFindQuery(list, urlFind)
    list = sortTrackCatalog(list, urlSort)
    return list
  }, [catalogList, filters, urlFind, urlSort])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(urlPage, pageCount)
  const pageStart = (safePage - 1) * PAGE_SIZE
  const pageRows = useMemo(
    () => filtered.slice(pageStart, pageStart + PAGE_SIZE),
    [filtered, pageStart],
  )

  useEffect(() => {
    if (urlPage !== safePage) {
      const preserve = new URLSearchParams(location.search)
      const path = buildTracksBrowsePathFull(filters, urlFind, safePage, preserve, urlSort)
      navigate(path, { replace: true })
    }
  }, [urlPage, safePage, filters, urlFind, urlSort, location.search, navigate])

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [embedReloadKey, setEmbedReloadKey] = useState(0)
  /** SoundCloud `auto_play` only after an explicit row action — not on first paint / URL-driven page slice. */
  const [scAutoplay, setScAutoplay] = useState(false)
  const skipScAutoplayOffOnNextSelectionChange = useRef(false)

  /** "Play All" queue mode: keep auto-advancing through `filtered` until the user stops or runs out of tracks. */
  const [playAllActive, setPlayAllActive] = useState(false)
  const playAllActiveRef = useRef(false)
  const playerWrapRef = useRef<HTMLDivElement>(null)
  const filteredRef = useRef<TrackCatalogItem[]>([])
  const selectedIdRef = useRef<string | null>(null)
  const safePageRef = useRef(1)
  const filtersRefForAdvance = useRef<TracksFilterState>(filters)
  const urlFindRefForAdvance = useRef<string>(urlFind)
  const urlSortRefForAdvance = useRef<TrackSortMode>(urlSort)
  const locationSearchRef = useRef(location.search)

  useEffect(() => {
    filteredRef.current = filtered
  }, [filtered])
  useEffect(() => {
    safePageRef.current = safePage
  }, [safePage])
  useEffect(() => {
    playAllActiveRef.current = playAllActive
  }, [playAllActive])
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
  useEffect(() => {
    locationSearchRef.current = location.search
  }, [location.search])

  useEffect(() => {
    if (!pageRows.length) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clear player when page slice is empty
      setSelectedId(null)
      setScAutoplay(false)
      setPlayAllActive(false)
      return
    }
    setSelectedId((prev) => {
      if (prev && pageRows.some((t) => t.track_id === prev)) return prev
      return pageRows[0]?.track_id ?? null
    })
  }, [pageRows])

  useEffect(() => {
    if (skipScAutoplayOffOnNextSelectionChange.current) {
      skipScAutoplayOffOnNextSelectionChange.current = false
      return
    }
    setScAutoplay(false)
  }, [selectedId])

  const pageMeta = renderPageMeta({
    title: 'Top Tracks on SoundCloud',
    description:
      'The best BANANASUTRA tracks, ranked and filterable by tempo, genre, instruments, and moods.',
    path: canonicalPathForRoute('/tracks'),
  })
  useSyncCatalogHeaderHeight(pageRef, headerRef, [
    filtersOpen,
    countTracksSelections(filters),
    urlFind,
    filtered.length,
    safePage,
    trackCatalog === null ? -1 : catalogList.length,
  ])

  const selected = useMemo(
    () => pageRows.find((t) => t.track_id === selectedId) ?? pageRows[0],
    [pageRows, selectedId],
  )

  const syncToUrl = useCallback(
    (nextFilters: TracksFilterState, find: string, page: number, sort: TrackSortMode) => {
      const preserve = new URLSearchParams(location.search)
      navigate(buildTracksBrowsePathFull(nextFilters, find, page, preserve, sort), { replace: true })
    },
    [location.search, navigate],
  )

  const patchFilters = (next: TracksFilterState) => {
    setFilters(next)
    syncToUrl(next, urlFind, 1, urlSort)
  }

  const clearFindChip = () => {
    setFindDraft('')
    syncToUrl(filters, '', 1, urlSort)
  }

  const clearAllFilters = () => {
    const cleared = emptyTracksFilterState()
    setFilters(cleared)
    setFindDraft('')
    syncToUrl(cleared, '', 1, urlSort)
  }

  const setTrackSort = (next: TrackSortMode) => {
    const preserve = new URLSearchParams(location.search)
    navigate(buildTracksBrowsePathFull(filters, urlFind, 1, preserve, next), { replace: true })
  }

  const pickTrack = useCallback(
    (t: TrackCatalogItem, { keepPlayAll = false }: { keepPlayAll?: boolean } = {}) => {
      if (!keepPlayAll && playAllActiveRef.current) {
        setPlayAllActive(false)
      }
      skipScAutoplayOffOnNextSelectionChange.current = true
      setScAutoplay(true)
      if (t.track_id === selectedIdRef.current) {
        setEmbedReloadKey((k) => k + 1)
        return
      }
      setSelectedId(t.track_id)
      setEmbedReloadKey((k) => k + 1)
    },
    [],
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

  /** Move to the next item in the full filtered queue and auto-paginate so the row is visible. */
  const advanceToNextInQueue = useCallback(() => {
    const queue = filteredRef.current
    const currentId = selectedIdRef.current
    if (!queue.length || !currentId) {
      setPlayAllActive(false)
      return
    }
    const idx = queue.findIndex((t) => t.track_id === currentId)
    if (idx < 0) {
      setPlayAllActive(false)
      return
    }
    const next = queue[idx + 1]
    if (!next) {
      setPlayAllActive(false)
      return
    }
    const nextPage = Math.floor((idx + 1) / PAGE_SIZE) + 1
    if (nextPage !== safePageRef.current) {
      const preserve = new URLSearchParams(locationSearchRef.current)
      navigate(
        buildTracksBrowsePathFull(
          filtersRefForAdvance.current,
          urlFindRefForAdvance.current,
          nextPage,
          preserve,
          urlSortRefForAdvance.current,
        ),
        { replace: true },
      )
    }
    pickTrack(next, { keepPlayAll: true })
  }, [navigate, pickTrack])

  const advanceToNextInQueueRef = useRef(advanceToNextInQueue)
  useEffect(() => {
    advanceToNextInQueueRef.current = advanceToNextInQueue
  }, [advanceToNextInQueue])

  const startPlayAll = useCallback(() => {
    const queue = filteredRef.current
    if (!queue.length) return
    setPlayAllActive(true)
    if (safePageRef.current !== 1) {
      const preserve = new URLSearchParams(locationSearchRef.current)
      navigate(
        buildTracksBrowsePathFull(
          filtersRefForAdvance.current,
          urlFindRefForAdvance.current,
          1,
          preserve,
          urlSortRefForAdvance.current,
        ),
        { replace: true },
      )
    }
    pickTrack(queue[0], { keepPlayAll: true })
  }, [navigate, pickTrack])

  const stopPlayAll = useCallback(() => {
    setPlayAllActive(false)
  }, [])

  /** Bind FINISH on the SoundCloud widget after each iframe (re)load — each remount creates a fresh widget. */
  const handlePlayerLoad = useCallback(() => {
    if (!playAllActiveRef.current) return
    const wrap = playerWrapRef.current
    if (!wrap) return
    const iframe = wrap.querySelector<HTMLIFrameElement>('iframe.sc-embed-frame')
    if (!iframe) return
    void import('./soundcloudWidgetApi')
      .then(({ loadSoundCloudWidgetApi }) => loadSoundCloudWidgetApi())
      .then((SC) => {
        if (!document.body.contains(iframe)) return
        const widget = SC.Widget(iframe)
        widget.bind(SC.Widget.Events.FINISH, () => {
          if (!playAllActiveRef.current) return
          advanceToNextInQueueRef.current()
        })
      })
      .catch(() => {
        // Widget API failed to load; Play All becomes effectively manual.
      })
  }, [])

  const facetSelections = countTracksSelections(filters)
  const hasActiveContext = facetSelections > 0 || Boolean(urlFind.trim())
  const contextSummary = hasActiveContext
    ? `${filtered.length} of ${catalogList.length} tracks · ${facetSelections} filter${facetSelections === 1 ? '' : 's'}${urlFind.trim() ? ' · search' : ''}`
    : `${catalogList.length} tracks`

  const activeFilterContext = (
    <section
      className="catalog-active-context tracks-page__filter-summary"
      aria-label={hasActiveContext ? 'Active filters and result count' : 'Catalog result count'}
    >
      <div className="catalog-active-context__head">
        <p className="catalog-active-context__summary">{contextSummary}</p>
      </div>
      {hasActiveContext ? (
        <div className="catalog-chips">
          {urlFind.trim() ? (
            <button type="button" className="catalog-chip catalog-chip--find" onClick={clearFindChip}>
              Search: {urlFind}
              <span className="catalog-chip-x" aria-hidden>
                ×
              </span>
            </button>
          ) : null}
          {(Object.keys(filters) as TracksFacetFilterKey[]).flatMap((key) =>
            [...filters[key]].map((value) => (
              <button
                key={`${key}-${value}`}
                type="button"
                className="catalog-chip"
                onClick={() =>
                  patchFilters({
                    ...filters,
                    [key]: toggleSetMember(filters[key], value),
                  })
                }
              >
                {TRACKS_FACET_LABELS[key]}: {value}
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

  const pagerPreserve = () => new URLSearchParams(location.search)

  const pagerLink = (target: number) => {
    const qs = serializeTracksBrowseQuery(filters, urlFind, target, pagerPreserve(), urlSort)
    return browsePathWithQuery('/tracks', qs)
  }

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
            The SoundCloud algorithm side of things. Same songs, sorted by popular audio tracks. Search, or filter by
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
              No tracks in this snapshot
            </h2>
            <p className="about-page__p">
              The build completed, but there are no in-app SoundCloud rows in <code>track_catalog.json</code> right now.
              That usually means the snapshot export had no qualifying SC tracks, not that your filters are wrong.
            </p>
          </article>
        ) : (
          <>
            <div className={`catalog-layout${filtersOpen ? '' : ' catalog-layout--filters-collapsed'}`}>
              <aside
                className={`catalog-filters${filtersOpen ? ' is-open' : ''}`}
                aria-labelledby="tracks-filters-heading"
              >
                <div className="catalog-filters-head">
                  <h2 id="tracks-filters-heading" className="catalog-section-title">
                    Filters
                  </h2>
                  <button
                    type="button"
                    className="catalog-icon-btn"
                    onClick={() => setFiltersOpen(false)}
                    aria-expanded={filtersOpen}
                    aria-controls="tracks-filter-panel"
                  >
                    Hide
                  </button>
                </div>

                {filtersOpen ? activeFilterContext : null}

                <div id="tracks-filter-panel" className="catalog-facet-stack">
                  <section className="catalog-facet" aria-labelledby="tracks-find-heading">
                    <h3 id="tracks-find-heading">Search</h3>
                    <label className="catalog-facet-find-label" htmlFor="tracks-find-input">
                      Search by title or tag
                    </label>
                    <input
                      id="tracks-find-input"
                      className="catalog-facet-find-input"
                      type="search"
                      name="tracks_q"
                      inputMode="search"
                      autoComplete="off"
                      spellCheck={false}
                      enterKeyHint="search"
                      value={findDraft}
                      onChange={(e) => setFindDraft(e.target.value)}
                    />
                  </section>

                  {TRACKS_BROWSER_FACET_ORDER.map((group) => {
                    const entries = facetEntries[group] ?? []
                    if (!entries.length) return null
                    const headingId = `tracks-facet-${group}`
                    return (
                      <section key={group} className="catalog-facet" aria-labelledby={headingId}>
                        <h3 id={headingId}>{TRACKS_FACET_LABELS[group]}</h3>
                        <div className="catalog-facet-chips" role="group" aria-labelledby={headingId}>
                          {entries.map(({ value, count }) => {
                            const active = filters[group].has(value)
                            return (
                              <button
                                key={value}
                                type="button"
                                className={`catalog-facet-chip${active ? ' is-active' : ''}`}
                                onClick={() =>
                                  patchFilters({
                                    ...filters,
                                    [group]: toggleSetMember(filters[group], value),
                                  })
                                }
                                title={`${count} tracks`}
                              >
                                <span>{value}</span>
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
                {selected?.sc_url ? (
                  <section className="tracks-page__player" aria-label="Now playing">
                    <h2 className="tracks-page__player-h catalog-section-title">Now playing</h2>
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

                <div className="catalog-main__sort-row">
                  <div className="catalog-sort" aria-label="Sort tracks">
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
                </div>

                {!filtersOpen ? (
                  <>
                    {activeFilterContext}
                    <button
                      type="button"
                      className="catalog-filter-reopen"
                      onClick={() => setFiltersOpen(true)}
                      aria-expanded={false}
                      aria-controls="tracks-filter-panel"
                    >
                      Show filters
                    </button>
                  </>
                ) : null}

                {filtered.length > 1 ? (
                  <div className="tracks-page__play-all" role="group" aria-label="Play all tracks">
                    <div className="tracks-page__play-all-row">
                      {playAllActive ? (
                        <>
                          <button
                            type="button"
                            className="tracks-page__play-all-btn tracks-page__play-all-btn--stop"
                            onClick={stopPlayAll}
                          >
                            <span className="tracks-page__play-all-glyph" aria-hidden>
                              ■
                            </span>
                            Stop playing all
                          </button>
                          <span className="tracks-page__play-all-status" aria-live="polite">
                            {(() => {
                              const idx = filtered.findIndex((t) => t.track_id === selected?.track_id)
                              const pos = idx >= 0 ? idx + 1 : 1
                              return `Playing ${pos} of ${filtered.length}`
                            })()}
                          </span>
                        </>
                      ) : (
                        <button
                          type="button"
                          className="tracks-page__play-all-btn"
                          onClick={startPlayAll}
                        >
                          <span className="tracks-page__play-all-glyph" aria-hidden>
                            ▶
                          </span>
                          {`Play all ${filtered.length} tracks`}
                        </button>
                      )}
                    </div>
                    <p className="tracks-page__play-all-note">
                      Autoplay works best on desktop. On mobile (especially iPhone), you may need to tap each next
                      track to keep the queue going.
                    </p>
                  </div>
                ) : null}

                {filtered.length > 0 ? (
                  <CatalogPager
                    variant="top"
                    safePage={safePage}
                    pageCount={pageCount}
                    totalInView={filtered.length}
                    pageSize={PAGE_SIZE}
                    pagerLink={pagerLink}
                  />
                ) : null}

                <ul className="tracks-page__list">
                  {pageRows.map((t) => {
                    const active = t.track_id === selected?.track_id
                    /** Wave overlay reads as “now playing”; only show when this row triggered embed autoplay. */
                    const showPlayingWave = active && scAutoplay
                    const href = songCatalogPath(t.lyrics_title, t.url_slug)
                    const cover = coverImageUrl(thumbSrc(t.list_cover_url), { width: 200 })
                    const g = genreLine(t)
                    const genreSecondary = g.trim()
                    const sutraText = (t.sutra || '').trim()
                    const metaTail = genreSecondary
                    const showRailMeta = Boolean(sutraText) || Boolean(metaTail)
                    const durationRaw = (t.duration_raw || '').trim()
                    const railMetaAria = [sutraText, metaTail].filter(Boolean).join('; ') || 'Track details'
                    const statLine = [
                      durationRaw,
                      `${formatCount(t.play_count)} plays`,
                      `${formatCount(t.like_count)} likes`,
                    ]
                      .filter(Boolean)
                      .join(' · ')
                    return (
                      <li key={t.track_id} className="tracks-page__item">
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
                            {cover ? (
                              <img className="tracks-page__thumb" src={cover} alt="" loading="lazy" />
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
                      <strong>No tracks match this view.</strong> Filters and search combine with AND: every filter and
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
                  <CatalogPager
                    variant="bottom"
                    safePage={safePage}
                    pageCount={pageCount}
                    totalInView={filtered.length}
                    pageSize={PAGE_SIZE}
                    pagerLink={pagerLink}
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
