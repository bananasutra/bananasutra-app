import assert from 'node:assert/strict'
import test from 'node:test'
import { emptyTracksFilterState } from './types'
import { songbookHintForTracksFilters } from './tracksFilterSongbookHint'

test('songbookHintForTracksFilters maps single primary_genre to genre best-of', () => {
  const filters = emptyTracksFilterState()
  filters.primary_genre.add('JAZZ')
  const hint = songbookHintForTracksFilters(filters, '')
  assert.equal(hint?.songbook, 'JAZZsutra (Best Of)')
  assert.equal(hint?.href, '/songbooks/jazz-best-of/')
})

test('songbookHintForTracksFilters maps single sutra to sutra songbook', () => {
  const filters = emptyTracksFilterState()
  filters.sutra.add('KNOWsutra')
  const hint = songbookHintForTracksFilters(filters, '')
  assert.ok(hint)
  assert.match(hint!.href, /^\/songbooks\/[\w-]+\/$/)
  assert.ok(hint!.songbook.length > 0)
})

test('songbookHintForTracksFilters returns null when filters are ambiguous', () => {
  const filters = emptyTracksFilterState()
  filters.primary_genre.add('JAZZ')
  filters.mood.add('NERDY')
  assert.equal(songbookHintForTracksFilters(filters, ''), null)
})

test('songbookHintForTracksFilters matches find query to songbook name', () => {
  const filters = emptyTracksFilterState()
  const hint = songbookHintForTracksFilters(filters, 'lofi')
  assert.equal(hint?.songbook, 'LOFIsutra (Best Of)')
})
