import assert from 'node:assert/strict'
import test from 'node:test'
import {
  compareSutraDisplayNames,
  sortSutraDisplayNames,
  sortSutraFacetEntries,
} from './sutraContext'

test('sutra filter chips sort in canonical KNOW→BOW order, not alphabetically', () => {
  const shuffled = ['GLOWsutra', 'KNOWsutra', 'BOWsutra', 'FLOWsutra', 'SHOWsutra', 'GROWsutra', 'BLOWsutra']
  const sorted = sortSutraDisplayNames(shuffled)
  assert.deepEqual(sorted, [
    'KNOWsutra',
    'BLOWsutra',
    'SHOWsutra',
    'GROWsutra',
    'FLOWsutra',
    'GLOWsutra',
    'BOWsutra',
  ])
})

test('sutra facet entries preserve canonical order with counts attached', () => {
  const entries = sortSutraFacetEntries([
    { value: 'FLOWsutra', count: 12 },
    { value: 'KNOWsutra', count: 40 },
    { value: 'BOWsutra', count: 3 },
  ])
  assert.deepEqual(
    entries.map((e) => e.value),
    ['KNOWsutra', 'FLOWsutra', 'BOWsutra'],
  )
})

test('compareSutraDisplayNames ranks QUACK after core seven', () => {
  assert.ok(compareSutraDisplayNames('BOWsutra', 'QUACKsutra') < 0)
  assert.ok(compareSutraDisplayNames('QUACKsutra', 'ZZZsutra') < 0)
})
