import assert from 'node:assert/strict'
import test from 'node:test'
import {
  catalogInfiniteScrollStorageKey,
  clampCatalogInfiniteScrollRestoreCount,
  computeCatalogInfiniteScrollInitialCount,
  CATALOG_INFINITE_SCROLL_BATCH,
  CATALOG_INFINITE_SCROLL_MAX_RESTORE,
} from './useCatalogInfiniteScroll'

test('catalogInfiniteScrollStorageKey is stable per route and filter signature', () => {
  const key = catalogInfiniteScrollStorageKey('/videos', 'KNOWsutra|TRUTH')
  assert.equal(key, 'catalog-infinite-scroll:/videos:KNOWsutra|TRUTH')
})

test('computeCatalogInfiniteScrollInitialCount uses legacy page when no session restore', () => {
  const count = computeCatalogInfiniteScrollInitialCount(100, CATALOG_INFINITE_SCROLL_BATCH, {
    legacyPage: 3,
  })
  assert.equal(count, 72)
})

test('computeCatalogInfiniteScrollInitialCount caps legacy page at max restore', () => {
  const count = computeCatalogInfiniteScrollInitialCount(500, CATALOG_INFINITE_SCROLL_BATCH, {
    legacyPage: 10,
  })
  assert.equal(count, CATALOG_INFINITE_SCROLL_MAX_RESTORE)
})

test('computeCatalogInfiniteScrollInitialCount caps at total', () => {
  const count = computeCatalogInfiniteScrollInitialCount(45, CATALOG_INFINITE_SCROLL_BATCH, {
    legacyPage: 5,
  })
  assert.equal(count, 45)
})

test('computeCatalogInfiniteScrollInitialCount defaults to one batch', () => {
  const count = computeCatalogInfiniteScrollInitialCount(470, CATALOG_INFINITE_SCROLL_BATCH, {})
  assert.equal(count, CATALOG_INFINITE_SCROLL_BATCH)
})

test('computeCatalogInfiniteScrollInitialCount returns zero for empty lists', () => {
  assert.equal(computeCatalogInfiniteScrollInitialCount(0, CATALOG_INFINITE_SCROLL_BATCH, {}), 0)
})

test('clampCatalogInfiniteScrollRestoreCount limits back-nav restore', () => {
  assert.equal(clampCatalogInfiniteScrollRestoreCount(200, 470), CATALOG_INFINITE_SCROLL_MAX_RESTORE)
  assert.equal(clampCatalogInfiniteScrollRestoreCount(48, 470), 48)
})
