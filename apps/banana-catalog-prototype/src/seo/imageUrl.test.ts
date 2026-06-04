import assert from 'node:assert/strict'
import test from 'node:test'
import { coverImageUrl } from './imageUrl'

test('coverImageUrl bypasses CF for SoundCloud t500x500 artwork at display width', () => {
  const src = 'https://i1.sndcdn.com/artworks-6hfJ7MQsBYyjyhKs-VO8orw-t500x500.png'
  assert.equal(coverImageUrl(src, { width: 400 }), src)
})

test('coverImageUrl normalizes YouTube maxresdefault to hqdefault', () => {
  const src = 'https://i.ytimg.com/vi/9FwaPZK_8XI/maxresdefault.jpg'
  const out = coverImageUrl(src, { width: 200 })
  assert.match(out, /hqdefault\.jpg/)
  assert.doesNotMatch(out, /maxresdefault/)
})

test('coverImageUrl still uses CF transform for large widths on small SC art', () => {
  const src = 'https://i1.sndcdn.com/artworks-x-t500x500.png'
  const out = coverImageUrl(src, { width: 640 })
  assert.match(out, /\/cdn-cgi\/image\//)
})
