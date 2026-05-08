import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent, MouseEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import trackCatalogUrl from '../data/generated/track_catalog.json?url'
import { TRACKS_BROWSER_FACET_ORDER, TRACKS_FACET_LABELS } from './catalogFacetConfig'
import { CatalogPager } from './CatalogPager'
import './CatalogPager.css'
import { facetCountsFromTracks } from './facetCountsFromTracks'
import { filterTracksByFindQuery, sortTrackCatalog, trackMatchesFilters } from './filterTracks'
import { GlobalFooter } from './GlobalFooter'
import { GlobalHeader } from './GlobalHeader'
import { SoundCloudEmbed } from './SoundCloudEmbed'
import { songCatalogPath } from './songPaths'
import type { TrackCatalogItem, TrackSortMode, TracksFacetFilterKey, TracksFilterState } from './types'
import { emptyTracksFilterState } from './types'
import {
  buildTracksBrowsePathFull,
  readTracksBrowseFromSearch,
  serializeTracksBrowseQuery,
} from './urlState'
import { useDocumentTitle } from './useDocumentTitle'
import { useSyncCatalogHeaderHeight } from './useSyncCatalogHeaderHeight'
import { sutraClassName } from './sutraTheme'
import './CatalogApp.css'
import './AboutPage.css'
import './TracksPage.css'

const PAGE_SIZE = 30
const FIND_DEBOUNCE_MS = 350

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
    fetch(trackCatalogUrl)
      .then((r) => {
        if (!cancelled) setCatalogLoadError(null)
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json() as Promise<TrackCatalogItem[]>
      })
      .then((rows) => {
        if (!cancelled) setTrackCatalog(Array.isArray(rows) ? rows : [])
      })
      .catch(() => {
        if (!cancelled) {
          setTrackCatalog(null)
          setCatalogLoadError('Could not load track catalog data.')
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

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
  const facetEntries = useMemo(() => facetCountsFromTracks(catalogList), [catalogList])

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

  useEffect(() => {
    if (!pageRows.length) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clear player when page slice is empty
      setSelectedId(null)
      setScAutoplay(false)
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

  useDocumentTitle('Top Tracks')
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

  const pickTrack = (t: TrackCatalogItem) => {
    skipScAutoplayOffOnNextSelectionChange.current = true
    setScAutoplay(true)
    if (t.track_id === selectedId) {
      setEmbedReloadKey((k) => k + 1)
      return
    }
    setSelectedId(t.track_id)
    setEmbedReloadKey((k) => k + 1)
  }

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
    return qs ? `/tracks?${qs}` : '/tracks'
  }

  const total = catalogList.length

  return (
    <div ref={pageRef} className="catalog catalog-page catalog-page--shell">
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
            tempo, mood, genre, or instrument. If you want the meaning behind the music, <Link to="/songs">Songs</Link>{' '}
            has the story.
          </p>
        </div>

        {catalogLoadError ? (
          <article className="about-page catalog-layout-shell" id="main-content">
            <p className="about-page__p">{catalogLoadError}</p>
            <p className="about-page__p">Try refreshing the page. If this persists, the catalog asset may be missing from the build.</p>
          </article>
        ) : trackCatalog === null ? (
          <article className="about-page catalog-layout-shell" id="main-content">
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

                <p className="tracks-page__filter-notice" role="note">
                  Track tagging is still in progress—genre, tempo, mood, and instrument filters may be incomplete for some
                  tracks.
                </p>

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
                    <div className="tracks-page__player-frame">
                      <SoundCloudEmbed
                        scUrl={selected.sc_url}
                        title={selected.track_title || 'SoundCloud track'}
                        height={embedHeight}
                        mode="visual"
                        autoPlay={scAutoplay}
                        reloadKey={embedReloadKey}
                        loading="eager"
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
                      <option value="newest">Newest (song / track dates)</option>
                      <option value="plays">Most plays</option>
                      <option value="likes">Most likes</option>
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
                    const cover = thumbSrc(t.list_cover_url)
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
