import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import facetsJson from '../data/generated/facets.json'
import {
  DISCOVERY_FACET_HELP,
  DISCOVERY_FACET_LABELS,
  HEADER_BROWSE_SONG_FACETS,
  HEADER_BROWSE_TRACK_FACETS,
} from './catalogFacetConfig'
import { sutraClassName } from './sutraTheme'
import {
  sortDiscoveryEpsTab,
  sortDiscoverySongbooksForDisplay,
  sortDiscoveryTracksTab,
} from './discoveryRanking'
import { catalogDataFileUrl, fetchCatalogData } from './catalogDataUrl'
import { songCatalogPath } from './songPaths'
import { songbookByName, songbookHref } from './songbooks'
import { filterTracksByFindQuery, sortTrackCatalog } from './filterTracks'
import {
  filterSongsByAlbumSearchQuery,
  filterSongsByFindAnyQuery,
  filterSongsByTrackSearchQuery,
  filterYoutubeVideosBySearchQuery,
  searchTokens,
} from './searchMatch'
import { pickSmartDiscoveryTab } from './discoverySmartTab'
import type {
  FacetGroupKey,
  FacetsPayload,
  FilterFacetKey,
  SongCatalogItem,
  TrackCatalogItem,
  YouTubeCatalogVideo,
} from './types'
import { emptyTracksFilterState } from './types'
import {
  buildBrowsePathForFacet,
  buildTracksBrowsePath,
  buildTracksBrowsePathFull,
  CATALOG_BROWSE_PATH,
} from './urlState'
import './CatalogApp.css'
import './DiscoverySearch.css'
import { loadSongSearchDeep, loadYoutubeByLyricsId, useSongCatalogBrowse } from './generatedData'
import { hasListenerCatalogMedia, isLyricsOnlySong } from './listenerCatalog'

const facets = facetsJson as FacetsPayload
const DEBOUNCE_MS = 300
const TRACK_STRICT_GENRE_FACET_TOKENS = new Set<string>(
  [
    ...(facets.track_genre ?? []),
    ...(facets.track_secondary_genre ?? []),
    ...(facets.track_mood ?? []),
    ...(facets.track_instrument ?? []),
    ...(facets.track_tempo_feel ?? []),
  ].map((e) => e.value.trim().toLowerCase()),
)

/** Keyword-state preview rows per tab (IA §3.10). */
const PREVIEW_LIMIT = 5

export type DiscoverySearchVariant = 'hero' | 'header'

export type DiscoverySearchProps = {
  variant: DiscoverySearchVariant
  initialQuery?: string
  syncQueryToUrl?: boolean
}

type DiscoveryTab = 'songbooks' | 'songs' | 'tracks' | 'videos'
type SongbookResultGroup = {
  songbook: string
  href: string
  matchCount: number
  totalSongs: number
  sampleTitles: string[]
  artworkUrl: string
}

/** One song (lyrics_id) with every matching YouTube row in the current discovery filter. */
type YoutubeDiscoverySongGroup = {
  lyrics_id: string
  lyrics_title: string
  sutra: string
  genreLine: string
  videos: YouTubeCatalogVideo[]
}

