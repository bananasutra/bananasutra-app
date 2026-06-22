import test from 'node:test'
import assert from 'node:assert/strict'
import { youtubeAspectRatioFromFormat, youtubeFormatIsLandscape16x9 } from './youtubeAspectRatio'

test('youtubeFormatIsLandscape16x9 accepts explicit 16:9 labels only', () => {
  assert.equal(youtubeFormatIsLandscape16x9('16:9'), true)
  assert.equal(youtubeFormatIsLandscape16x9('16x9'), true)
  assert.equal(youtubeFormatIsLandscape16x9(' 16:9 '), true)
})

test('youtubeFormatIsLandscape16x9 rejects vertical and combined labels', () => {
  assert.equal(youtubeFormatIsLandscape16x9('9:16'), false)
  assert.equal(youtubeFormatIsLandscape16x9('9:16/16:9'), false)
  assert.equal(youtubeFormatIsLandscape16x9('shorts'), false)
  assert.equal(youtubeFormatIsLandscape16x9(''), false)
  assert.equal(youtubeFormatIsLandscape16x9(undefined), false)
})

test('youtubeAspectRatioFromFormat still maps vertical formats for embed CSS', () => {
  assert.equal(youtubeAspectRatioFromFormat('9:16'), '9 / 16')
  assert.equal(youtubeAspectRatioFromFormat('16:9'), '16 / 9')
})
