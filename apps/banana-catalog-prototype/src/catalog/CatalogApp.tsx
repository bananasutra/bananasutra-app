import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  DISCOVERY_FACET_HELP as FACET_HELP,
  DISCOVERY_FACET_LABELS as FACET_LABELS,
  CATALOG_BROWSER_FACET_ORDER as FACET_GROUPS,
} from './catalogFacetConfig'
import { facetCountsFromSongs } from './facetCountsFromSongs'
import {
  emptyFilterState,
  type FacetGroupKey,
  type FilterState,
  type MediaComboFilter,
  type SongCatalogItem,
  type SortMode,
} from './types'
import { songMatchesFilters, songMatchesMediaCombo, sortSongs } from './filterSongs'
import { filterSongsByFindAnyQuery } from './searchMatch'
import { songCatalogPath } from './songPaths'
import { sutraClassName } from './sutraTheme'
import { sutraQuestionFromDisplay } from './sutraContext'
import { buildBrowsePath, readBrowseStateFromSearchParams, readCatalogBrowsePage, readStateFromUrl } from './urlState'
import { searchParamsFromSearchString } from './urlSearchParams'
import { GlobalHeader } from './GlobalHeader'
import { GlobalFooter } from './GlobalFooter'
import { CatalogPager } from './CatalogPager'
import './CatalogPager.css'
import { usePageMeta } from './usePageMeta'
import { useSyncCatalogHeaderHeight } from './useSyncCatalogHeaderHeight'
import { loadSongSearchDeep, useSongCatalogBrowse } from './generatedData'
import { hasListenerCatalogMedia } from './listenerCatalog'
import { FooterSocialIcon } from './FooterSocialIcons'
import './CatalogApp.css'

const PAGE_SIZE = 30
const FIND_DEBOUNCE_MS = 350

function toggleSetMember(set: Set<string>, value: string): Set<string> {
  const next = new Set(set)
  if (next.has(value)) next.delete(value)
  else next.add(value)
  return next
}

function songHasSoundcloudListenPath(song: SongCatalogItem): boolean {
  return Boolean(
    song.has_in_app_playback || song.has_sc_catalog_listen || song.primary_ep_url?.trim(),
  )
}

function songSoundcloudListenSummary(song: SongCatalogItem): string {
  if (song.has_in_app_playback) return 'SoundCloud in-app playback: yes (curated picks).'
  if (song.has_sc_catalog_listen) return 'SoundCloud: track from full export (no primary EP link).'
  if (song.primary_ep_url.trim()) return 'SoundCloud: linked EP (expand on song page to play in app).'
  return 'SoundCloud in-app playback: no.'
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

const MEDIA_FILTER_OPTIONS: { id: MediaComboFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'lyrics_sc', label: 'Lyrics + SoundCloud' },
  { id: 'lyrics_yt', label: 'Lyrics + YouTube' },
  { id: 'full', label: 'SoundCloud + YouTube' },
]

const MEDIA_FILTER_LABELS: Record<Exclude<MediaComboFilter, 'all'>, string> = {
  lyrics_sc: 'Lyrics + SoundCloud',
  lyrics_yt: 'Lyrics + YouTube',
  full: 'SoundCloud + YouTube',
}

function catalogMediaAriaLabel(song: SongCatalogItem): string {
  const sc = songSoundcloudListenSummary(song)
  const yt = song.has_youtube_video
    ? song.has_youtube_embed
      ? 'YouTube on file: yes, embeddable in app.'
      : 'YouTube on file: yes; in-app embed may be off for the default video.'
    : 'YouTube on file: no.'
  return `${sc} ${yt}`
}

