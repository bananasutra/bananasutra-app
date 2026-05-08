import type { SongCatalogItem } from './types'
import { countTitleTokenMatches } from './searchMatch'

/** Same spirit as track pick scoring in `build_artifacts.py` (likes weighted vs plays). */
const LIKE_WEIGHT = 40

function scoreEpTotals(s: SongCatalogItem): number {
  return s.aggregate_play_count + LIKE_WEIGHT * s.aggregate_like_count
}

function scorePeakTrack(s: SongCatalogItem): number {
  return s.peak_play_count + LIKE_WEIGHT * s.peak_like_count
}

/** “TOP Songs” — popularity within the tab, with title whole-token matches ranked above body-only matches. */
export function sortDiscoveryEpsTab(songs: SongCatalogItem[], queryTokens?: string[]): SongCatalogItem[] {
  const tokens = queryTokens ?? []
  return [...songs].sort((a, b) => {
    if (tokens.length > 0) {
      const ta = countTitleTokenMatches(a, tokens)
      const tb = countTitleTokenMatches(b, tokens)
      if (ta !== tb) return tb - ta
    }
    return scoreEpTotals(b) - scoreEpTotals(a) || a.lyrics_id.localeCompare(b.lyrics_id)
  })
}

/**
 * Songbooks tab: same sort key for now (each row is still one song row; later can group by `songbook`).
 * Surfaces songbook matches where the parent EP is strongest first.
 */
export function sortDiscoverySongbooksTab(songs: SongCatalogItem[]): SongCatalogItem[] {
  return sortDiscoveryEpsTab(songs)
}

/** Songbooks preview: group visually by sorting **songbook** A→Z, then popularity within each book. */
export function sortDiscoverySongbooksForDisplay(songs: SongCatalogItem[]): SongCatalogItem[] {
  const byScore = sortDiscoverySongbooksTab(songs)
  const emptyKey = '\uFFF0'
  return [...byScore].sort((a, b) => {
    const ka = (a.songbook || '').trim().toLowerCase() || emptyKey
    const kb = (b.songbook || '').trim().toLowerCase() || emptyKey
    if (ka !== kb) return ka.localeCompare(kb)
    return scoreEpTotals(b) - scoreEpTotals(a) || a.lyrics_id.localeCompare(b.lyrics_id)
  })
}

/** “TOP tracks” — peak-track popularity, with title whole-token matches ranked above body-only matches. */
export function sortDiscoveryTracksTab(songs: SongCatalogItem[], queryTokens?: string[]): SongCatalogItem[] {
  const tokens = queryTokens ?? []
  return [...songs].sort((a, b) => {
    if (tokens.length > 0) {
      const ta = countTitleTokenMatches(a, tokens)
      const tb = countTitleTokenMatches(b, tokens)
      if (ta !== tb) return tb - ta
    }
    return scorePeakTrack(b) - scorePeakTrack(a) || a.lyrics_id.localeCompare(b.lyrics_id)
  })
}
