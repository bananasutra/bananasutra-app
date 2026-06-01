import assert from 'node:assert/strict'
import test from 'node:test'
import type { MuseCatalogItem, SongCatalogItem, YouTubeCatalogVideo } from './types'
import { buildContextualMuseRows, museMatchesFilters } from './museFiltersCore'
import { applyVideoFilters, type VideosUrlFilters } from './videosFiltersCore'

function makeMuse(overrides: Partial<MuseCatalogItem> = {}): MuseCatalogItem {
  return {
    muse: 'Albert Camus',
    first_name: 'Albert',
    last_name: 'Camus',
    muse_id: 'm-1',
    gender_pronoun: 'he/him',
    type_category: 'Philosopher,Author',
    country: 'FR',
    era: 'Early 20th c',
    birth_year: '1913',
    death_year: '1960',
    famous_works: 'The Myth of Sisyphus',
    core_sutra: 'KNOWsutra',
    secondary_sutras: '',
    themes: 'absurdity,truth',
    notes: 'A muse for absurd courage',
    quote_excerpt: 'One must imagine Sisyphus happy.',
    wikipedia_url: '',
    song_count: 1,
    ...overrides,
  }
}

function makeVideo(overrides: Partial<YouTubeCatalogVideo> = {}): YouTubeCatalogVideo {
  return {
    video_id: 'v-1',
    title: 'Video One',
    lyrics_title: 'Song One',
    lyrics_id: 'L-1',
    sutra: 'KNOWsutra',
    genre_primary: 'FOLK',
    genre_secondary: '',
    instruments: 'GUITAR',
    yt_url: 'https://youtube.com/watch?v=1',
    thumbnail_url: '',
    duration: '3:00',
    publish_date: '2026-01-01',
    playlist_names: '',
    content_type: 'video',
    format: '16:9',
    topic_categories: '',
    song_topic: 'TRUTH',
    song_intention: 'askWHY',
    can_embed: true,
    ...overrides,
  }
}

test('muses contextual rows apply all other active filters', () => {
  const muses = [
    makeMuse({ muse_id: 'm-1', era: 'Early 20th c', country: 'FR', gender_pronoun: 'he/him' }),
    makeMuse({ muse_id: 'm-2', muse: 'Simone Weil', first_name: 'Simone', last_name: 'Weil', era: 'Early 20th c', country: 'FR', gender_pronoun: 'she/her' }),
    makeMuse({ muse_id: 'm-3', muse: 'Virginia Woolf', first_name: 'Virginia', last_name: 'Woolf', era: 'Late 20th c', country: 'UK', gender_pronoun: 'she/her' }),
  ]
  const filters = { era: 'all', gender: 'she/her', type: 'all', country: 'FR', query: '' }
  const contextual = buildContextualMuseRows(muses, filters)

  assert.equal(contextual.rowsWithoutEra.length, 1)
  assert.equal(contextual.rowsWithoutEra[0]?.muse, 'Simone Weil')
  assert.equal(
    museMatchesFilters(makeMuse({ muse: 'Albert Camus', country: 'FR', gender_pronoun: 'he/him' }), filters),
    false,
  )
})

test('videos contextual counts support clearing one facet group at a time', () => {
  const videos = [
    makeVideo({ video_id: 'v-1', sutra: 'KNOWsutra', song_topic: 'TRUTH', lyrics_id: 'L-1' }),
    makeVideo({ video_id: 'v-2', sutra: 'KNOWsutra', song_topic: 'WISDOM', lyrics_id: 'L-2' }),
    makeVideo({ video_id: 'v-3', sutra: 'BLOWsutra', song_topic: 'TRUTH', lyrics_id: 'L-3' }),
  ]
  const filters: VideosUrlFilters = {
    find: '',
    sutra: 'KNOWsutra',
    topic: 'TRUTH',
    intention: '',
    linkTarget: 'all',
    media: 'all',
    page: 1,
  }
  const inAppIds = new Set(['L-1', 'L-2', 'L-3'])
  const songsByLyricsId = new Map<string, SongCatalogItem>()

  const withoutTopic = applyVideoFilters(videos, { ...filters, topic: '' }, inAppIds, songsByLyricsId)
  const knowCount = withoutTopic.filter((v) => (v.sutra || '').trim() === 'KNOWsutra').length
  const blowCount = withoutTopic.filter((v) => (v.sutra || '').trim() === 'BLOWsutra').length

  assert.equal(knowCount, 2)
  assert.equal(blowCount, 0)
})