function splitGenreTokens(raw: string): string[] {
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

function genreTokensForVideo(v: YouTubeCatalogVideo): string[] {
  const raw = [v.genre_primary, v.genre_secondary].filter(Boolean).join(',')
  return splitGenreTokens(raw)
}

function aggregateGenreLine(videos: YouTubeCatalogVideo[]): string {
  const seen = new Set<string>()
  const out: string[] = []
  for (const v of videos) {
    for (const t of genreTokensForVideo(v)) {
      const k = t.toLowerCase()
      if (seen.has(k)) continue
      seen.add(k)
      out.push(t)
    }
  }
  out.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
  return out.join(' · ')
}

function summarizeYoutubeTitles(videos: YouTubeCatalogVideo[]): string {
  if (videos.length === 0) return ''
  if (videos.length === 1) return (videos[0]!.title || '').trim()
  const max = 2
  const parts = videos
    .slice(0, max)
    .map((v) => (v.title || '').trim())
    .filter(Boolean)
  const more = videos.length > max ? ` (+${videos.length - max} more videos)` : ''
  return `${parts.join(' · ')}${more}`
}

function groupYoutubeVideosByLyricsId(videos: YouTubeCatalogVideo[]): YoutubeDiscoverySongGroup[] {
  const map = new Map<string, YouTubeCatalogVideo[]>()
  for (const v of videos) {
    const raw = (v.lyrics_id || '').trim()
    const id = raw || '__unlinked__'
    if (!map.has(id)) map.set(id, [])
    map.get(id)!.push(v)
  }
  for (const arr of map.values()) {
    arr.sort((a, b) => {
      const da = a.publish_date || ''
      const db = b.publish_date || ''
      if (da !== db) return db.localeCompare(da)
      return (a.title || '').localeCompare(b.title || '', undefined, { sensitivity: 'base' })
    })
  }
  const groups: YoutubeDiscoverySongGroup[] = [...map.entries()].map(([lyrics_id, vids]) => ({
    lyrics_id,
    lyrics_title:
      lyrics_id === '__unlinked__'
        ? `Videos not linked to song page (${vids.length})`
        : (vids[0]?.lyrics_title || '').trim() || (vids[0]?.title || '').trim(),
    sutra: (vids[0]?.sutra || '').trim(),
    genreLine: aggregateGenreLine(vids),
    videos: vids,
  }))
  groups.sort((a, b) => {
    const da = a.videos[0]?.publish_date || ''
    const db = b.videos[0]?.publish_date || ''
    if (da !== db) return db.localeCompare(da)
    return a.lyrics_title.localeCompare(b.lyrics_title, undefined, { sensitivity: 'base' })
  })
  return groups
}

/** Row subtitle for Top Tracks: catalog genre tags (EP-wide), not only the headline lead line. */
function topTracksRowGenreLabel(song: SongCatalogItem): string {
  const structured = [...song.track_genres, ...song.track_secondary_genres].map((g) => g.trim()).filter(Boolean)
  const uniq = [...new Set(structured)]
  if (uniq.length) return uniq.slice(0, 10).join(', ')
  return (song.discovery_top_track_genres ?? '').trim() || 'SoundCloud'
}

function thumbnailSrc(rawUrl: string, size = 't120x120'): string {
  const url = rawUrl.trim()
  if (!url) return ''
  // SoundCloud artwork URLs usually include a `-t<size>.` token.
  return url
    .replace(/-t\d+x\d+\./i, `-${size}.`)
    .replace(/-toriginal\./i, `-${size}.`)
}

const HEADER_OTHER_FACET_CHIP_CAP = 18

function browseChipHref(group: FacetGroupKey, value: string): string {
  if (group === 'track_genre') return buildTracksBrowsePath('primary_genre', value)
  if (group === 'track_secondary_genre') return buildTracksBrowsePath('secondary_genre', value)
  if (group === 'track_mood') return buildTracksBrowsePath('mood', value)
  if (group === 'track_instrument') return buildTracksBrowsePath('instrument', value)
  if (group === 'track_tempo_feel') return buildTracksBrowsePath('tempo_feel', value)
  return buildBrowsePathForFacet(group as FilterFacetKey, value)
}

export function DiscoverySearch({ variant, initialQuery = '', syncQueryToUrl = false }: DiscoverySearchProps) {
  const navigate = useNavigate()
  const { data: songCatalogRows } = useSongCatalogBrowse()
  const songCatalog = useMemo(() => songCatalogRows ?? [], [songCatalogRows])
  const listenerSongCatalog = useMemo(() => songCatalog.filter(hasListenerCatalogMedia), [songCatalog])
  const [youtubeFlat, setYoutubeFlat] = useState<YouTubeCatalogVideo[]>([])
  const [trackCatalogDiscovery, setTrackCatalogDiscovery] = useState<TrackCatalogItem[] | null>(null)
  const [deepSearchByLyricsId, setDeepSearchByLyricsId] = useState<Record<string, string> | null>(null)
  const [deepSearchLoading, setDeepSearchLoading] = useState(false)
  const [youtubeLoadStarted, setYoutubeLoadStarted] = useState(false)

  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const baseId = useId()
  const panelId = `${baseId}-panel`
  const browseGroupId = `${baseId}-browse`
  const typedListboxId = `${baseId}-typed-listbox`
  const optionPrefix = `${baseId}-opt`

  const [query, setQuery] = useState(initialQuery)
  const [debounced, setDebounced] = useState(initialQuery.trim())
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<DiscoveryTab>('songbooks')
  const [isNarrowViewport, setIsNarrowViewport] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches,
  )
  const [expandedFacet, setExpandedFacet] = useState<FacetGroupKey | null>(null)
  /** Active option index within the current tab preview (combobox + listbox); -1 = none. */
  const [activeOptionIndex, setActiveOptionIndex] = useState(-1)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync when `?q=` changes via navigation / SearchRedirect
    setQuery(initialQuery)
    setDebounced(initialQuery.trim())
  }, [initialQuery])

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(query.trim()), DEBOUNCE_MS)
    return () => window.clearTimeout(t)
  }, [query])

  useEffect(() => {
    const shouldWarmDeep = open && debounced.trim().length >= 2
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
  }, [open, debounced, deepSearchByLyricsId, deepSearchLoading])

  useEffect(() => {
    if (!syncQueryToUrl) return
    const q = debounced
    const path = q ? `/?q=${encodeURIComponent(q)}` : '/'
    window.history.replaceState(null, '', path)
  }, [debounced, syncQueryToUrl])

  useEffect(() => {
    if (!open || youtubeLoadStarted) return
    let cancelled = false
    queueMicrotask(() => {
      if (!cancelled) setYoutubeLoadStarted(true)
    })
    loadYoutubeByLyricsId()
      .then((o) => {
        if (!cancelled) setYoutubeFlat(Object.values(o).flat())
      })
      .catch(() => {
        if (!cancelled) setYoutubeFlat([])
      })
    return () => {
      cancelled = true
    }
  }, [open, youtubeLoadStarted])

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const onMq = () => setIsNarrowViewport(mq.matches)
    onMq()
    mq.addEventListener('change', onMq)
    return () => mq.removeEventListener('change', onMq)
  }, [])

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  useEffect(() => {
    if (!open || variant !== 'header' || !isNarrowViewport) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open, variant, isNarrowViewport])

  const tokens = useMemo(() => searchTokens(debounced), [debounced])
  const hasQuery = tokens.length > 0

  /** Align Top Tracks tab counts with `/tracks?q=` — same JSON + `filterTracksByFindQuery` as TracksPage. */
  useEffect(() => {
    if (!hasQuery || trackCatalogDiscovery !== null) return
    let cancelled = false
    fetchCatalogData(catalogDataFileUrl('track_catalog.json'))
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json() as Promise<TrackCatalogItem[]>
      })
      .then((rows) => {
        if (!cancelled) setTrackCatalogDiscovery(Array.isArray(rows) ? rows : [])
      })
      .catch(() => {
        if (!cancelled) setTrackCatalogDiscovery([])
      })
    return () => {
      cancelled = true
    }
  }, [hasQuery, trackCatalogDiscovery])

  const songsTabSongs = useMemo(() => {
    if (!hasQuery) return []
    const tokens = searchTokens(debounced)
    return sortDiscoveryEpsTab(
      filterSongsByFindAnyQuery(songCatalog, debounced, deepSearchByLyricsId ?? undefined),
      tokens,
    )
  }, [hasQuery, debounced, songCatalog, deepSearchByLyricsId])
  const songbooksTabSongs = useMemo(
    () =>
      hasQuery
        ? sortDiscoverySongbooksForDisplay(filterSongsByAlbumSearchQuery(songCatalog, debounced))
        : [],
    [hasQuery, debounced, songCatalog],
  )
  const tracksTabSongs = useMemo(() => {
    if (!hasQuery) return []
    const tokens = searchTokens(debounced)
    return sortDiscoveryTracksTab(
      filterSongsByTrackSearchQuery(listenerSongCatalog, debounced, {
        strictGenreFacetTokens: TRACK_STRICT_GENRE_FACET_TOKENS,
      }),
      tokens,
    )
  }, [hasQuery, debounced, listenerSongCatalog])

  /**
   * Same filter + default sort as `/tracks?q=` so preview rows match the tab badge / footer count.
   * (Song-card Top Tracks matching includes summaries — wider than per-track find.)
   */
  const tracksTabFilteredSorted = useMemo(() => {
    if (!hasQuery || trackCatalogDiscovery === null) return []
    return sortTrackCatalog(filterTracksByFindQuery(trackCatalogDiscovery, debounced), 'likes')
  }, [hasQuery, trackCatalogDiscovery, debounced])

  /** Song rows vs SC track rows can diverge (multiple mixes per title); badge matches TracksPage. */
  const tracksTabRowCount = useMemo(() => {
    if (!hasQuery) return 0
    if (trackCatalogDiscovery === null) return tracksTabSongs.length
    return tracksTabFilteredSorted.length
  }, [hasQuery, trackCatalogDiscovery, tracksTabFilteredSorted.length, tracksTabSongs.length])

  const videosTabFiltered = useMemo(
    () => (hasQuery ? filterYoutubeVideosBySearchQuery(youtubeFlat, debounced) : []),
    [hasQuery, debounced, youtubeFlat],
  )
  const videosTabGroupsAll = useMemo(() => groupYoutubeVideosByLyricsId(videosTabFiltered), [videosTabFiltered])

  const songbookResultGroups = useMemo((): SongbookResultGroup[] => {
    const grouped = new Map<string, SongCatalogItem[]>()
    for (const song of songbooksTabSongs) {
      const key = (song.songbook || '').trim() || 'Songbook not set'
      const existing = grouped.get(key)
      if (existing) existing.push(song)
      else grouped.set(key, [song])
    }
    const groups = [...grouped.entries()].map(([songbook, songs]) => {
      const meta = songbookByName(songbook)
      return {
        songbook,
        href: songbookHref(songbook),
        matchCount: songs.length,
        totalSongs: meta?.song_count ?? songs.length,
        sampleTitles: songs.slice(0, 3).map((s) => s.lyrics_title),
        artworkUrl: meta?.playlist_artwork_url || songs[0]?.cover_image_url || '',
      }
    })
    // Best matches first (most member hits), then A→Z within the same hit count.
    groups.sort((a, b) => b.matchCount - a.matchCount || a.songbook.localeCompare(b.songbook, undefined, { sensitivity: 'base' }))
    return groups
  }, [songbooksTabSongs])

  const smartDefaultTab = useMemo(
    () =>
      pickSmartDiscoveryTab(
        debounced,
        songbookResultGroups,
        songsTabSongs,
        tracksTabSongs,
        tracksTabRowCount,
        videosTabFiltered,
        videosTabGroupsAll.length,
      ),
    [debounced, songbookResultGroups, songsTabSongs, tracksTabSongs, tracksTabRowCount, videosTabFiltered, videosTabGroupsAll.length],
  )

  useEffect(() => {
    if (!hasQuery) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- keyword tabs hidden in browse mode; reset for next query
      setTab('songbooks')
      return
    }
    setTab(smartDefaultTab)
  }, [hasQuery, smartDefaultTab])

  const tabPreview = useMemo((): SongCatalogItem[] => {
    if (!hasQuery || tab !== 'songs') return []
    return songsTabSongs.slice(0, PREVIEW_LIMIT)
  }, [hasQuery, tab, songsTabSongs])

  const typedTracksPreviewLength = useMemo(() => {
    if (tab !== 'tracks' || !hasQuery) return 0
    if (trackCatalogDiscovery !== null) return Math.min(tracksTabFilteredSorted.length, PREVIEW_LIMIT)
    return Math.min(tracksTabSongs.length, PREVIEW_LIMIT)
  }, [tab, hasQuery, trackCatalogDiscovery, tracksTabFilteredSorted.length, tracksTabSongs.length])

  const typedVideoGroups = useMemo(() => {
    if (!hasQuery || tab !== 'videos') return []
    return videosTabGroupsAll.slice(0, PREVIEW_LIMIT)
  }, [hasQuery, tab, videosTabGroupsAll])

  const listLength =
    tab === 'videos'
      ? typedVideoGroups.length
      : tab === 'songbooks'
        ? songbookResultGroups.length
        : tab === 'tracks'
          ? typedTracksPreviewLength
          : tabPreview.length

  const headerBrowseSongCount = songCatalog.length
  const headerBrowseTrackCount = useMemo(
    () => listenerSongCatalog.reduce((sum, s) => sum + (s.track_count_published ?? 0), 0),
    [listenerSongCatalog],
  )

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset list highlight when query or tab surface changes
    setActiveOptionIndex(-1)
  }, [debounced, tab, hasQuery])

  const seeAllInTab = useMemo(() => {
    const q = debounced.trim()
    const enc = q ? encodeURIComponent(q) : ''
    switch (tab) {
      case 'songbooks': {
        const n = songbookResultGroups.length
        return {
          href: '/songbooks',
          label: 'See all songbooks',
          count: n > 0 ? n : null,
        }
      }
      case 'songs': {
        const n = songsTabSongs.length
        const hasMatches = Boolean(q && n > 0)
        return {
          href: enc ? `${CATALOG_BROWSE_PATH}?find=${enc}` : CATALOG_BROWSE_PATH,
          label: hasMatches ? `See all songs with "${q}"` : 'See all songs',
          count: hasMatches ? n : headerBrowseSongCount,
        }
      }
      case 'tracks': {
        const n = tracksTabRowCount
        const hasMatches = Boolean(q && n > 0)
        return {
          href: q ? buildTracksBrowsePathFull(emptyTracksFilterState(), q, 1, undefined, 'likes') : '/tracks',
          label: hasMatches ? `See all top tracks with "${q}"` : 'See all top tracks',
          count: hasMatches ? n : headerBrowseTrackCount,
        }
      }
      case 'videos': {
        const n = videosTabGroupsAll.length
        const hasMatches = Boolean(q && n > 0)
        return {
          href: enc ? `/videos?find=${enc}` : '/videos',
          label: hasMatches ? `See all videos with "${q}"` : 'See all videos',
          count: hasMatches ? n : null,
        }
      }
    }
  }, [
    tab,
    debounced,
    songbookResultGroups.length,
    songsTabSongs.length,
    tracksTabRowCount,
    videosTabGroupsAll.length,
    headerBrowseTrackCount,
    headerBrowseSongCount,
  ])

  const toggleBrowseFacet = useCallback((group: FacetGroupKey) => {
    setExpandedFacet((cur) => (cur === group ? null : group))
  }, [])

  const goSong = useCallback(
    (song: SongCatalogItem) => {
      navigate(songCatalogPath(song.lyrics_title, song.url_slug))
      setOpen(false)
    },
    [navigate],
  )

  const goTrackCatalogRow = useCallback(
    (row: TrackCatalogItem) => {
      navigate(songCatalogPath(row.lyrics_title, row.url_slug))
      setOpen(false)
    },
    [navigate],
  )
  const goSongbook = useCallback(
    (href: string) => {
      navigate(href)
      setOpen(false)
    },
    [navigate],
  )

  const goYoutubeSongGroup = useCallback(
    (group: YoutubeDiscoverySongGroup) => {
      const lid = (group.lyrics_id || '').trim()
      const title = (group.lyrics_title || '').trim()
      if (lid === '__unlinked__') {
        const find = debounced.trim()
        navigate(find ? `/videos?find=${encodeURIComponent(find)}&link=off_site` : '/videos?link=off_site')
        setOpen(false)
        return
      }
      if (!lid || !title) return
      const slug = (group.videos[0]?.url_slug || '').trim()
      navigate({
        pathname: songCatalogPath(title, slug || undefined),
        search: '?section=video',
      })
      setOpen(false)
    },
    [debounced, navigate],
  )

  const onSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      if (hasQuery && activeOptionIndex >= 0) {
        if (tab === 'songbooks' && activeOptionIndex < songbookResultGroups.length) {
          goSongbook(songbookResultGroups[activeOptionIndex]!.href)
          return
        }
        if (tab === 'videos' && activeOptionIndex < typedVideoGroups.length) {
          goYoutubeSongGroup(typedVideoGroups[activeOptionIndex]!)
          return
        }
        if (tab === 'tracks') {
          if (trackCatalogDiscovery !== null) {
            const slice = tracksTabFilteredSorted.slice(0, PREVIEW_LIMIT)
            const row = slice[activeOptionIndex]
            if (row) {
              goTrackCatalogRow(row)
              return
            }
          } else if (activeOptionIndex < Math.min(tracksTabSongs.length, PREVIEW_LIMIT)) {
            goSong(tracksTabSongs[activeOptionIndex]!)
            return
          }
        }
        if (tab === 'songs' && activeOptionIndex < tabPreview.length) {
          goSong(tabPreview[activeOptionIndex]!)
          return
        }
      }
      const q = query.trim()
      if (q) navigate(`${CATALOG_BROWSE_PATH}?find=${encodeURIComponent(q)}`)
      else navigate(CATALOG_BROWSE_PATH)
      setOpen(false)
    },
    [
      activeOptionIndex,
      goSong,
      goSongbook,
      goTrackCatalogRow,
      goYoutubeSongGroup,
      hasQuery,
      navigate,
      query,
      songbookResultGroups,
      tab,
      tabPreview,
      trackCatalogDiscovery,
      tracksTabFilteredSorted,
      tracksTabSongs,
      typedVideoGroups,
    ],
  )

  const onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!open) setOpen(true)
      if (!hasQuery || listLength === 0) return
      setActiveOptionIndex((i) => Math.min(listLength - 1, i + 1))
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (!open) setOpen(true)
      if (!hasQuery || listLength === 0) return
      setActiveOptionIndex((i) => Math.max(-1, i - 1))
      return
    }
    if (e.key === 'Home' && hasQuery && listLength > 0) {
      e.preventDefault()
      setActiveOptionIndex(0)
      return
    }
    if (e.key === 'End' && hasQuery && listLength > 0) {
      e.preventDefault()
      setActiveOptionIndex(listLength - 1)
      return
    }
  }

  const comboboxControls = open ? (hasQuery ? typedListboxId : browseGroupId) : undefined
  const activeDescendantId =
    hasQuery && open && activeOptionIndex >= 0 && activeOptionIndex < listLength
      ? `${optionPrefix}-${activeOptionIndex}`
      : undefined

  const headerMobileOpen = variant === 'header' && open && isNarrowViewport
  const shellClass = `discovery-search discovery-search--${variant}${open ? ' discovery-search--open' : ''}${headerMobileOpen ? ' discovery-search--header-mobile-open' : ''}`

  return (
    <div ref={rootRef} className={shellClass}>
      <div
        className={`discovery-search__mobile-sheet${headerMobileOpen ? ' discovery-search__mobile-sheet--fullscreen' : ''}`}
        role={headerMobileOpen ? 'dialog' : undefined}
        aria-modal={headerMobileOpen ? true : undefined}
        aria-label={headerMobileOpen ? 'Catalog search and browse' : undefined}
      >
      <form className="discovery-search__form" role="search" aria-label="Catalog discovery" onSubmit={onSubmit}>
        <div className="discovery-search__field">
          <span className="discovery-search__icon" aria-hidden>
            ⌕
          </span>
          <label htmlFor={`${baseId}-q`} className="visually-hidden">
            Search and browse the catalog
          </label>
          <input
            ref={inputRef}
            id={`${baseId}-q`}
            className="discovery-search__input"
            type="text"
            name="discovery_q"
            inputMode="search"
            autoComplete="off"
            spellCheck={false}
            role="combobox"
            aria-expanded={open}
            aria-controls={comboboxControls}
            aria-haspopup="listbox"
            aria-autocomplete="list"
            aria-activedescendant={activeDescendantId}
            placeholder="Search and discover…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setOpen(true)}
            onKeyDown={onInputKeyDown}
            enterKeyHint="search"
          />
          {query ? (
            <button
              type="button"
              className="discovery-search__clear"
              aria-label="Clear search"
              onClick={() => {
                setQuery('')
                setDebounced('')
                setActiveOptionIndex(-1)
                inputRef.current?.focus()
              }}
            >
              ×
            </button>
          ) : null}
        </div>
      </form>

      {open ? (
        <div id={panelId} className="discovery-search__panel" role="presentation">
          {!hasQuery ? (
            <div
              id={browseGroupId}
              className="discovery-search__browse discovery-search__browse--accordion"
              role="region"
              aria-label="Browse the catalog"
            >
              <section className="discovery-search__browse-section" aria-label="Songs">
                <ul className="discovery-search__browse-list">
                  {HEADER_BROWSE_SONG_FACETS.map((group) => {
                    const entries = facets[group] ?? []
                    const expanded = expandedFacet === group
                    const facetPanelId = `${baseId}-browse-facet-${group}`
                    const chipCap = group === 'topic' ? entries.length : HEADER_OTHER_FACET_CHIP_CAP
                    const chips = entries.slice(0, chipCap)
                    const help = DISCOVERY_FACET_HELP[group]
                    return (
                      <li key={group} className="discovery-search__browse-row-wrap">
                        <button
                          type="button"
                          className={`discovery-search__browse-row${expanded ? ' discovery-search__browse-row--open' : ''}`}
                          aria-expanded={expanded}
                          aria-controls={facetPanelId}
                          id={`${baseId}-browse-facetbtn-${group}`}
                          title={help}
                          onClick={() => toggleBrowseFacet(group)}
                        >
                          <span className="discovery-search__browse-row-label">{DISCOVERY_FACET_LABELS[group]}</span>
                          <span className="discovery-search__browse-row-chev" aria-hidden>
                            ›
                          </span>
                        </button>
                        {expanded ? (
                          <div id={facetPanelId} className="discovery-search__browse-facet-panel">
                            {chips.length ? (
                              <ul className="discovery-search__browse-values">
                                {chips.map(({ value, count }) => (
                                  <li key={value} className="discovery-search__browse-value-item">
                                    <Link
                                      className={`discovery-search__browse-value-link${
                                        group === 'sutra' ? ` ${sutraClassName(value)}` : ''
                                      }`}
                                      to={browseChipHref(group, value)}
                                      onClick={() => setOpen(false)}
                                    >
                                      <span>{value}</span>
                                      <span className="discovery-search__browse-value-count">{count}</span>
                                    </Link>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="discovery-search__browse-empty-facet">No tagged values in this slice yet.</p>
                            )}
                          </div>
                        ) : null}
                      </li>
                    )
                  })}
                </ul>
                <Link className="discovery-search__browse-all" to={CATALOG_BROWSE_PATH} onClick={() => setOpen(false)}>
                  <span className="discovery-search__browse-all-label">Browse all songs</span>
                  <span className="discovery-search__browse-all-count">{headerBrowseSongCount}</span>
                  <span className="discovery-search__browse-all-chev" aria-hidden>
                    →
                  </span>
                </Link>
              </section>

              <section
                className="discovery-search__browse-section discovery-search__browse-section--tracks"
                aria-label="Tracks"
              >
                <ul className="discovery-search__browse-list">
                  {HEADER_BROWSE_TRACK_FACETS.map((group) => {
                    const entries = facets[group] ?? []
                    const expanded = expandedFacet === group
                    const facetPanelId = `${baseId}-browse-facet-${group}`
                    const chips = entries.slice(0, HEADER_OTHER_FACET_CHIP_CAP)
                    const help = DISCOVERY_FACET_HELP[group]
                    return (
                      <li key={group} className="discovery-search__browse-row-wrap">
                        <button
                          type="button"
                          className={`discovery-search__browse-row${expanded ? ' discovery-search__browse-row--open' : ''}`}
                          aria-expanded={expanded}
                          aria-controls={facetPanelId}
                          id={`${baseId}-browse-facetbtn-${group}`}
                          title={help}
                          onClick={() => toggleBrowseFacet(group)}
                        >
                          <span className="discovery-search__browse-row-label">{DISCOVERY_FACET_LABELS[group]}</span>
                          <span className="discovery-search__browse-row-chev" aria-hidden>
                            ›
                          </span>
                        </button>
                        {expanded ? (
                          <div id={facetPanelId} className="discovery-search__browse-facet-panel">
                            {chips.length ? (
                              <ul className="discovery-search__browse-values">
                                {chips.map(({ value, count }) => (
                                  <li key={value} className="discovery-search__browse-value-item">
                                    <Link
                                      className="discovery-search__browse-value-link"
                                      to={browseChipHref(group, value)}
                                      onClick={() => setOpen(false)}
                                    >
                                      <span>{value}</span>
                                      <span className="discovery-search__browse-value-count">{count}</span>
                                    </Link>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="discovery-search__browse-empty-facet">No tagged values in this slice yet.</p>
                            )}
                          </div>
                        ) : null}
                      </li>
                    )
                  })}
                </ul>
                <Link className="discovery-search__browse-all" to="/tracks" onClick={() => setOpen(false)}>
                  <span className="discovery-search__browse-all-label">Browse all tracks</span>
                  <span className="discovery-search__browse-all-count">{headerBrowseTrackCount}</span>
                  <span className="discovery-search__browse-all-chev" aria-hidden>
                    →
                  </span>
                </Link>
              </section>
            </div>
          ) : (
            <div className="discovery-search__typed">
              <div className="discovery-search__tabs discovery-search__tabs--keyword" role="tablist" aria-label="Search results by category">
                {(
                  [
                    ['songbooks', 'Songbooks', songbookResultGroups.length] as const,
                    ['songs', 'Top Songs', songsTabSongs.length] as const,
                    ['tracks', 'Top Tracks', tracksTabRowCount] as const,
                    ['videos', 'Videos', videosTabGroupsAll.length] as const,
                  ] as const
                ).map(([key, label, count]) => (
                  <button
                    key={key}
                    type="button"
                    role="tab"
                    aria-selected={tab === key}
                    aria-controls={`${baseId}-tab-${key}`}
                    id={`${baseId}-tabbtn-${key}`}
                    tabIndex={tab === key ? 0 : -1}
                    className={`discovery-search__tab${tab === key ? ' discovery-search__tab--active' : ''}`}
                    onClick={() => setTab(key)}
                  >
                    {label}
                    <span className="discovery-search__tab-count">{count}</span>
                  </button>
                ))}
              </div>

              <div
                role="tabpanel"
                id={`${baseId}-tab-${tab}`}
                aria-labelledby={`${baseId}-tabbtn-${tab}`}
                className="discovery-search__tabpanel"
              >
                {tab === 'songs' ? (
                  <TypedSongList
                    songs={songsTabSongs}
                    limit={PREVIEW_LIMIT}
                    listboxId={typedListboxId}
                    optionIdPrefix={optionPrefix}
                    activeIndex={activeOptionIndex}
                    onHoverOption={setActiveOptionIndex}
                    onPick={goSong}
                    emptyHint="No meaning matches for this query."
                  />
                ) : null}
                {tab === 'songbooks' ? (
                  <TypedSongbookList
                    groups={songbookResultGroups}
                    limit={PREVIEW_LIMIT}
                    listboxId={typedListboxId}
                    optionIdPrefix={optionPrefix}
                    activeIndex={activeOptionIndex}
                    onHoverOption={setActiveOptionIndex}
                    onPickHref={goSongbook}
                    emptyHint="No songbook matches for this query."
                  />
                ) : null}
                {tab === 'tracks' ? (
                  trackCatalogDiscovery !== null ? (
                    <TypedTrackList
                      tracks={tracksTabFilteredSorted}
                      limit={PREVIEW_LIMIT}
                      listboxId={typedListboxId}
                      optionIdPrefix={optionPrefix}
                      activeIndex={activeOptionIndex}
                      onHoverOption={setActiveOptionIndex}
                      onPick={goTrackCatalogRow}
                      emptyHint="No SoundCloud tracks match this query in titles and track tags (same search as /tracks)."
                    />
                  ) : (
                    <TypedSongList
                      songs={tracksTabSongs}
                      limit={PREVIEW_LIMIT}
                      listboxId={typedListboxId}
                      optionIdPrefix={optionPrefix}
                      activeIndex={activeOptionIndex}
                      onHoverOption={setActiveOptionIndex}
                      onPick={goSong}
                      subtitleKey="sc"
                      topTracksGenreRollup
                      listboxAriaLabel="Matching songs (loading track list)"
                      emptyHint="No matches in song titles, summaries, or catalog track tags (genres, instruments, moods, tempo) for this query."
                    />
                  )
                ) : null}
                {tab === 'videos' ? (
                  <TypedYoutubeSongGroupList
                    groups={typedVideoGroups}
                    listboxId={typedListboxId}
                    optionIdPrefix={optionPrefix}
                    activeIndex={activeOptionIndex}
                    onHoverOption={setActiveOptionIndex}
                    onPick={goYoutubeSongGroup}
                    emptyHint={
                      hasQuery
                        ? 'No YouTube rows match this query (titles, linked lyrics, sutras, playlists).'
                        : 'Type a search query to match the reconciled YouTube catalog.'
                    }
                  />
                ) : null}
              </div>

              <div className="discovery-search__typed-foot">
                <Link
                  className="discovery-search__browse-all"
                  to={seeAllInTab.href}
                  onClick={() => setOpen(false)}
                >
                  <span className="discovery-search__browse-all-label">{seeAllInTab.label}</span>
                  {seeAllInTab.count != null ? (
                    <span className="discovery-search__browse-all-count">{seeAllInTab.count}</span>
                  ) : null}
                  <span className="discovery-search__browse-all-chev" aria-hidden>
                    →
                  </span>
                </Link>
                <p className="discovery-search__typed-meta discovery-search__typed-foot-meta" aria-live="polite">
                  {tab === 'tracks' ? (
                    <>
                      Top Tracks uses the same SoundCloud track search as the Tracks page (titles, sutra, genres,
                      instruments, moods, tempo — not lyric summaries). Other tabs use meaning-first search. Use tabs to
                      jump between songbooks, songs, tracks, and videos.
                    </>
                  ) : (
                    <>
                      Search by meaning first: titles, summaries, lyrics extracts, and lyric text. Use tabs to jump
                      between songbooks, songs, tracks, and videos.
                    </>
                  )}
                </p>
              </div>
            </div>
          )}
        </div>
      ) : null}
      </div>
    </div>
  )
}

function TypedYoutubeSongGroupList({
  groups,
  listboxId,
  optionIdPrefix,
  activeIndex,
  onHoverOption,
  onPick,
  emptyHint,
}: {
  groups: YoutubeDiscoverySongGroup[]
  listboxId: string
  optionIdPrefix: string
  activeIndex: number
  onHoverOption: (i: number) => void
  onPick: (group: YoutubeDiscoverySongGroup) => void
  emptyHint: string
}) {
  if (!groups.length) {
    return (
      <ul
        id={listboxId}
        className="discovery-search__results discovery-search__results--empty"
        role="listbox"
        aria-label="Matching YouTube videos"
      >
        <li className="discovery-search__result-row discovery-search__result-row--empty" role="presentation">
          <span className="discovery-search__empty">{emptyHint}</span>
        </li>
      </ul>
    )
  }
  return (
    <ul id={listboxId} className="discovery-search__results" role="listbox" aria-label="Matching YouTube videos by song">
      {groups.map((g, i) => (
        <li
          key={g.lyrics_id}
          id={`${optionIdPrefix}-${i}`}
          role="option"
          tabIndex={-1}
          aria-selected={activeIndex === i}
          aria-label={`${(g.lyrics_title || 'Song').trim()}, ${g.videos.length} YouTube video${g.videos.length === 1 ? '' : 's'}`}
          className={`discovery-search__result-row discovery-search__result-row--yt-group${
            activeIndex === i ? ' discovery-search__result-row--active' : ''
          }`}
          onMouseEnter={() => onHoverOption(i)}
          onClick={() => onPick(g)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              onPick(g)
            }
          }}
        >
          <div className="discovery-search__result-main discovery-search__result-main--yt-group">
            <div className="discovery-search__yt-group-media" aria-hidden>
              {g.videos.map((v) =>
                v.thumbnail_url ? (
                  <span key={v.video_id} className="discovery-search__yt-thumb-wrap">
                    <img className="discovery-search__yt-thumb" src={v.thumbnail_url} alt="" width={80} height={45} loading="lazy" />
                  </span>
                ) : (
                  <span key={v.video_id} className="discovery-search__yt-thumb-wrap discovery-search__yt-thumb-wrap--fallback">
                    ▶
                  </span>
                ),
              )}
            </div>
            <span className="discovery-search__result-copy">
              <span className="discovery-search__result-title song-title">{(g.lyrics_title || '').trim() || 'Song'}</span>
              <span className="discovery-search__result-sub discovery-search__result-sub--muted">
                {summarizeYoutubeTitles(g.videos)}
              </span>
              {[g.sutra, g.genreLine].filter(Boolean).length ? (
                <span className="discovery-search__result-meta discovery-search__result-meta--yt-group">
                  {[g.sutra, g.genreLine].filter(Boolean).join(' · ')}
                </span>
              ) : null}
            </span>
          </div>
        </li>
      ))}
    </ul>
  )
}

function genreLineDiscoveryTrack(t: TrackCatalogItem): string {
  const parts = [t.primary_genre, ...(t.secondary_genres ?? [])].map((s) => s.trim()).filter(Boolean)
  return [...new Set(parts)].slice(0, 6).join(' · ')
}

/** Top Tracks tab — rows from `track_catalog.json`, aligned with `/tracks?q=` find + sort. */
function TypedTrackList({
  tracks,
  limit,
  listboxId,
  optionIdPrefix,
  activeIndex,
  onHoverOption,
  onPick,
  emptyHint,
}: {
  tracks: TrackCatalogItem[]
  limit: number
  listboxId: string
  optionIdPrefix: string
  activeIndex: number
  onHoverOption: (i: number) => void
  onPick: (t: TrackCatalogItem) => void
  emptyHint: string
}) {
  const slice = tracks.slice(0, limit)
  if (!slice.length) {
    return (
      <ul
        id={listboxId}
        className="discovery-search__results discovery-search__results--empty"
        role="listbox"
        aria-label="Matching SoundCloud tracks"
      >
        <li className="discovery-search__result-row discovery-search__result-row--empty" role="presentation">
          <span className="discovery-search__empty">{emptyHint}</span>
        </li>
      </ul>
    )
  }
  return (
    <ul id={listboxId} className="discovery-search__results" role="listbox" aria-label="Matching SoundCloud tracks">
      {slice.map((t, i) => {
        const cover = thumbnailSrc((t.list_cover_url || t.artwork_url || '').trim())
        const sub = genreLineDiscoveryTrack(t) || (t.soundcloud_genre || '').trim() || 'SoundCloud'
        return (
          <li
            key={t.track_id}
            id={`${optionIdPrefix}-${i}`}
            role="option"
            tabIndex={-1}
            aria-selected={activeIndex === i}
            aria-label={(t.track_title || '').trim() || 'Track'}
            className={`discovery-search__result-row${activeIndex === i ? ' discovery-search__result-row--active' : ''}`}
            onMouseEnter={() => onHoverOption(i)}
            onClick={() => onPick(t)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onPick(t)
              }
            }}
          >
            <div className="discovery-search__result-main">
              {cover ? (
                <img className="discovery-search__result-thumb" src={cover} alt="" width={42} height={42} loading="lazy" />
              ) : (
                <span className="discovery-search__result-thumb discovery-search__result-thumb--fallback" aria-hidden>
                  🍌
                </span>
              )}
              <span className="discovery-search__result-copy">
                <span className="discovery-search__result-title song-title">{(t.track_title || '').trim()}</span>
                <span className="discovery-search__result-sub discovery-search__result-sub--muted">{sub}</span>
              </span>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

function TypedSongList({
  songs,
  limit,
  listboxId,
  optionIdPrefix,
  activeIndex,
  onHoverOption,
  onPick,
  subtitleKey,
  emphasizeSongbook,
  topTracksGenreRollup,
  listboxAriaLabel = 'Matching songs',
  emptyHint,
}: {
  songs: SongCatalogItem[]
  limit: number
  listboxId: string
  optionIdPrefix: string
  activeIndex: number
  onHoverOption: (i: number) => void
  onPick: (song: SongCatalogItem) => void
  subtitleKey?: 'songbook' | 'sc'
  /** Primary line = songbook, second line = song title (songbook hubs at `/songbooks/:slug`). */
  emphasizeSongbook?: boolean
  /** Top Tracks tab: show EP-wide `track_genres` / `track_secondary_genres` instead of headline-only line. */
  topTracksGenreRollup?: boolean
  listboxAriaLabel?: string
  emptyHint: string
}) {
  const slice = songs.slice(0, limit)
  if (!slice.length) {
    return (
      <ul
        id={listboxId}
        className="discovery-search__results discovery-search__results--empty"
        role="listbox"
        aria-label={listboxAriaLabel}
      >
        <li className="discovery-search__result-row discovery-search__result-row--empty" role="presentation">
          <span className="discovery-search__empty">{emptyHint}</span>
        </li>
      </ul>
    )
  }
  return (
    <ul id={listboxId} className="discovery-search__results" role="listbox" aria-label={listboxAriaLabel}>
      {slice.map((song, i) => (
        <li
          key={song.lyrics_id}
          id={`${optionIdPrefix}-${i}`}
          role="option"
          tabIndex={-1}
          aria-selected={activeIndex === i}
          className={`discovery-search__result-row${activeIndex === i ? ' discovery-search__result-row--active' : ''}`}
          onMouseEnter={() => onHoverOption(i)}
          onClick={() => onPick(song)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              onPick(song)
            }
          }}
        >
          <div className="discovery-search__result-main">
            {thumbnailSrc(song.cover_image_url) ? (
              <img
                className="discovery-search__result-thumb"
                src={thumbnailSrc(song.cover_image_url)}
                alt=""
                width={42}
                height={42}
                loading="lazy"
              />
            ) : isLyricsOnlySong(song) ? (
              <span
                className="discovery-search__result-thumb discovery-search__result-thumb--lyrics-only"
                aria-hidden
              >
                ♪
              </span>
            ) : (
              <span className="discovery-search__result-thumb discovery-search__result-thumb--fallback" aria-hidden>
                🍌
              </span>
            )}
            <span className="discovery-search__result-copy">
              {emphasizeSongbook ? (
                <>
                  <span className="discovery-search__result-title discovery-search__result-title--songbook">
                    {(song.songbook ?? '').trim() || 'Songbook not set'}
                  </span>
                  <span className="discovery-search__result-sub discovery-search__result-sub--song-title song-title">
                    {song.lyrics_title}
                  </span>
                  {song.summary_short ? (
                    <span className="discovery-search__result-sub discovery-search__result-sub--muted">
                      {song.summary_short}
                    </span>
                  ) : null}
                </>
              ) : (
                <>
                  <span className="discovery-search__result-title song-title">{song.lyrics_title}</span>
                  {subtitleKey === 'songbook' && song.songbook ? (
                    <span className="discovery-search__result-sub">{song.songbook}</span>
                  ) : null}
                  {subtitleKey === 'sc' ? (
                    <span className="discovery-search__result-sub discovery-search__result-sub--muted">
                      {topTracksGenreRollup ? topTracksRowGenreLabel(song) : (song.discovery_top_track_genres ?? '').trim() || 'SoundCloud'}
                    </span>
                  ) : null}
                  {!subtitleKey && song.summary_short ? (
                    <span className="discovery-search__result-sub">{song.summary_short}</span>
                  ) : null}
                  {!subtitleKey ? (
                    <span className="discovery-search__result-meta">
                      {[song.sutra, song.topic, song.intention].filter(Boolean).join(' · ')}
                    </span>
                  ) : null}
                </>
              )}
            </span>
          </div>
        </li>
      ))}
    </ul>
  )
}

function TypedSongbookList({
  groups,
  limit,
  listboxId,
  optionIdPrefix,
  activeIndex,
  onHoverOption,
  onPickHref,
  emptyHint,
}: {
  groups: SongbookResultGroup[]
  limit: number
  listboxId: string
  optionIdPrefix: string
  activeIndex: number
  onHoverOption: (i: number) => void
  onPickHref: (href: string) => void
  emptyHint: string
}) {
  const slice = groups.slice(0, limit)
  if (!slice.length) {
    return (
      <ul id={listboxId} className="discovery-search__results discovery-search__results--empty" role="listbox" aria-label="Matching songbooks">
        <li className="discovery-search__result-row discovery-search__result-row--empty" role="presentation">
          <span className="discovery-search__empty">{emptyHint}</span>
        </li>
      </ul>
    )
  }
  return (
    <ul id={listboxId} className="discovery-search__results" role="listbox" aria-label="Matching songbooks">
      {slice.map((group, i) => (
        <li
          key={group.songbook}
          id={`${optionIdPrefix}-${i}`}
          role="option"
          tabIndex={-1}
          aria-selected={activeIndex === i}
          className={`discovery-search__result-row${activeIndex === i ? ' discovery-search__result-row--active' : ''}`}
          onMouseEnter={() => onHoverOption(i)}
          onClick={() => onPickHref(group.href)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              onPickHref(group.href)
            }
          }}
        >
          <div className="discovery-search__result-main">
            {thumbnailSrc(group.artworkUrl) ? (
              <img
                className="discovery-search__result-thumb"
                src={thumbnailSrc(group.artworkUrl)}
                alt=""
                width={42}
                height={42}
                loading="lazy"
              />
            ) : (
              <span className="discovery-search__result-thumb discovery-search__result-thumb--fallback" aria-hidden>
                🍌
              </span>
            )}
            <span className="discovery-search__result-copy">
              <span className="discovery-search__result-title discovery-search__result-title--songbook">{group.songbook}</span>
              <span className="discovery-search__result-sub">
                {group.matchCount} match{group.matchCount === 1 ? '' : 'es'} · {group.totalSongs} songs total
              </span>
              <span className="discovery-search__result-sub discovery-search__result-sub--muted">{group.sampleTitles.join(' · ')}</span>
            </span>
          </div>
        </li>
      ))}
    </ul>
  )
}
