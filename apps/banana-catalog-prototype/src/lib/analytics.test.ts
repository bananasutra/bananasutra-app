import assert from 'node:assert/strict'
import test from 'node:test'
import {
  ANALYTICS_MODE_PRE_TOGGLE,
  applyAnalyticsDebugFromSearch,
  track,
  trackFilterApplied,
  trackPlayStarted,
} from './analytics'

test('ANALYTICS_MODE_PRE_TOGGLE is read until mode-toggle ships', () => {
  assert.equal(ANALYTICS_MODE_PRE_TOGGLE, 'read')
})

test('track is a no-op without window.gtag', () => {
  assert.doesNotThrow(() => track('filter_cleared', { route: '/tracks', facets_cleared_count: 2 }))
})

test('trackFilterApplied defaults mode to read', () => {
  const calls: unknown[][] = []
  const gtag = (...args: unknown[]) => {
    calls.push(args)
  }
  ;(globalThis as { window?: { gtag?: typeof gtag } }).window = { gtag }

  trackFilterApplied({ route: '/tracks', facet: 'sutra', value: 'KNOW' })

  assert.equal(calls.length, 1)
  assert.equal(calls[0]?.[0], 'event')
  assert.equal(calls[0]?.[1], 'filter_applied')
  const params = calls[0]?.[2] as Record<string, unknown>
  assert.equal(params.mode, 'read')
  assert.equal(params.facet, 'sutra')

  delete (globalThis as { window?: unknown }).window
})

test('trackPlayStarted strips undefined optional fields', () => {
  const calls: unknown[][] = []
  const gtag = (...args: unknown[]) => {
    calls.push(args)
  }
  ;(globalThis as { window?: { gtag?: typeof gtag } }).window = { gtag }

  trackPlayStarted({
    track_id: 'sc-1',
    song_id: 'L-1',
    sutra: 'KNOW',
    primary_genre: 'BLUES',
    source: 'single',
  })

  const params = calls[0]?.[2] as Record<string, unknown>
  assert.equal('from_resume' in params, false)

  delete (globalThis as { window?: unknown }).window
})

test('applyAnalyticsDebugFromSearch enables debug_mode when query param present', () => {
  const calls: unknown[][] = []
  const gtag = (...args: unknown[]) => {
    calls.push(args)
  }
  ;(globalThis as { window?: { gtag?: typeof gtag } }).window = { gtag }

  applyAnalyticsDebugFromSearch('?debug_mode=1&foo=bar')
  assert.equal(calls.length, 1)
  assert.equal(calls[0]?.[0], 'config')
  assert.equal(calls[0]?.[1], 'G-MJLGTXTE5W')
  assert.deepEqual(calls[0]?.[2], { debug_mode: true })

  applyAnalyticsDebugFromSearch('?foo=bar')
  assert.equal(calls.length, 1)

  delete (globalThis as { window?: unknown }).window
})
