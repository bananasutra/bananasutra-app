import type {
  FilterFacetKey,
  FilterState,
  MediaComboFilter,
  SortMode,
  TrackSortMode,
  TracksFacetFilterKey,
  TracksFilterState,
} from './types'
import { emptyFilterState, emptyTracksFilterState } from './types'
import { browsePathWithQuery, canonicalPathForRoute } from './seoPaths'
import { searchParamsFromSearchString } from './urlSearchParams'

/** Path for the filterable song grid (browse). */
export const CATALOG_BROWSE_PATH = canonicalPathForRoute('/songs')

const PARAM: Record<FilterFacetKey, string> = {
  sutra: 'sutra',
  topic: 'topic',
  intention: 'intention',
  light_shadow: 'ls',
  written_year: 'wy',
  track_genre: 'tg',
  track_secondary_genre: 'tsg',
  track_instrument: 'ti',
  lang: 'lang',
}

export function parseCommaSet(value: string | null): Set<string> {
  const s = new Set<string>()
  if (!value) return s
  for (const part of value.split(',')) {
    const t = part.trim()
    if (t) s.add(t)
  }
  return s
}

export function serializeCommaSet(set: Set<string>): string {
  return [...set].sort().join(',')
}

export function parseSort(raw: string | null): SortMode {
  const v = (raw ?? '').trim().toLowerCase()
  if (v === 'plays-peak') return 'plays_peak'
  if (v === 'likes-peak') return 'likes_peak'
  if (v === 'plays' || v === 'plays-total') return 'plays_total'
  if (v === 'likes' || v === 'likes-total') return 'likes_total'
  if (v === 'engagement' || v === 'engagement-rate') return 'engagement_total'
  if (v === 'title' || v === 'title-az' || v === 'alpha') return 'title_az'
  return 'newest'
}

function serializeSort(mode: SortMode): string | null {
  if (mode === 'newest') return null
  if (mode === 'title_az') return 'title'
  if (mode === 'plays_total') return 'plays'
  if (mode === 'plays_peak') return 'plays-peak'
  if (mode === 'likes_total') return 'likes'
  if (mode === 'likes_peak') return 'likes-peak'
  if (mode === 'engagement_total') return 'engagement'
  return null
}

const PARAM_FIND = 'find'

const PARAM_MEDIA = 'media'

const PARAM_BROWSE_PAGE = 'page'

const MEDIA_VALUES: ReadonlySet<MediaComboFilter> = new Set(['all', 'lyrics_sc', 'lyrics_yt', 'full'])

export function parseMediaCombo(raw: string | null): MediaComboFilter {
  const trimmed = (raw ?? '').trim().toLowerCase()
  /** Lyrics-first browse moved to `/words`; legacy `media=any` still resolves here. */
  if (trimmed === 'lyrics_only' || trimmed === 'lyrics_only_no_cover' || trimmed === 'any') return 'all'
  const v = trimmed as MediaComboFilter
  if (MEDIA_VALUES.has(v) && v !== 'all') return v
  return 'all'
}

export function readBrowseStateFromSearchParams(params: URLSearchParams): {
  sort: SortMode
  filters: FilterState
  media: MediaComboFilter
  page: number
} {
  const sort = parseSort(params.get('sort'))
  const filters = emptyFilterState()
  ;(Object.keys(PARAM) as FilterFacetKey[]).forEach((key) => {
    const raw = params.get(PARAM[key])
    filters[key] = parseCommaSet(raw)
  })
  const media = parseMediaCombo(params.get(PARAM_MEDIA))
  const page = Math.max(1, parseInt(params.get(PARAM_BROWSE_PAGE) || '1', 10) || 1)
  return { sort, filters, media, page }
}

export function readStateFromUrl(): {
  sort: SortMode
  filters: FilterState
  media: MediaComboFilter
  page: number
} {
  return readBrowseStateFromSearchParams(searchParamsFromSearchString(window.location.search))
}

/** Query string for browse URL (no leading `?`). */
export function serializeBrowseQuery(
  sort: SortMode,
  filters: FilterState,
  find?: string,
  media: MediaComboFilter = 'all',
  page: number = 1,
): string {
  const params = new URLSearchParams()
  const sortParam = serializeSort(sort)
  if (sortParam) params.set('sort', sortParam)
  ;(Object.keys(PARAM) as FilterFacetKey[]).forEach((key) => {
    const set = filters[key]
    if (set.size) params.set(PARAM[key], serializeCommaSet(set))
  })
  const f = find?.trim()
  if (f) params.set(PARAM_FIND, f)
  if (media && media !== 'all') params.set(PARAM_MEDIA, media)
  if (page > 1) params.set(PARAM_BROWSE_PAGE, String(page))
  return params.toString()
}

/** Absolute path for browse including query, e.g. `/songs?sutra=BLOWsutra`. */
export function buildBrowsePath(
  sort: SortMode,
  filters: FilterState,
  find?: string,
  media: MediaComboFilter = 'all',
  page: number = 1,
): string {
  const qs = serializeBrowseQuery(sort, filters, find, media, page)
  return qs ? `${CATALOG_BROWSE_PATH}?${qs}` : CATALOG_BROWSE_PATH
}

/** Pre-filter browse to a single facet value (replace mode). */
export function buildBrowsePathForFacet(key: FilterFacetKey, value: string): string {
  const filters = emptyFilterState()
  filters[key] = new Set([value])
  return buildBrowsePath('newest', filters, undefined, 'all')
}

const TRACKS_FACET_PARAMS: Record<TracksFacetFilterKey, string> = {
  primary_genre: 'primary_genre',
  secondary_genre: 'secondary_genre',
  mood: 'mood',
  instrument: 'instrument',
  tempo_feel: 'tempo_feel',
}

