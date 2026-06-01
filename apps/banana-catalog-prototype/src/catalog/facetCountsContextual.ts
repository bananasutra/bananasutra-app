import { facetCountsFromSongs } from './facetCountsFromSongs'
import { facetCountsFromTracks } from './facetCountsFromTracks'
import { songMatchesFilters, songMatchesMediaCombo } from './filterSongs'
import { filterTracksByFindQuery, trackMatchesFilters } from './filterTracks'
import { filterSongsByFindAnyQuery } from './searchMatch'
import type {
  FacetEntry,
  FilterFacetKey,
  FilterState,
  MediaComboFilter,
  SongCatalogItem,
  TracksFacetFilterKey,
  TracksFilterState,
  TrackCatalogItem,
} from './types'

function clearSongFacetGroup(filters: FilterState, group: FilterFacetKey): FilterState {
  return { ...filters, [group]: new Set<string>() }
}

function clearTrackFacetGroup(filters: TracksFilterState, group: TracksFacetFilterKey): TracksFilterState {
  return { ...filters, [group]: new Set<string>() }
}

export function buildContextualSongFacetEntries(
  songs: SongCatalogItem[],
  fullFacetEntries: Record<FilterFacetKey, FacetEntry[]>,
  groups: readonly FilterFacetKey[],
  filters: FilterState,
  media: MediaComboFilter,
  findQuery: string,
  deepSearchByLyricsId?: Record<string, string>,
): Record<FilterFacetKey, FacetEntry[]> {
  const out = {} as Record<FilterFacetKey, FacetEntry[]>
  for (const group of groups) {
    const baseFilters = clearSongFacetGroup(filters, group)
    let subset = songs.filter((song) => songMatchesFilters(song, baseFilters) && songMatchesMediaCombo(song, media))
    if (findQuery.trim()) subset = filterSongsByFindAnyQuery(subset, findQuery, deepSearchByLyricsId)
    const contextualEntries = facetCountsFromSongs(subset)[group] ?? []
    const contextualCountMap = new Map(contextualEntries.map((entry) => [entry.value, entry.count] as const))
    out[group] = (fullFacetEntries[group] ?? []).map(({ value }) => ({ value, count: contextualCountMap.get(value) ?? 0 }))
  }
  return out
}

export function buildContextualTrackFacetEntries(
  tracks: TrackCatalogItem[],
  fullFacetEntries: Record<TracksFacetFilterKey, FacetEntry[]>,
  groups: readonly TracksFacetFilterKey[],
  filters: TracksFilterState,
  findQuery: string,
): Record<TracksFacetFilterKey, FacetEntry[]> {
  const out = {} as Record<TracksFacetFilterKey, FacetEntry[]>
  for (const group of groups) {
    const baseFilters = clearTrackFacetGroup(filters, group)
    let subset = tracks.filter((track) => trackMatchesFilters(track, baseFilters))
    subset = filterTracksByFindQuery(subset, findQuery)
    const contextualEntries = facetCountsFromTracks(subset)[group] ?? []
    const contextualCountMap = new Map(contextualEntries.map((entry) => [entry.value, entry.count] as const))
    out[group] = (fullFacetEntries[group] ?? []).map(({ value }) => ({ value, count: contextualCountMap.get(value) ?? 0 }))
  }
  return out
}
