import assert from 'node:assert/strict'
import test from 'node:test'
import { buildSrcset, coverImageUrl, coverImageFallbackUrl, nativeImageMaxWidth, youtubeThumbnailFallbackUrl } from './imageUrl'

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

test('coverImageUrl keeps YouTube maxresdefault for square-friendly crops', () => {
  const src = 'https://i.ytimg.com/vi/9FwaPZK_8XI/maxresdefault.jpg'
  const out = coverImageUrl(src, { width: 200 })
  assert.match(out, /maxresdefault\.jpg/)
  assert.doesNotMatch(out, /\/cdn-cgi\/image\//)
})

test('coverImageUrl upgrades YouTube hqdefault to maxresdefault', () => {
  const src = 'https://i.ytimg.com/vi/9FwaPZK_8XI/hqdefault.jpg'
  const out = coverImageUrl(src, { width: 200 })
  assert.match(out, /maxresdefault\.jpg/)
  assert.doesNotMatch(out, /hqdefault/)
  assert.doesNotMatch(out, /\/cdn-cgi\/image\//)
})

test('buildSrcset caps YouTube maxresdefault at 1280w', () => {
  const src = 'https://i.ytimg.com/vi/9FwaPZK_8XI/hqdefault.jpg'
  const set = buildSrcset(src, [240, 360, 480, 640, 960, 1280, 1600])
  assert.match(set, /1280w/)
  assert.doesNotMatch(set, /1600w/)
  assert.doesNotMatch(set, /\/cdn-cgi\/image\//)
})

test('coverImageUrl still uses CF transform for remotes without native size', () => {
  const src = 'https://example.com/hero.png'
  const out = coverImageUrl(src, { width: 400 })
  assert.match(out, /\/cdn-cgi\/image\/width=400/)
})

test('youtubeThumbnailFallbackUrl downgrades maxresdefault to hqdefault', () => {
  const src = 'https://i.ytimg.com/vi/abc123/maxresdefault.jpg'
  const out = youtubeThumbnailFallbackUrl(src, src)
  assert.match(out, /hqdefault\.jpg/)
  assert.doesNotMatch(out, /maxresdefault/)
})

test('coverImageFallbackUrl returns origin when CF transform fails', () => {
  const src = 'https://example.com/hero.png'
  const failed = coverImageUrl(src, { width: 400 })
  const out = coverImageFallbackUrl(src, failed)
  assert.equal(out, src)
})
