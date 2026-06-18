import assert from 'node:assert/strict'
import test from 'node:test'
import { emptyTracksFilterState } from '../types'
import { queueContextLine, queueResumeContextLine, tracksFilterCollectionLabel } from './queueContextLine'
import type { PlayerQueueState, PlayableTrack } from './types'

const baseTrack: PlayableTrack = {
  track_id: '1',
  sc_url: 'https://soundcloud.com/bananasutra/example',
  track_title: 'Example track',
  lyrics_title: 'Tell the truth',
  lyrics_id: 'L-1',
  sutra: 'KNOW',
  primary_genre: 'BLUES',
  lyrics_extract: 'Lies wear suits',
}

function state(
  partial: Partial<PlayerQueueState> & Pick<PlayerQueueState, 'source' | 'tracks' | 'position'>,
): PlayerQueueState {
  return {
    source: partial.source,
    tracks: partial.tracks,
    position: partial.position,
    playing: partial.playing ?? false,
    currentPositionMs: partial.currentPositionMs ?? 0,
    playAllActive: partial.playAllActive ?? Boolean(partial.source && partial.source.type !== 'single'),
  }
}

test('queueContextLine formats tracks_filter with sutra and genre', () => {
  const filters = emptyTracksFilterState()
  filters.sutra = new Set(['KNOW'])
  filters.primary_genre = new Set(['FOLK'])
  const line = queueContextLine(
    state({
      source: { type: 'tracks_filter', filters, find: '', sort: 'likes' },
      tracks: [baseTrack, baseTrack],
      position: 1,
    }),
  )
  assert.equal(line, 'Playing top track 2 of 2 from KNOWsutra · FOLK')
})

test('queueContextLine formats song_variants', () => {
  const line = queueContextLine(
    state({
      source: { type: 'song_variants', song_id: 'L-1', song_title: 'Tell the truth' },
      tracks: [baseTrack, baseTrack, baseTrack, baseTrack],
      position: 1,
    }),
  )
  assert.equal(line, 'Playing song top track 2 of 4')
})

test('tracksFilterCollectionLabel uses facet values and search', () => {
  const filters = emptyTracksFilterState()
  filters.sutra = new Set(['KNOW'])
  filters.mood = new Set(['KINDLY'])
  assert.equal(tracksFilterCollectionLabel(filters, 'banana'), 'search “banana” · KNOWsutra · KINDLY')
  assert.equal(tracksFilterCollectionLabel(emptyTracksFilterState(), ''), '')
})

test('tracksFilterCollectionLabel does not double sutra suffix', () => {
  const filters = emptyTracksFilterState()
  filters.sutra = new Set(['SHOWsutra'])
  assert.equal(tracksFilterCollectionLabel(filters, ''), 'SHOWsutra')
})

test('queueContextLine omits from clause when tracks are unfiltered', () => {
  const line = queueContextLine(
    state({
      source: { type: 'tracks_filter', filters: emptyTracksFilterState(), find: '', sort: 'likes' },
      tracks: [baseTrack],
      position: 0,
    }),
  )
  assert.equal(line, 'Playing top track 1 of 1')
})

test('queueContextLine formats songbook', () => {
  const line = queueContextLine(
    state({
      source: { type: 'songbook', songbook_slug: 'best-know', songbook_name: 'Best of KNOWsutra' },
      tracks: [baseTrack],
      position: 0,
    }),
  )
  assert.equal(line, 'Playing top track 1 of 1 from Best of KNOWsutra')
})

test('queueContextLine uses lyrics_extract for single track', () => {
  const line = queueContextLine(
    state({
      source: { type: 'single', track_id: '1' },
      tracks: [baseTrack],
      position: 0,
      playAllActive: false,
    }),
  )
  assert.equal(line, 'Lies wear suits')
})

test('queueResumeContextLine formats m:ss resume cue', () => {
  assert.equal(queueResumeContextLine(84), 'Resume from 1:24 ↻')
})