const PARAM_TRACKS_FIND = 'q'
const PARAM_TRACKS_PAGE = 'page'
const PARAM_TRACKS_SORT = 'tsort'

function parseTrackSort(raw: string | null): TrackSortMode {
  const v = (raw ?? '').trim().toLowerCase()
  if (v === 'plays' || v === 'play') return 'plays'
  if (v === 'likes' || v === 'like') return 'likes'
  if (v === 'newest' || v === 'new') return 'newest'
  if (v === 'engagement' || v === 'engagement-rate') return 'engagement'
  if (v === 'title' || v === 'title-az' || v === 'alpha') return 'title_az'
  /** Legacy `popularity` / `score` matched build rank — approximate with play count sort. */
  if (v === 'popularity' || v === 'score') return 'plays'
  return 'likes'
}

function serializeTrackSort(mode: TrackSortMode): string {
  if (mode === 'newest') return 'newest'
  if (mode === 'plays') return 'plays'
  if (mode === 'engagement') return 'engagement'
  if (mode === 'title_az') return 'title'
  return 'likes'
}

/** Header browse → `/tracks` (single facet; multi-facet uses `buildTracksBrowsePathFull`). */
export function buildTracksBrowsePath(
  param: 'primary_genre' | 'secondary_genre' | 'mood' | 'instrument' | 'tempo_feel',
  value: string,
): string {
  const q = new URLSearchParams()
  q.set(param, value)
  return browsePathWithQuery('/tracks', q.toString())
}

export function readTracksBrowseFromSearch(search: string): {
  filters: TracksFilterState
  find: string
  page: number
  sort: TrackSortMode
} {
  const params = searchParamsFromSearchString(search)
  const filters = emptyTracksFilterState()
  ;(Object.keys(TRACKS_FACET_PARAMS) as TracksFacetFilterKey[]).forEach((key) => {
    filters[key] = parseCommaSet(params.get(TRACKS_FACET_PARAMS[key]))
  })
  const find = params.get(PARAM_TRACKS_FIND)?.trim() ?? ''
  const page = Math.max(1, parseInt(params.get(PARAM_TRACKS_PAGE) || '1', 10) || 1)
  const sort = parseTrackSort(params.get(PARAM_TRACKS_SORT))
  return { filters, find, page, sort }
}

/** Query string for `/tracks` (no leading `?`). Preserves unrelated params except replaced keys. */
export function serializeTracksBrowseQuery(
  filters: TracksFilterState,
  find: string,
  page: number,
  preserveParams?: URLSearchParams,
  sort: TrackSortMode = 'likes',
): string {
  const params = new URLSearchParams(preserveParams?.toString() ?? '')
  for (const key of Object.keys(TRACKS_FACET_PARAMS) as TracksFacetFilterKey[]) {
    params.delete(TRACKS_FACET_PARAMS[key])
  }
  params.delete(PARAM_TRACKS_FIND)
  params.delete(PARAM_TRACKS_PAGE)
  params.delete(PARAM_TRACKS_SORT)
  ;(Object.keys(TRACKS_FACET_PARAMS) as TracksFacetFilterKey[]).forEach((key) => {
    const set = filters[key]
    if (set.size) params.set(TRACKS_FACET_PARAMS[key], serializeCommaSet(set))
  })
  const f = find.trim()
  if (f) params.set(PARAM_TRACKS_FIND, f)
  if (page > 1) params.set(PARAM_TRACKS_PAGE, String(page))
  params.set(PARAM_TRACKS_SORT, serializeTrackSort(sort))
  return params.toString()
}

export function buildTracksBrowsePathFull(
  filters: TracksFilterState,
  find?: string,
  page?: number,
  preserveParams?: URLSearchParams,
  sort: TrackSortMode = 'likes',
): string {
  const qs = serializeTracksBrowseQuery(filters, find ?? '', page ?? 1, preserveParams, sort)
  return browsePathWithQuery('/tracks', qs)
}

const BROWSE_PARAM_KEYS = new Set<string>(['sort', ...Object.values(PARAM), PARAM_MEDIA, PARAM_BROWSE_PAGE])

/** True when `search` contains any catalog browse facet/sort param (legacy `/?…` redirects). */
export function searchHasBrowseParams(search: string): boolean {
  const params = searchParamsFromSearchString(search)
  for (const k of BROWSE_PARAM_KEYS) {
    if (params.has(k)) return true
  }
  return false
}

export function readFindFromSearchParams(params: URLSearchParams): string {
  return params.get(PARAM_FIND)?.trim() ?? ''
}

export function readFindFromUrl(): string {
  return readFindFromSearchParams(searchParamsFromSearchString(window.location.search))
}

/** Parse `page` from `/songs?…` (or any URL using the same param name). */
export function readCatalogBrowsePage(search: string): number {
  const params = searchParamsFromSearchString(search)
  return Math.max(1, parseInt(params.get(PARAM_BROWSE_PAGE) || '1', 10) || 1)
}

/**
 * Persist sort + facet filters + optional text `find` (discovery “see all” broad match).
 * Pass `find: ''` to clear; omit `find` to keep the current URL’s `find` value.
 */
export function writeStateToUrl(sort: SortMode, filters: FilterState, find?: string, media: MediaComboFilter = 'all'): void {
  const prev = searchParamsFromSearchString(window.location.search)
  const nextFind = find !== undefined ? find.trim() : (prev.get(PARAM_FIND) ?? '').trim()
  const page = Math.max(1, parseInt(prev.get(PARAM_BROWSE_PAGE) || '1', 10) || 1)
  const path = buildBrowsePath(sort, filters, nextFind || undefined, media, page)
  window.history.replaceState(null, '', path)
}
