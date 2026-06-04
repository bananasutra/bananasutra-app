import assert from 'node:assert/strict'
import test from 'node:test'
import { emptyTracksFilterState } from './types'
import { reportTracksFilterPatch } from './catalogAnalytics'

test('reportTracksFilterPatch emits filter_applied when a facet is added', () => {
  const calls: unknown[][] = []
  const gtag = (...args: unknown[]) => {
    calls.push(args)
  }
  ;(globalThis as { window?: { gtag?: typeof gtag } }).window = { gtag }

  const prev = emptyTracksFilterState()
  const next = emptyTracksFilterState()
  next.sutra = new Set(['KNOW'])

  reportTracksFilterPatch(prev, next)

  assert.equal(calls.length, 1)
  assert.equal(calls[0]?.[1], 'filter_applied')
  const params = calls[0]?.[2] as Record<string, unknown>
  assert.equal(params.route, '/tracks')
  assert.equal(params.facet, 'sutra')
  assert.equal(params.mode, 'read')

  delete (globalThis as { window?: unknown }).window
})
