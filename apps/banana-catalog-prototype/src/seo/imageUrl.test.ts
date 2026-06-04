import assert from 'node:assert/strict'
import test from 'node:test'
import { buildSrcset, coverImageUrl, nativeImageMaxWidth } from './imageUrl'

const SC_T500 =
  'https://i1.sndcdn.com/artworks-6hfJ7MQsBYyjyhKs-VO8orw-t500x500.png'

test('nativeImageMaxWidth reads SoundCloud -tWxH from path', () => {
  assert.equal(nativeImageMaxWidth(SC_T500), 500)
})

test('coverImageUrl bypasses CF for SoundCloud t500 at any display width', () => {
  assert.equal(coverImageUrl(SC_T500, { width: 400 }), SC_T500)
  assert.equal(coverImageUrl(SC_T500, { width: 640 }), SC_T500)
})

test('buildSrcset drops widths above native SoundCloud art (no 640w CF)', () => {
  const set = buildSrcset(SC_T500, [240, 360, 480, 640])
  assert.match(set, /240w/)
  assert.match(set, /480w/)
  assert.doesNotMatch(set, /640w/)
  assert.doesNotMatch(set, /\/cdn-cgi\/image\//)
})

test('coverImageUrl normalizes YouTube maxresdefault to hqdefault', () => {
  const src = 'https://i.ytimg.com/vi/9FwaPZK_8XI/maxresdefault.jpg'
  const out = coverImageUrl(src, { width: 200 })
  assert.match(out, /hqdefault\.jpg/)
  assert.doesNotMatch(out, /maxresdefault/)
  assert.doesNotMatch(out, /\/cdn-cgi\/image\//)
})

test('buildSrcset caps YouTube hqdefault at 480w', () => {
  const src = 'https://i.ytimg.com/vi/9FwaPZK_8XI/hqdefault.jpg'
  const set = buildSrcset(src, [240, 360, 480, 640])
  assert.doesNotMatch(set, /640w/)
  assert.doesNotMatch(set, /\/cdn-cgi\/image\//)
})

test('coverImageUrl still uses CF transform for remotes without native size', () => {
  const src = 'https://example.com/hero.png'
  const out = coverImageUrl(src, { width: 400 })
  assert.match(out, /\/cdn-cgi\/image\/width=400/)
})
