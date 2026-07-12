import assert from 'node:assert/strict'
import test from 'node:test'
import { formatPublishDate, formatPublishDateShort, parseCatalogPublishedAt } from './formatPublishDate'

test('naive SC UTC timestamps format as Pacific calendar dates', () => {
  // 2026-07-12 04:45 UTC = 2026-07-11 21:45 PDT
  assert.equal(formatPublishDate('2026-07-12T04:45:00'), 'Jul 11, 2026')
  assert.equal(formatPublishDateShort('2026-07-12T04:45:00'), 'Jul 11')
  assert.equal(formatPublishDate('2026-07-12 04:45:00'), 'Jul 11, 2026')
})

test('explicit Z timestamps also format in Pacific', () => {
  assert.equal(formatPublishDate('2026-07-12T04:45:00Z'), 'Jul 11, 2026')
})

test('parseCatalogPublishedAt treats naive values as UTC', () => {
  const naive = parseCatalogPublishedAt('2026-07-12T04:45:00')
  const zulu = parseCatalogPublishedAt('2026-07-12T04:45:00Z')
  assert.equal(naive, zulu)
})
