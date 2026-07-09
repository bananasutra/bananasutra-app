import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  DISCOVERY_FACET_LABELS as FACET_LABELS,
  CATALOG_BROWSER_FACET_ORDER as FACET_GROUPS,
} from './catalogFacetConfig'
import { facetCountsFromSongs } from './facetCountsFromSongs'
import {
  emptyFilterState,
  type FilterFacetKey,
  type FacetGroupKey,
  type FilterState,
  type MediaComboFilter,
  type SongCatalogItem,
  type SortMode,
} from './types'
import { reportSongsFilterPatch } from './catalogAnalytics'
import { songMatchesFilters, songMatchesMediaCombo, sortSongs } from './filterSongs'
import { filterSongsByFindAnyQuery } from './searchMatch'
import { buildContextualSongFacetEntries } from './facetCountsContextual'
import { browseRowHasAudioSection, songCatalogLinkTo } from './songPaths'
import { sutraClassName } from './sutraTheme'
import { sutraQuestionFromDisplay } from './sutraContext'
import { buildBrowsePath, readBrowseStateFromSearchParams, readCatalogBrowsePage, readStateFromUrl, serializeBrowseQuery } from './urlState'
import { searchParamsFromSearchString } from './urlSearchParams'
import {
  CatalogFilterBar,
  type CatalogFilterBarActivePill,
  type CatalogFilterBarFacetGroup,
  type CatalogFilterBarSecondaryGroup,
} from './CatalogFilterBar'
import { facetEntriesToToggleChips } from './catalogFilterBarBuilders'
import { GlobalHeader } from './GlobalHeader'
import { GlobalFooter } from './GlobalFooter'
import { CatalogInfiniteScrollFooter } from './CatalogInfiniteScrollFooter'
import {
  catalogInfiniteScrollStorageKey,
  useCatalogInfiniteScroll,
} from './useCatalogInfiniteScroll'
import { buildSrcset, coverImageUrl } from '../seo/imageUrl'
import { canonicalPathForRoute } from './seoPaths'
import { renderPageMeta } from './usePageMeta'
import { useSyncCatalogHeaderHeight } from './useSyncCatalogHeaderHeight'
import { loadSongSearchDeep, useSongCatalogBrowse } from './generatedData'
import { hasListenerCatalogMedia } from './listenerCatalog'
import { FooterSocialIcon } from './FooterSocialIcons'
import './CatalogApp.css'

