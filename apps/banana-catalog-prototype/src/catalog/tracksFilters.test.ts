import assert from 'node:assert/strict'
import test from 'node:test'
import { facetCountsFromTracks } from './facetCountsFromTracks'
import { trackMatchesFilters } from './filterTracks'
import type { TrackCatalogItem } from './types'
import { emptyTracksFilterState } from './types'
import { readTracksBrowseFromSearch, serializeTracksBrowseQuery } from './urlState'

function makeTrack(overrides: Partial<TrackCatalogItem> = {}): TrackCatalogItem {
  return {
    track_id: 't-1',
    lyrics_id: 'L-1',
    track_title: 'Test Track',
    lyrics_title: 'Test Song',
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
    url_slug: 'test-song',
    list_cover_url: '',
    song_published_at: '2026-01-01T00:00:00',
    popularity_score: 0,
    ...overrides,
  }
}

test('trackMatchesFilters applies light_shadow filter', () => {
  const filters = emptyTracksFilterState()
  filters.light_shadow = new Set(['SHADOW'])
  assert.equal(trackMatchesFilters(makeTrack({ light_shadow: 'LIGHT' }), filters), false)
  assert.equal(trackMatchesFilters(makeTrack({ light_shadow: 'SHADOW' }), filters), true)
})

test('facetCountsFromTracks includes light_shadow buckets', () => {
  const rows = [
    makeTrack({ track_id: 't-1', light_shadow: 'LIGHT' }),
    makeTrack({ track_id: 't-2', light_shadow: 'SHADOW' }),
    makeTrack({ track_id: 't-3', light_shadow: 'SHADOW' }),
  ]
  const counts = facetCountsFromTracks(rows)
  const byValue = new Map(counts.light_shadow.map((entry) => [entry.value, entry.count] as const))
  assert.equal(byValue.get('LIGHT'), 1)
  assert.equal(byValue.get('SHADOW'), 2)
})

test('tracks URL state round-trips light_shadow', () => {
  const filters = emptyTracksFilterState()
  filters.light_shadow = new Set(['SHADOW'])
  const qs = serializeTracksBrowseQuery(filters, '', 1, undefined, 'likes')
  const parsed = readTracksBrowseFromSearch(`?${qs}`)
  assert.deepEqual([...parsed.filters.light_shadow], ['SHADOW'])
})