export function CatalogApp() {
  const location = useLocation()
  const navigate = useNavigate()
  const pageRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLElement>(null)
  const { data: songCatalogRows, error: catalogError, loading: catalogLoading } = useSongCatalogBrowse()
  const catalogSongs = useMemo(() => songCatalogRows ?? [], [songCatalogRows])
  const listenerCatalogSongs = useMemo(() => catalogSongs.filter(hasListenerCatalogMedia), [catalogSongs])
  const facets = useMemo(() => facetCountsFromSongs(listenerCatalogSongs), [listenerCatalogSongs])

  const [browseSeed] = useState(() =>
    readBrowseStateFromSearchParams(searchParamsFromSearchString(window.location.search)),
  )
  const [sort, setSort] = useState<SortMode>(browseSeed.sort)
  const [filters, setFilters] = useState<FilterState>(browseSeed.filters)
  const [media, setMedia] = useState<MediaComboFilter>(browseSeed.media)
  const [filtersOpen, setFiltersOpen] = useState(() =>
    typeof window === 'undefined' ? true : window.innerWidth >= 900,
  )

  usePageMeta({
    title: 'Songs Catalog',
    description: 'Browse all BANANASUTRA songs. Filter by sutra, topic, intention, genre, and language.',
    path: '/songs',
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

  const findQuery = useMemo(() => searchParamsFromSearchString(location.search).get('find')?.trim() ?? '', [location.search])

  const [findDraft, setFindDraft] = useState(findQuery)
  const [findInputFocused, setFindInputFocused] = useState(false)
  const [deepSearchByLyricsId, setDeepSearchByLyricsId] = useState<Record<string, string> | null>(null)
  const [deepSearchLoading, setDeepSearchLoading] = useState(false)
  const filtersRef = useRef(filters)
  const sortRef = useRef(sort)
  const mediaRef = useRef(media)
  useEffect(() => {
    filtersRef.current = filters
    sortRef.current = sort
    mediaRef.current = media
  }, [filters, sort, media])

  const urlBrowsePage = useMemo(() => readCatalogBrowsePage(location.search), [location.search])

  const mediaOptionCounts = useMemo(() => {
    const counts: Record<MediaComboFilter, number> = {
      all: listenerCatalogSongs.length,
      lyrics_sc: 0,
      lyrics_yt: 0,
      full: 0,
    }
    for (const s of listenerCatalogSongs) {
      const sc = songHasSoundcloudListenPath(s)
      const yt = Boolean(s.has_youtube_video)
      if (sc && !yt) counts.lyrics_sc += 1
      else if (!sc && yt) counts.lyrics_yt += 1
      else if (sc && yt) counts.full += 1
    }
    return counts
  }, [listenerCatalogSongs])

  useEffect(() => {
    const next = readStateFromUrl()
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync browse UI from URL (back/forward, manual bar)
    setSort(next.sort)
    setFilters(next.filters)
    setMedia(next.media)
  }, [location.search])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- keep find draft aligned when `find` param changes externally
    setFindDraft(findQuery)
  }, [findQuery])

  useEffect(() => {
    if (findDraft === findQuery) return
    const tid = window.setTimeout(() => {
      navigate(
        buildBrowsePath(
          sortRef.current,
          filtersRef.current,
          findDraft.trim() || undefined,
          mediaRef.current,
          1,
        ),
        { replace: true },
      )
    }, FIND_DEBOUNCE_MS)
    return () => window.clearTimeout(tid)
  }, [findDraft, findQuery, navigate])

  useEffect(() => {
    const draftLen = findDraft.trim().length
    const queryLen = findQuery.trim().length
    const shouldWarmDeep = findInputFocused || draftLen >= 2 || queryLen >= 2
    if (!shouldWarmDeep || deepSearchByLyricsId || deepSearchLoading) return
    let cancelled = false
    queueMicrotask(() => {
      if (!cancelled) setDeepSearchLoading(true)
    })
    loadSongSearchDeep()
      .then((index) => {
        if (!cancelled) setDeepSearchByLyricsId(index)
      })
      .catch(() => {
        if (!cancelled) setDeepSearchByLyricsId(null)
      })
      .finally(() => {
        if (!cancelled) setDeepSearchLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [findDraft, findQuery, findInputFocused, deepSearchByLyricsId, deepSearchLoading])

  const syncUrl = useCallback(
    (
      nextSort: SortMode,
      nextFilters: FilterState,
      findOverride?: string,
      nextMedia?: MediaComboFilter,
      nextPage?: number,
    ) => {
      const nextFind = findOverride !== undefined ? findOverride.trim() : findQuery
      const m = nextMedia ?? media
      const p = nextPage !== undefined ? nextPage : urlBrowsePage
      navigate(buildBrowsePath(nextSort, nextFilters, nextFind || undefined, m, p), { replace: true })
    },
    [findQuery, media, navigate, urlBrowsePage],
  )

  const setSortAndSync = (mode: SortMode) => {
    setSort(mode)
    syncUrl(mode, filters, undefined, media, 1)
  }

  const patchFilters = (next: FilterState) => {
    setFilters(next)
    syncUrl(sort, next, undefined, media, 1)
  }

  const setMediaAndSync = (next: MediaComboFilter) => {
    setMedia(next)
    syncUrl(sort, filters, undefined, next, 1)
  }

  const filteredSorted = useMemo(() => {
    let list = listenerCatalogSongs.filter(
      (s) => songMatchesFilters(s, filters) && songMatchesMediaCombo(s, media),
    )
    if (findQuery) list = filterSongsByFindAnyQuery(list, findQuery, deepSearchByLyricsId ?? undefined)
    return sortSongs(list, sort)
  }, [listenerCatalogSongs, filters, media, sort, findQuery, deepSearchByLyricsId])

  const pageCount = Math.max(1, Math.ceil(filteredSorted.length / PAGE_SIZE))
  const safePage = Math.min(urlBrowsePage, pageCount)
  const pagedSongs = useMemo(
    () => filteredSorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [filteredSorted, safePage],
  )

  useEffect(() => {
    if (urlBrowsePage !== safePage) {
      navigate(buildBrowsePath(sort, filters, findQuery || undefined, media, safePage), { replace: true })
    }
  }, [urlBrowsePage, safePage, sort, filters, findQuery, media, navigate])

  const pagerLink = useCallback(
    (target: number) => buildBrowsePath(sort, filters, findQuery || undefined, media, target),
    [sort, filters, findQuery, media],
  )

  const facetSelections = countFacetSelections(filters)
  const hasActiveContext = facetSelections > 0 || media !== 'all' || Boolean(findQuery)
  const showDeepRefiningHint = Boolean(findQuery) && deepSearchLoading && !deepSearchByLyricsId
  const contextSummary = hasActiveContext
    ? `${filteredSorted.length} of ${listenerCatalogSongs.length} songs · ${facetSelections} filter${
        facetSelections === 1 ? '' : 's'
      }${media !== 'all' ? ' · media filter' : ''}${findQuery ? ' · discovery filter' : ''}${
        showDeepRefiningHint ? ' · refining lyrics…' : ''
      }`
    : `${listenerCatalogSongs.length} songs`

  const clearAllFilters = () => {
    const cleared = emptyFilterState()
    setFilters(cleared)
    setMedia('all')
    setFindDraft('')
    syncUrl(sort, cleared, '', 'all', 1)
  }

  useSyncCatalogHeaderHeight(pageRef, headerRef, [
    sort,
    filtersOpen,
    facetSelections,
    media,
    filteredSorted.length,
    findQuery,
    findDraft,
    safePage,
  ])

  const activeFilterContext = (
    <section
      className="catalog-active-context"
      aria-label={hasActiveContext ? 'Active filters and result count' : 'Catalog result count'}
    >
      <p className="catalog-active-context__summary">{contextSummary}</p>
      {hasActiveContext ? (
        <div className="catalog-chips">
          {findQuery ? (
            <button type="button" className="catalog-chip catalog-chip--find" onClick={() => syncUrl(sort, filters, '', media, 1)}>
              Discovery: {findQuery}
              <span className="catalog-chip-x" aria-hidden>×</span>
            </button>
          ) : null}
          {media !== 'all' ? (
            <button type="button" className="catalog-chip" onClick={() => setMediaAndSync('all')}>
              Media: {MEDIA_FILTER_LABELS[media]}
              <span className="catalog-chip-x" aria-hidden>×</span>
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
                <span className="catalog-chip-x" aria-hidden>×</span>
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
            <span className="catalog-breadcrumbs__current" aria-current="page">Songs</span>
          </nav>
          <div className="catalog-page-intro catalog-page-intro--song-catalog">
            <h1 className="catalog-page-h1">The Songs</h1>
            <p className="catalog-page-sub">
              Every song in the collection, meaning-first. Filter by sutra, light or shadow, topic, intention, or
              language.
            </p>
          </div>
          <main id="main-content" className="catalog-main">
            <div className="catalog-main__sort-row">
              <div className="catalog-sort catalog-sort--loading" aria-hidden>
                <span className="catalog-sort-label">Sort</span>
                <span className="catalog-sort-select catalog-skeleton-block" />
              </div>
            </div>
            <div className="catalog-grid catalog-grid--skeleton" aria-hidden>
              {Array.from({ length: 6 }).map((_, i) => (
                <article key={`songs-skeleton-${i}`} className="catalog-card catalog-card--skeleton">
                  <div className="catalog-card-art catalog-skeleton-block" />
                  <div className="catalog-card-body">
                    <span className="catalog-skeleton-block catalog-skeleton-line catalog-skeleton-line--title" />
                    <span className="catalog-skeleton-block catalog-skeleton-line" />
                    <span className="catalog-skeleton-block catalog-skeleton-line catalog-skeleton-line--short" />
                  </div>
                </article>
              ))}
            </div>
          </main>
        </div>
        <GlobalFooter />
      </div>
    )
  }

  if (catalogError || songCatalogRows === null) {
    return (
      <div ref={pageRef} className="catalog catalog-page catalog-page--shell">
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
          <span className="catalog-breadcrumbs__current" aria-current="page">Songs</span>
        </nav>

        <div className="catalog-page-intro catalog-page-intro--song-catalog">
          <h1 className="catalog-page-h1">The Songs</h1>
          <p className="catalog-page-sub">
            Every song in the collection, meaning-first. Filter by sutra, light or shadow, topic, intention, or
            language. Each song has a
            short paragraph on why it exists, and music you can play right here. Lyrics-only pieces live on{' '}
            <Link to="/words">Words</Link>.
          </p>
        </div>

        <div className={`catalog-layout${filtersOpen ? '' : ' catalog-layout--filters-collapsed'}`}>
          <aside
            className={`catalog-filters${filtersOpen ? ' is-open' : ''}`}
            aria-labelledby="catalog-filters-heading"
          >
            <div className="catalog-filters-head">
              <h2 id="catalog-filters-heading" className="catalog-section-title">
                Filters
              </h2>
              <button
                type="button"
                className="catalog-icon-btn"
                onClick={() => setFiltersOpen(false)}
                aria-expanded={filtersOpen}
                aria-controls="catalog-filter-panel"
              >
                Hide
              </button>
            </div>

            {filtersOpen ? activeFilterContext : null}

            <div id="catalog-filter-panel" className="catalog-facet-stack">
            <section className="catalog-facet" aria-labelledby="catalog-songs-search-heading">
              <h3 id="catalog-songs-search-heading">Search</h3>
              <label className="catalog-facet-find-label" htmlFor="catalog-songs-find-input">
                Search by title, meaning summary, extract, or lyrics
              </label>
              <input
                id="catalog-songs-find-input"
                className="catalog-facet-find-input"
                type="search"
                name="songs_find"
                inputMode="search"
                autoComplete="off"
                spellCheck={false}
                enterKeyHint="search"
                value={findDraft}
                onChange={(e) => setFindDraft(e.target.value)}
                onFocus={() => setFindInputFocused(true)}
                onBlur={() => setFindInputFocused(false)}
              />
            </section>
            <section className="catalog-facet" aria-labelledby="catalog-media-heading">
              <h3 id="catalog-media-heading">Media</h3>
              <p className="catalog-facet-help" id="catalog-media-desc">
                Filter by media paths for songs with listener media. Lyrics-only pieces are on <Link to="/words">Words</Link>.
              </p>
              <div className="catalog-facet-chips" role="group" aria-describedby="catalog-media-desc">
                {MEDIA_FILTER_OPTIONS.map(({ id, label }) => {
                  const active = media === id
                  const count = mediaOptionCounts[id]
                  return (
                    <button
                      key={id}
                      type="button"
                      className={`catalog-facet-chip${active ? ' is-active' : ''}`}
                      onClick={() => setMediaAndSync(id)}
                      title={`${count} songs`}
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
              const headingId = `catalog-${group}-heading`
              return (
                <section key={group} className="catalog-facet" aria-labelledby={headingId}>
                  <h3 id={headingId} title={FACET_HELP[group]}>{FACET_LABELS[group]}</h3>
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
                          title={group === 'sutra' ? `${sutraQuestionFromDisplay(value)} (${count} songs)` : `${count} songs`}
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
            <div
              className="catalog-sort"
              aria-label="Sort catalog by publish date, song title, combined in-app track stats, or top-track peak"
            >
              <label className="catalog-sort-label" htmlFor="catalog-sort-select">
                Sort
              </label>
              <select
                id="catalog-sort-select"
                className="catalog-sort-select"
                value={sort}
                onChange={(e) => setSortAndSync(e.target.value as SortMode)}
              >
                <option value="newest">Newest (catalog publish date)</option>
                <option value="title_az">Song title (A–Z)</option>
                <optgroup label="Songs: all in-app tracks combined">
                  <option value="plays_total">Most plays · songs (combined in-app tracks)</option>
                  <option value="likes_total">Most likes · songs (combined in-app tracks)</option>
                </optgroup>
                <optgroup label="Tracks: strongest single in-app track">
                  <option value="plays_peak">Most plays · tracks (strongest single in-app)</option>
                  <option value="likes_peak">Most likes · tracks (strongest single in-app)</option>
                </optgroup>
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
                aria-controls="catalog-filter-panel"
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
          <div className="catalog-grid">
            {pagedSongs.map((song) => {
              const secondaryMeta = [song.topic, song.intention, song.light_shadow]
                .map((value) => value.trim())
                .filter(Boolean)
              const secondaryLine = secondaryMeta.join(' · ')
              const linkSearchParams = new URLSearchParams(location.search)
              if (songHasSoundcloudListenPath(song)) linkSearchParams.set('section', 'audio')
              const linkSearch = linkSearchParams.toString()
              return (
                <Link
                  key={song.lyrics_id}
                  to={{
                    pathname: songCatalogPath(song.lyrics_title, song.url_slug),
                    search: linkSearch ? `?${linkSearch}` : '',
                  }}
                  className="catalog-card catalog-card-link"
                >
                  <div className="catalog-card-art">
                    {song.cover_image_url ? (
                      <img src={song.cover_image_url} alt="" loading="lazy" width={200} height={200} />
                    ) : (
                      <div className="catalog-card-art-fallback" aria-hidden>
                        🍌
                      </div>
                    )}
                    <div className="catalog-card-media-strip" aria-label={catalogMediaAriaLabel(song)}>
                      <span
                        className={`catalog-card-media-slot catalog-card-media-slot--sc${
                          songHasSoundcloudListenPath(song) ? ' is-on' : ' is-off'
                        }`}
                        title={
                          song.has_in_app_playback
                            ? 'SoundCloud: curated in-app track picks'
                            : song.has_sc_catalog_listen
                              ? 'SoundCloud: listen via catalog export URL (no primary EP)'
                              : song.primary_ep_url.trim()
                                ? 'SoundCloud: listen via linked EP on song page'
                                : 'No SoundCloud listen path in catalog'
                        }
                        aria-hidden
                      >
                        <FooterSocialIcon id="soundcloud" className="catalog-card-media-icon" />
                      </span>
                      <span
                        className={`catalog-card-media-slot catalog-card-media-slot--yt${song.has_youtube_video ? ' is-on' : ' is-off'}${
                          song.has_youtube_video && !song.has_youtube_embed ? ' catalog-card-media-slot--yt-partial' : ''
                        }`}
                        title={
                          !song.has_youtube_video
                            ? 'No YouTube video on file for this song'
                            : song.has_youtube_embed
                              ? 'YouTube video on file (embeddable in app)'
                              : 'YouTube video on file; in-app embed may be off for the default pick'
                        }
                        aria-hidden
                      >
                        <FooterSocialIcon id="youtube" className="catalog-card-media-icon" />
                      </span>
                    </div>
                  </div>
                  <div className="catalog-card-body">
                    <h2 className="catalog-card-title song-title">{song.lyrics_title}</h2>
                    {song.summary_short ? <p className="catalog-card-summary">{song.summary_short}</p> : null}
                    <div className="catalog-card-meta">
                      {song.sutra.trim() ? (
                        <span className={`catalog-sutra-word ${sutraClassName(song.sutra.trim())}`}>{song.sutra.trim()}</span>
                      ) : null}
                      {secondaryLine ? (
                        <span
                          className="catalog-card-meta-secondary"
                          title={secondaryLine}
                          aria-label={`Tags: ${secondaryMeta.join(', ')}`}
                        >
                          {secondaryLine}
                        </span>
                      ) : null}
                    </div>
                  </div>
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
          {filteredSorted.length === 0 ? <p className="catalog-empty">No songs match these filters. Try loosening one axis.</p> : null}
          </main>
        </div>
      </div>

      <GlobalFooter />
    </div>
  )
}