const FIND_DEBOUNCE_MS = 350
const SONG_CARD_COVER_REQUEST_WIDTH = 480
const SONG_CARD_COVER_SIZES = '(max-width: 640px) 48vw, (max-width: 1100px) 32vw, 260px'

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
  const lyricsOnlySongCount = useMemo(
    () => catalogSongs.filter((song) => !hasListenerCatalogMedia(song)).length,
    [catalogSongs],
  )

  const [browseSeed] = useState(() =>
    readBrowseStateFromSearchParams(searchParamsFromSearchString(window.location.search)),
  )
  const [sort, setSort] = useState<SortMode>(browseSeed.sort)
  const [filters, setFilters] = useState<FilterState>(browseSeed.filters)
  const [media, setMedia] = useState<MediaComboFilter>(browseSeed.media)
  const [includeLyricsOnly, setIncludeLyricsOnly] = useState(browseSeed.includeLyricsOnly)
  const [filterBarExpanded, setFilterBarExpanded] = useState(false)

  const browsePoolSongs = useMemo(
    () => (includeLyricsOnly ? catalogSongs : listenerCatalogSongs),
    [catalogSongs, listenerCatalogSongs, includeLyricsOnly],
  )
  const fullFacetEntries = useMemo(() => facetCountsFromSongs(browsePoolSongs), [browsePoolSongs])

  const pageMeta = renderPageMeta({
    title: 'Songs Catalog',
    description: 'Browse all BANANASUTRA songs. Filter by sutra, topic, intention, genre, and language.',
    path: canonicalPathForRoute('/songs'),
  })

  const findQuery = useMemo(() => searchParamsFromSearchString(location.search).get('find')?.trim() ?? '', [location.search])

  const [findDraft, setFindDraft] = useState(findQuery)
  const [findInputFocused, setFindInputFocused] = useState(false)
  const [deepSearchByLyricsId, setDeepSearchByLyricsId] = useState<Record<string, string> | null>(null)
  const [deepSearchLoading, setDeepSearchLoading] = useState(false)
  const contextualFacetEntries = useMemo(
    () =>
      buildContextualSongFacetEntries(
        browsePoolSongs,
        Object.fromEntries(
          FACET_GROUPS.map((group) => [group, fullFacetEntries[group] ?? []]),
        ) as Record<FilterFacetKey, { value: string; count: number }[]>,
        FACET_GROUPS,
        filters,
        media,
        findQuery,
        deepSearchByLyricsId ?? undefined,
      ),
    [browsePoolSongs, fullFacetEntries, filters, media, findQuery, deepSearchByLyricsId],
  )
  const filtersRef = useRef(filters)
  const sortRef = useRef(sort)
  const mediaRef = useRef(media)
  const includeLyricsOnlyRef = useRef(includeLyricsOnly)
  useEffect(() => {
    filtersRef.current = filters
    sortRef.current = sort
    mediaRef.current = media
    includeLyricsOnlyRef.current = includeLyricsOnly
  }, [filters, sort, media, includeLyricsOnly])

  const urlBrowsePage = useMemo(() => readCatalogBrowsePage(location.search), [location.search])
  const [legacyPageSeed] = useState(() => urlBrowsePage)

  const mediaOptionCounts = useMemo(() => {
    const counts: Record<MediaComboFilter, number> = {
      all: browsePoolSongs.length,
      lyrics_sc: 0,
      lyrics_yt: 0,
      full: 0,
    }
    for (const s of browsePoolSongs) {
      const sc = songHasSoundcloudListenPath(s)
      const yt = Boolean(s.has_youtube_video)
      if (sc && !yt) counts.lyrics_sc += 1
      else if (!sc && yt) counts.lyrics_yt += 1
      else if (sc && yt) counts.full += 1
    }
    return counts
  }, [browsePoolSongs])

  useEffect(() => {
    const next = readStateFromUrl()
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync browse UI from URL (back/forward, manual bar)
    setSort(next.sort)
    setFilters(next.filters)
    setMedia(next.media)
    setIncludeLyricsOnly(next.includeLyricsOnly)
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
          includeLyricsOnlyRef.current,
        ),
        { replace: true },
      )
    }, FIND_DEBOUNCE_MS)
    return () => window.clearTimeout(tid)
  }, [findDraft, findQuery, navigate])

  useEffect(() => {
    if (urlBrowsePage <= 1) return
    navigate(buildBrowsePath(sort, filters, findQuery || undefined, media, 1, includeLyricsOnly), { replace: true })
  }, [urlBrowsePage, sort, filters, findQuery, media, includeLyricsOnly, navigate])

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
      nextIncludeLyricsOnly?: boolean,
    ) => {
      const nextFind = findOverride !== undefined ? findOverride.trim() : findQuery
      const m = nextMedia ?? media
      const p = nextPage !== undefined ? nextPage : urlBrowsePage
      const lyricsOnly = nextIncludeLyricsOnly ?? includeLyricsOnly
      navigate(buildBrowsePath(nextSort, nextFilters, nextFind || undefined, m, p, lyricsOnly), { replace: true })
    },
    [findQuery, media, includeLyricsOnly, navigate, urlBrowsePage],
  )

  const setSortAndSync = (mode: SortMode) => {
    setSort(mode)
    syncUrl(mode, filters, undefined, media, 1)
  }

  const patchFilters = (next: FilterState) => {
    reportSongsFilterPatch(filters, next)
    setFilters(next)
    syncUrl(sort, next, undefined, media, 1)
  }

  const setMediaAndSync = (next: MediaComboFilter) => {
    setMedia(next)
    syncUrl(sort, filters, undefined, next, 1)
  }

  const setIncludeLyricsOnlyAndSync = (next: boolean) => {
    setIncludeLyricsOnly(next)
    syncUrl(sort, filters, undefined, media, 1, next)
  }

  const filteredSorted = useMemo(() => {
    let list = browsePoolSongs.filter(
      (s) => songMatchesFilters(s, filters) && songMatchesMediaCombo(s, media),
    )
    if (findQuery) list = filterSongsByFindAnyQuery(list, findQuery, deepSearchByLyricsId ?? undefined)
    return sortSongs(list, sort)
  }, [browsePoolSongs, filters, media, sort, findQuery, deepSearchByLyricsId])

  const songsScrollResetKey = useMemo(
    () => serializeBrowseQuery(sort, filters, findQuery || undefined, media, 1, includeLyricsOnly),
    [sort, filters, findQuery, media, includeLyricsOnly],
  )

  const {
    visibleItems: pagedSongs,
    visibleCount: songsVisibleCount,
    totalCount: songsTotalCount,
    hasMore: songsHasMore,
    loadMore: loadMoreSongs,
  } = useCatalogInfiniteScroll({
    items: filteredSorted,
    resetKey: songsScrollResetKey,
    storageKey: catalogInfiniteScrollStorageKey('/songs', songsScrollResetKey),
    legacyPage: legacyPageSeed,
  })

  const facetSelections = countFacetSelections(filters)
  const hasActiveContext =
    facetSelections > 0 || media !== 'all' || includeLyricsOnly || Boolean(findQuery)
  const showDeepRefiningHint = Boolean(findQuery) && deepSearchLoading && !deepSearchByLyricsId
  const contextSummary = hasActiveContext
    ? `${filteredSorted.length} of ${browsePoolSongs.length} songs · ${facetSelections} filter${
        facetSelections === 1 ? '' : 's'
      }${media !== 'all' ? ' · media filter' : ''}${includeLyricsOnly ? ' · lyrics-only included' : ''}${
        findQuery ? ' · discovery filter' : ''
      }${showDeepRefiningHint ? ' · refining lyrics…' : ''}`
    : `${browsePoolSongs.length} songs with audio`

  const clearAllFilters = () => {
    const cleared = emptyFilterState()
    reportSongsFilterPatch(filters, cleared)
    setFilters(cleared)
    setMedia('all')
    setIncludeLyricsOnly(false)
    setFindDraft('')
    syncUrl(sort, cleared, '', 'all', 1, false)
  }

  useSyncCatalogHeaderHeight(pageRef, headerRef, [
    sort,
    filterBarExpanded,
    facetSelections,
    media,
    includeLyricsOnly,
    filteredSorted.length,
    findQuery,
    findDraft,
    songsVisibleCount,
  ])

  const songActivePills: CatalogFilterBarActivePill[] = []
  if (findQuery) {
    songActivePills.push({
      id: 'find',
      label: <>Search: {findQuery}</>,
      onClick: () => syncUrl(sort, filters, '', media, 1),
      title: 'Remove text filter',
    })
  }
  if (media !== 'all') {
    songActivePills.push({
      id: 'media',
      label: <>Media: {MEDIA_FILTER_LABELS[media]}</>,
      onClick: () => setMediaAndSync('all'),
      title: 'Clear media filter',
    })
  }
  if (includeLyricsOnly) {
    songActivePills.push({
      id: 'include-lyrics-only',
      label: <>Lyrics-only songs included</>,
      onClick: () => setIncludeLyricsOnlyAndSync(false),
      title: 'Exclude lyrics-only songs',
    })
  }
  for (const key of Object.keys(filters) as (keyof FilterState)[]) {
    for (const value of filters[key]) {
      songActivePills.push({
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
        title: key === 'sutra' ? sutraQuestionFromDisplay(value) : undefined,
      })
    }
  }

  const songMediaGroup: CatalogFilterBarSecondaryGroup = {
    id: 'media',
    label: 'Media',
    helpText: 'Filter by media paths for songs with listener media. Lyrics-only pieces are on Words.',
    options: MEDIA_FILTER_OPTIONS.map(({ id, label }) => ({
      id: `media-${id}`,
      label,
      count: mediaOptionCounts[id],
      active: media === id,
      onClick: () => setMediaAndSync(id),
      title: `${mediaOptionCounts[id]} songs`,
    })),
  }

  const songFacetGroups: CatalogFilterBarFacetGroup[] = FACET_GROUPS.flatMap((group) => {
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
          countLabel: 'songs',
        }),
      },
    ]
  })

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
            <div className="catalog-main__sort-row songs-page__sort-row">
              <div className="catalog-sort songs-page__sort catalog-sort--loading" aria-hidden>
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
          <span className="catalog-breadcrumbs__current" aria-current="page">Songs</span>
        </nav>

        <div className="catalog-page-intro catalog-page-intro--song-catalog">
          <h1 className="catalog-page-h1">The Songs</h1>
          <p className="catalog-page-sub">
            Every song in the collection, meaning-first. Filter by sutra, light or shadow, topic, intention, or
            language. Each song has a short paragraph on why it exists, and music you can play right here.
          </p>
        </div>

        <div className="songs-page__content">
          <CatalogFilterBar
            ariaLabel="Filter songs"
            panelId="catalog-filter-panel"
            resultSummary={contextSummary}
            activePills={songActivePills}
            onClearAll={clearAllFilters}
            secondaryGroup={songMediaGroup}
            secondaryGroupPosition="after-facets"
            facetGroups={songFacetGroups}
            search={{
              id: 'catalog-songs-find-input',
              label: 'Search',
              ariaLabel: 'Search songs by title, meaning summary, extract, or lyrics',
              value: findDraft,
              onChange: setFindDraft,
              onFocus: () => setFindInputFocused(true),
              onBlur: () => setFindInputFocused(false),
              inputName: 'songs_find',
            }}
            defaultExpanded={filterBarExpanded}
            onExpandedChange={setFilterBarExpanded}
            panelAfterSearch={
              <div className="songs-page__lyrics-only-filter">
                <label className="songs-page__lyrics-only-toggle">
                  <input
                    type="checkbox"
                    checked={includeLyricsOnly}
                    onChange={(e) => setIncludeLyricsOnlyAndSync(e.target.checked)}
                  />
                  <span className="songs-page__lyrics-only-toggle-text">
                    <span className="songs-page__lyrics-only-toggle-label">Include lyrics-only songs</span>
                    <span className="songs-page__lyrics-only-toggle-count">+{lyricsOnlySongCount}</span>
                  </span>
                </label>
              </div>
            }
            toolbarEnd={
              <div
                className="catalog-sort songs-page__sort"
                aria-label="Sort songs by engagement, likes, plays, publish date, or title"
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
                  <option value="engagement_total">Most engagement</option>
                  <option value="likes_total">Most likes</option>
                  <option value="plays_total">Most plays</option>
                  <option value="newest">Newest (publish date)</option>
                  <option value="title_az">Song title (A–Z)</option>
                </select>
              </div>
            }
          />

          <main id="main-content" className="catalog-main songs-page__main">
          <div className="catalog-grid">
            {pagedSongs.map((song) => {
              const secondaryMeta = [song.topic, song.intention, song.light_shadow]
                .map((value) => value.trim())
                .filter(Boolean)
              const secondaryLine = secondaryMeta.join(' · ')
              return (
                <Link
                  key={song.lyrics_id}
                  to={songCatalogLinkTo(song.lyrics_title, song.url_slug, {
                    section:
                      songHasSoundcloudListenPath(song) || browseRowHasAudioSection(song) ? 'audio' : undefined,
                  })}
                  className="catalog-card catalog-card-link"
                >
                  <div className="catalog-card-art">
                    {song.cover_image_url ? (
                      <img
                        srcSet={buildSrcset(song.cover_image_url, [240, 360, SONG_CARD_COVER_REQUEST_WIDTH, 640])}
                        sizes={SONG_CARD_COVER_SIZES}
                        src={coverImageUrl(song.cover_image_url, { width: SONG_CARD_COVER_REQUEST_WIDTH })}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        width={400}
                        height={400}
                      />
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
            <CatalogInfiniteScrollFooter
              visibleCount={songsVisibleCount}
              totalCount={songsTotalCount}
              hasMore={songsHasMore}
              loadMore={loadMoreSongs}
              noun="songs"
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
