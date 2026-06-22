import test from 'node:test'
import assert from 'node:assert/strict'
import { pickRandomHomeVideoTeasers } from './homePortalData'
import type { YouTubeCatalogVideo } from './types'

function video(overrides: Partial<YouTubeCatalogVideo> & Pick<YouTubeCatalogVideo, 'video_id'>): YouTubeCatalogVideo {
  return {
    lyrics_id: 'L-1',
    lyrics_title: 'Test Song',
    title: 'Test Song',
    url_slug: 'test-song',
    video_id: overrides.video_id,
    thumbnail_url: 'https://example.com/thumb.jpg',
    publish_date: '2026-01-01',
    sutra: 'KNOWsutra',
    format: '16:9',
    video_featured: false,
    genre_primary: '',
    genre_secondary: '',
    instruments: '',
    yt_url: `https://www.youtube.com/watch?v=${overrides.video_id}`,
    duration: '3:00',
    playlist_names: '',
    content_type: 'Music Video',
    topic_categories: '',
    song_topic: '',
    song_intention: '',
    can_embed: true,
    ...overrides,
  }
}

test('pickRandomHomeVideoTeasers excludes 9:16 videos', () => {
  const pool: Record<string, YouTubeCatalogVideo[]> = {
    'L-1': [video({ video_id: 'landscape', format: '16:9' })],
    'L-2': [video({ video_id: 'vertical', format: '9:16', url_slug: 'vertical-song' })],
  }

  for (let i = 0; i < 20; i += 1) {
    const picks = pickRandomHomeVideoTeasers(pool, 2)
    assert.ok(picks.every((p) => p.videoId === 'landscape'), 'only 16:9 videos should appear')
  }
})
