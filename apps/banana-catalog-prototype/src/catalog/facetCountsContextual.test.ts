import assert from 'node:assert/strict'
import test from 'node:test'
import { facetCountsFromSongs } from './facetCountsFromSongs'
import { facetCountsFromTracks } from './facetCountsFromTracks'
import { buildContextualSongFacetEntries, buildContextualTrackFacetEntries } from './facetCountsContextual'
import { CATALOG_BROWSER_FACET_ORDER, TRACKS_BROWSER_FACET_ORDER } from './catalogFacetConfig'
import type { SongCatalogItem, TrackCatalogItem } from './types'
import { emptyFilterState, emptyTracksFilterState } from './types'

function makeSong(overrides: Partial<SongCatalogItem> = {}): SongCatalogItem {
  return {
    lyrics_id: 'L-1',
    lyrics_title: 'Song',
    url_slug: 'song',
    summary_short: '',
    lyrics_extract: '',
    sutra: 'KNOWsutra',
    topic: 'TRUTH',
    intention: 'askWHY',
    light_shadow: 'LIGHT',
    cover: false,
    public_domain: false,
    lang: 'EN',
    written_year: '2026',
    song_in_app: true,
    fav: false,
    published_at: '2026-01-01T00:00:00Z',
    cover_image_url: '',
    track_genres: ['BLUES'],
    track_secondary_genres: [],
    track_instruments: ['GUITAR'],
    track_moods: ['KINDLY'],
    track_tempo_feels: ['LOWBEAT'],
    discovery_top_track_genres: '',
    soundcloud_genre_tags: [],
    track_count_total: 1,
    track_count_published: 1,
    track_count_selected: 1,
    aggregate_play_count: 0,
    aggregate_like_count: 0,
    aggregate_engagement_rate: 0,
    peak_play_count: 0,
    peak_like_count: 0,
    aggregate_duration_sec: 0,
    best_track_ids: [],
    ep_refs: [],
    primary_ep_url: '',
    primary_ep_title: '',
    primary_ep_volume: 0,
    primary_ep_rating: '',
    ep_volumes: [],
    has_fav_track: false,
    songbook: '',
    muse: '',
    song_muse_quote: '',
    lyrics_notes_excerpt: '',
    soundcloud_title_blob: '',
    lyrics_head_search: '',
    has_in_app_playback: true,
    has_sc_catalog_listen: false,
    sc_catalog_listen_url: '',
    sc_catalog_track_title: '',
    sc_catalog_listen_source: '',
    has_youtube_video: false,
    has_youtube_embed: false,
    lyrics_pipeline_status: '',
    ...overrides,
  }
}

function makeTrack(overrides: Partial<TrackCatalogItem> = {}): TrackCatalogItem {
  return {
    track_id: 't-1',
    lyrics_id: 'L-1',
    track_title: 'Track',
    lyrics_title: 'Song',
    sc_url: 'https://soundcloud.com/test/track',
    play_count: 100,
    like_count: 10,
    engagement_rate: 10,
    duration_sec: 180,
    duration_raw: '3:00',
    genres: ['BLUES'],
    primary_genre: 'BLUES',
    secondary_genres: [],
    soundcloud_genre: 'Soundtrack',
    secondary_genre: '',
    instruments: ['GUITAR'],
    ep_title: 'EP',
    ep_url: 'https://soundcloud.com/test/sets/ep',
    ep_track_number: 1,
    ep_total_tracks: 1,
    created_at: '2026-01-01T00:00:00',
    artwork_url: '',
    waveform_url: '',
    bpm: 0,
    track_status: '',
    track_in_app: true,
    fav_track: false,
    mood: 'KINDLY',
    tempo_feel: 'LOWBEAT',
    curation_rating: '5',
    sutra: 'KNOWsutra',
    light_shadow: 'LIGHT',
    url_slug: 'song',
    list_cover_url: '',
    song_published_at: '2026-01-01T00:00:00',
    popularity_score: 0,
    ...overrides,
  }
}

test('contextual song facet counts respect active filters across other groups', () => {
  const songs = [
    makeSong({ lyrics_id: 'L-fr-know', lang: 'FR', sutra: 'KNOWsutra' }),
    makeSong({ lyrics_id: 'L-en-know', lang: 'EN', sutra: 'KNOWsutra' }),
    makeSong({ lyrics_id: 'L-fr-blow', lang: 'FR', sutra: 'BLOWsutra' }),
  ]

  const allCounts = facetCountsFromSongs(songs)
  const fullEntries = Object.fromEntries(
    CATALOG_BROWSER_FACET_ORDER.map((group) => [group, allCounts[group] ?? []]),
  ) as Record<(typeof CATALOG_BROWSER_FACET_ORDER)[number], { value: string; count: number }[]>

  const filters = emptyFilterState()
  filters.lang = new Set(['FR'])

  const contextual = buildContextualSongFacetEntries(
    songs,
    fullEntries,
    CATALOG_BROWSER_FACET_ORDER,
    filters,
    'all',
    '',
  )

  const sutraMap = new Map(contextual.sutra.map((entry) => [entry.value, entry.count] as const))
  assert.equal(sutraMap.get('KNOWsutra'), 1)
  assert.equal(sutraMap.get('BLOWsutra'), 1)

  const langMap = new Map(contextual.lang.map((entry) => [entry.value, entry.count] as const))
  assert.equal(langMap.get('FR'), 2)
  assert.equal(langMap.get('EN'), 1)
})

test('contextual track facet counts preserve zero-count options while applying other groups', () => {
  const tracks = [
    makeTrack({ track_id: 't-frenchy-blues', mood: 'FRENCHY', primary_genre: 'BLUES' }),
    makeTrack({ track_id: 't-frenchy-jazz', mood: 'FRENCHY', primary_genre: 'JAZZ' }),
    makeTrack({ track_id: 't-rainy-rock', mood: 'RAINY', primary_genre: 'ROCK' }),
  ]

  const fullEntries = facetCountsFromTracks(tracks)
  const filters = emptyTracksFilterState()
  filters.mood = new Set(['FRENCHY'])

  const contextual = buildContextualTrackFacetEntries(
    tracks,
    fullEntries,
    TRACKS_BROWSER_FACET_ORDER,
    filters,
    '',
  )

  const primaryGenreMap = new Map(contextual.primary_genre.map((entry) => [entry.value, entry.count] as const))
  assert.equal(primaryGenreMap.get('BLUES'), 1)
  assert.equal(primaryGenreMap.get('JAZZ'), 1)
  assert.equal(primaryGenreMap.get('ROCK'), 0)

  const moodMap = new Map(contextual.mood.map((entry) => [entry.value, entry.count] as const))
  assert.equal(moodMap.get('FRENCHY'), 2)
  assert.equal(moodMap.get('RAINY'), 1)
})
