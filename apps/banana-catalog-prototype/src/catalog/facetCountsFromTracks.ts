import { facetEntriesFromCountMap } from './facetCountsCore'
import { sortSutraFacetEntries } from './sutraContext'
import type { FacetEntry, TrackCatalogItem, TracksFacetFilterKey } from './types'

/** Facet value counts for `/tracks` filter sidebar (full flat catalog). */
export function facetCountsFromTracks(tracks: TrackCatalogItem[]): Record<TracksFacetFilterKey, FacetEntry[]> {
  const sutra = new Map<string, number>()
  const lightShadow = new Map<string, number>()
  const primary = new Map<string, number>()
  const secondary = new Map<string, number>()
  const mood = new Map<string, number>()
  const instrument = new Map<string, number>()
  const tempo = new Map<string, number>()

  for (const t of tracks) {
    const s = (t.sutra || '').trim()
    if (s) sutra.set(s, (sutra.get(s) ?? 0) + 1)
    const ls = (t.light_shadow || '').trim()
    if (ls) lightShadow.set(ls, (lightShadow.get(ls) ?? 0) + 1)
    const pg = (t.primary_genre || '').trim()
    if (pg) primary.set(pg, (primary.get(pg) ?? 0) + 1)
    const secSeen = new Set<string>()
    for (const g of t.secondary_genres ?? []) {
      const x = g.trim()
      if (x && !secSeen.has(x)) {
        secSeen.add(x)
        secondary.set(x, (secondary.get(x) ?? 0) + 1)
      }
    }
    const sg = (t.secondary_genre || '').trim()
    if (sg && !secSeen.has(sg)) secondary.set(sg, (secondary.get(sg) ?? 0) + 1)
    const m = (t.mood || '').trim()
    if (m) mood.set(m, (mood.get(m) ?? 0) + 1)
    for (const ins of t.instruments ?? []) {
      const x = ins.trim()
      if (x) instrument.set(x, (instrument.get(x) ?? 0) + 1)
    }
    const tf = (t.tempo_feel || '').trim()
    if (tf) tempo.set(tf, (tempo.get(tf) ?? 0) + 1)
  }

  return {
    sutra: sortSutraFacetEntries(facetEntriesFromCountMap(sutra, { sensitivity: 'base' })),
    light_shadow: facetEntriesFromCountMap(lightShadow, { sensitivity: 'base' }),
    primary_genre: facetEntriesFromCountMap(primary, { sensitivity: 'base' }),
    secondary_genre: facetEntriesFromCountMap(secondary, { sensitivity: 'base' }),
    mood: facetEntriesFromCountMap(mood, { sensitivity: 'base' }),
    instrument: facetEntriesFromCountMap(instrument, { sensitivity: 'base' }),
    tempo_feel: facetEntriesFromCountMap(tempo, { sensitivity: 'base' }),
  }
}
