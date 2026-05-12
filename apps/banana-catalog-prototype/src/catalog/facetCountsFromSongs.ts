import { facetEntriesFromCountMap } from './facetCountsCore'
import type { FacetsPayload, FilterFacetKey, SongCatalogItem } from './types'

/** Recompute facet value counts for an arbitrary song subset (e.g. listener-only / words pool). */
export function facetCountsFromSongs(songs: SongCatalogItem[]): FacetsPayload {
  const sutra = new Map<string, number>()
  const light_shadow = new Map<string, number>()
  const topic = new Map<string, number>()
  const intention = new Map<string, number>()
  const written_year = new Map<string, number>()
  const track_genre = new Map<string, number>()
  const track_secondary_genre = new Map<string, number>()
  const track_instrument = new Map<string, number>()
  const track_mood = new Map<string, number>()
  const track_tempo_feel = new Map<string, number>()
  const lang = new Map<string, number>()

  for (const card of songs) {
    if (card.sutra) sutra.set(card.sutra, (sutra.get(card.sutra) ?? 0) + 1)
    if (card.light_shadow) light_shadow.set(card.light_shadow, (light_shadow.get(card.light_shadow) ?? 0) + 1)
    if (card.topic) topic.set(card.topic, (topic.get(card.topic) ?? 0) + 1)
    if (card.intention) intention.set(card.intention, (intention.get(card.intention) ?? 0) + 1)
    const wy = String(card.written_year || '').trim()
    if (wy) written_year.set(wy, (written_year.get(wy) ?? 0) + 1)
    if (card.lang) lang.set(card.lang, (lang.get(card.lang) ?? 0) + 1)
    for (const g of card.track_genres) {
      if (g) track_genre.set(g, (track_genre.get(g) ?? 0) + 1)
    }
    for (const g of card.track_secondary_genres) {
      if (g) track_secondary_genre.set(g, (track_secondary_genre.get(g) ?? 0) + 1)
    }
    for (const ins of card.track_instruments) {
      if (ins) track_instrument.set(ins, (track_instrument.get(ins) ?? 0) + 1)
    }
    for (const m of card.track_moods ?? []) {
      if (m) track_mood.set(m, (track_mood.get(m) ?? 0) + 1)
    }
    for (const tf of card.track_tempo_feels ?? []) {
      if (tf) track_tempo_feel.set(tf, (track_tempo_feel.get(tf) ?? 0) + 1)
    }
  }

  const out: Partial<FacetsPayload> = {
    sutra: facetEntriesFromCountMap(sutra),
    light_shadow: facetEntriesFromCountMap(light_shadow),
    topic: facetEntriesFromCountMap(topic),
    intention: facetEntriesFromCountMap(intention),
    written_year: facetEntriesFromCountMap(written_year),
    track_genre: facetEntriesFromCountMap(track_genre),
    track_secondary_genre: facetEntriesFromCountMap(track_secondary_genre),
    track_instrument: facetEntriesFromCountMap(track_instrument),
    track_mood: facetEntriesFromCountMap(track_mood),
    track_tempo_feel: facetEntriesFromCountMap(track_tempo_feel),
    lang: facetEntriesFromCountMap(lang),
  }
  return out as FacetsPayload
}

export function facetGroupKeys(): FilterFacetKey[] {
  return [
    'sutra',
    'light_shadow',
    'topic',
    'intention',
    'written_year',
    'track_genre',
    'track_secondary_genre',
    'track_instrument',
    'lang',
  ]
}
