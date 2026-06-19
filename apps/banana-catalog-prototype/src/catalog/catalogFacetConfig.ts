import type { FacetGroupKey, FilterFacetKey, TracksFacetFilterKey } from './types'

/** `/songs` filter panel — song-level facets (track-level filters live on `/tracks`). */
export const CATALOG_BROWSER_FACET_ORDER: FilterFacetKey[] = [
  'sutra',
  'light_shadow',
  'topic',
  'intention',
  'written_year',
  'lang',
]

/** `/tracks` filter panel order (URL: `primary_genre`, `secondary_genre`, …). */
export const TRACKS_BROWSER_FACET_ORDER: TracksFacetFilterKey[] = [
  'sutra',
  'light_shadow',
  'primary_genre',
  'tempo_feel',
  'mood',
  'secondary_genre',
  'instrument',
]

export const TRACKS_FACET_LABELS: Record<TracksFacetFilterKey, string> = {
  sutra: 'Sutra',
  light_shadow: 'Light / Shadow',
  primary_genre: 'Primary Genre',
  secondary_genre: 'Secondary Genres',
  mood: 'Mood',
  instrument: 'Instruments',
  tempo_feel: 'Tempo / Feel',
}

/** Header empty browse — song-level facets (IA §3.10). */
export const HEADER_BROWSE_SONG_FACETS: FilterFacetKey[] = ['sutra', 'topic', 'lang']

/** Header empty browse — track-level facets (IA §3.10); chips deep-link to `/tracks`. */
export const HEADER_BROWSE_TRACK_FACETS = ['track_genre', 'track_tempo_feel', 'track_mood'] as const

/** Search panel browse accordion — shorter labels than full catalog browser. */
export const HEADER_DISCOVERY_FACET_LABELS: Partial<Record<FacetGroupKey, string>> = {
  track_genre: 'Genre',
  track_tempo_feel: 'Tempo',
}

export type HeaderBrowseTrackFacetKey = (typeof HEADER_BROWSE_TRACK_FACETS)[number]

export const DISCOVERY_FACET_LABELS: Record<FacetGroupKey, string> = {
  sutra: 'Sutra',
  light_shadow: 'Light / Shadow',
  topic: 'Topic',
  intention: 'Intention',
  written_year: 'Written (year)',
  track_genre: 'Primary genre',
  track_secondary_genre: 'Secondary genre',
  track_instrument: 'Instrument (track)',
  track_mood: 'Mood',
  track_tempo_feel: 'Tempo / feel (track)',
  lang: 'Language',
}

export const DISCOVERY_FACET_HELP: Partial<Record<FacetGroupKey, string>> = {
  written_year:
    'Airtable year_created — when lyrics were written. Separate from browse “Newest”, which uses the catalog publish date (includes lyrics-only rows).',
}
