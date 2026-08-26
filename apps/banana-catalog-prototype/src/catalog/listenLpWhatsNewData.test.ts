import assert from 'node:assert/strict'
import test from 'node:test'
import { buildListenLpWhatsNewPicks } from './listenLpWhatsNewData'
import type { SongCatalogItem, TrackCatalogItem } from './types'

const OLD_EP = 'https://soundcloud.com/bananasutra/sets/hold-the-mic-babe-soul'
const NEW_EP = 'https://soundcloud.com/bananasutra/sets/hold-the-mic-babe-growsutra-epx11-vol02'
const ALL_TIME_TOP_ID = '1955989799'
const LATEST_VOLUME_TOP_ID = '2387678208'

function makeSong(overrides: Partial<SongCatalogItem> = {}): SongCatalogItem {
  return {
    lyrics_id: 'L-102',
    lyrics_title: 'Hold The Mic, Babe',
    url_slug: 'hold-the-mic-babe',
    summary_short: '',
    lyrics_extract: '',
    sutra: 'GROWsutra',
    topic: 'INJUSTICE',
    intention: 'beBRAVE',
    light_shadow: 'LIGHT',
    cover: false,
    public_domain: false,
    lang: 'EN',
    written_year: '2024',
    song_in_app: true,
    fav: true,
    published_at: '2026-08-24T23:12:00',
    cover_image_url: 'https://example.com/cover.jpg',
    track_genres: ['FOLK'],
    track_secondary_genres: [],
    track_instruments: [],
    track_moods: [],
    track_tempo_feels: [],
    discovery_top_track_genres: 'FOLK',
    soundcloud_genre_tags: [],
    track_count_total: 6,
    track_count_published: 6,
    track_count_selected: 4,
    aggregate_play_count: 0,
    aggregate_like_count: 0,
    aggregate_engagement_rate: 0,
    peak_play_count: 0,
    peak_like_count: 0,
    aggregate_duration_sec: 0,
    best_track_ids: [ALL_TIME_TOP_ID, LATEST_VOLUME_TOP_ID],
    ep_refs: [NEW_EP, OLD_EP],
    primary_ep_url: NEW_EP,
    primary_ep_title: 'GROWsutra EPx11 Vol. 02',
    primary_ep_volume: 2,
    primary_ep_rating: '',
    ep_volumes: [
      { ep_volume: 1, ep_url: 'https://soundcloud.com/bananasutra/hold-the-mic-babe-o-minimal', ep_title: 'vol 1', ep_rating: '' },
      { ep_volume: 2, ep_url: OLD_EP, ep_title: 'vol 2 soul', ep_rating: '' },
      { ep_volume: 3, ep_url: NEW_EP, ep_title: 'vol 3 latest', ep_rating: '' },
    ],
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
    lyrics_pipeline_status: 'PUBLISHED',
    ...overrides,
  }
}

function makeTrack(overrides: Partial<TrackCatalogItem> = {}): TrackCatalogItem {
  return {
    track_id: 't-1',
    lyrics_id: 'L-102',
    track_title: 'Track',
    lyrics_title: 'Hold The Mic, Babe',
    sc_url: 'https://soundcloud.com/bananasutra/track',
    play_count: 100,
    like_count: 1,
    engagement_rate: 1,
    duration_sec: 120,
    duration_raw: '2:00',
    genres: ['FOLK'],
    primary_genre: 'FOLK',
    secondary_genres: [],
    soundcloud_genre: 'Soundtrack',
    secondary_genre: '',
    instruments: [],
    ep_title: 'EP',
    ep_url: NEW_EP,
    ep_track_number: 1,
    ep_total_tracks: 11,
    created_at: '2026-08-24T23:12:00',
    artwork_url: '',
    waveform_url: '',
    bpm: 0,
    track_status: '',
    track_in_app: true,
    fav_track: false,
    mood: 'KINDLY',
    tempo_feel: 'LOWBEAT',
    curation_rating: '',
    sutra: 'GROWsutra',
    light_shadow: 'LIGHT',
    url_slug: 'hold-the-mic-babe',
    list_cover_url: '',
    song_published_at: '2026-08-24T23:12:00',
    popularity_score: 0,
    ...overrides,
  }
}

function hrefSearch(href: ListenSongHref): string {
  if (typeof href === 'string') return ''
  return href.search ?? ''
}

type ListenSongHref = ReturnType<typeof buildListenLpWhatsNewPicks>[number]['songHref']

test('Whats New samples the latest volume top track, not all-time plays', () => {
  const song = makeSong()
  const tracks = [
    makeTrack({
      track_id: ALL_TIME_TOP_ID,
      sc_url: 'https://soundcloud.com/bananasutra/2-hold-the-mic-babe',
      play_count: 1614,
      like_count: 16,
      ep_url: OLD_EP,
    }),
    makeTrack({
      track_id: '2387678181',
      sc_url: 'https://soundcloud.com/bananasutra/01-hold-the-mic-babe',
      play_count: 195,
      like_count: 5,
      ep_url: NEW_EP,
    }),
    makeTrack({
      track_id: LATEST_VOLUME_TOP_ID,
      sc_url: 'https://soundcloud.com/bananasutra/06-hold-the-mic-babe',
      play_count: 163,
      like_count: 6,
      ep_url: NEW_EP,
    }),
  ]

  const [pick] = buildListenLpWhatsNewPicks([song], tracks)
  assert.equal(pick?.catalogTrack?.track_id, LATEST_VOLUME_TOP_ID)
  assert.match(hrefSearch(pick!.songHref), /section=audio/)
  assert.match(hrefSearch(pick!.songHref), /t=2387678208/)
})

test('Whats New falls back to all-time top when the latest volume has no in-app tracks', () => {
  const song = makeSong()
  const tracks = [
    makeTrack({
      track_id: ALL_TIME_TOP_ID,
      sc_url: 'https://soundcloud.com/bananasutra/2-hold-the-mic-babe',
      play_count: 1614,
      like_count: 16,
      ep_url: OLD_EP,
    }),
  ]

  const [pick] = buildListenLpWhatsNewPicks([song], tracks)
  assert.equal(pick?.catalogTrack?.track_id, ALL_TIME_TOP_ID)
})

test('single-volume songs still pick the highest plays+likes track', () => {
  const song = makeSong({
    primary_ep_url: OLD_EP,
    ep_refs: [OLD_EP],
    ep_volumes: [{ ep_volume: 1, ep_url: OLD_EP, ep_title: 'only', ep_rating: '' }],
  })
  const tracks = [
    makeTrack({
      track_id: 'low',
      sc_url: 'https://soundcloud.com/bananasutra/low',
      play_count: 10,
      like_count: 1,
      ep_url: OLD_EP,
    }),
    makeTrack({
      track_id: ALL_TIME_TOP_ID,
      sc_url: 'https://soundcloud.com/bananasutra/2-hold-the-mic-babe',
      play_count: 1614,
      like_count: 16,
      ep_url: OLD_EP,
    }),
  ]

  const [pick] = buildListenLpWhatsNewPicks([song], tracks)
  assert.equal(pick?.catalogTrack?.track_id, ALL_TIME_TOP_ID)
})
