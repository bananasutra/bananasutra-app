import { haystackTokenMatches, searchTokens } from './searchMatch'
import type { TrackCatalogItem, TrackSortMode, TracksFilterState } from './types'

const LEADING_TRACK_PREFIX_RE = /^\s*(?:#[0-9]+\s*|[A-Za-z]\s*\[[0-9]+\]\s*|\[[0-9]+\]\s*|\[[A-Za-z][^\]]*\]\s*)+/
const LEADING_PUNCTUATION_RE = /^[^\p{L}\p{N}]+/u
const trackTitleAzCollator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true })

function setIntersectsArray(set: Set<string>, arr: string[]): boolean {
  if (set.size === 0) return true
  return arr.some((x) => set.has(x))
}

function scalarInSet(set: Set<string>, value: string): boolean {
  if (set.size === 0) return true
  const v = value.trim()
  return v !== '' && set.has(v)
}

export function trackMatchesFilters(track: TrackCatalogItem, f: TracksFilterState): boolean {
  if (!scalarInSet(f.sutra, (track.sutra || '').trim())) return false
  if (!scalarInSet(f.light_shadow, (track.light_shadow || '').trim())) return false
  if (!scalarInSet(f.primary_genre, track.primary_genre)) return false
  if (f.secondary_genre.size > 0) {
    const secSingle = (track.secondary_genre || '').trim()
    const fromArr = track.secondary_genres.some((g) => f.secondary_genre.has(g))
    const fromSingle = Boolean(secSingle && f.secondary_genre.has(secSingle))
    if (!fromArr && !fromSingle) return false
  }
  if (!scalarInSet(f.mood, (track.mood || '').trim())) return false
  if (!setIntersectsArray(f.instrument, track.instruments)) return false
  if (!scalarInSet(f.tempo_feel, (track.tempo_feel || '').trim())) return false
  return true
}

function trackSearchHaystack(t: TrackCatalogItem): string {
  return [
    t.track_title,
    t.lyrics_title,
    t.sutra,
    t.light_shadow,
    t.primary_genre,
    t.soundcloud_genre,
    t.secondary_genre,
    ...(t.secondary_genres ?? []),
    ...(t.genres ?? []),
    t.mood,
    t.tempo_feel,
    ...t.instruments,
    t.ep_title,
  ]
    .join(' \n ')
    .toLowerCase()
}

/** AND token match on a simple lowercase haystack (aligned with discovery `q=` on `/tracks`). */
export function filterTracksByFindQuery(tracks: TrackCatalogItem[], raw: string): TrackCatalogItem[] {
  const tokens = searchTokens(raw)
  if (!tokens.length) return tracks
  return tracks.filter((t) => {
    const h = trackSearchHaystack(t)
    return tokens.every((tok) => haystackTokenMatches(h, tok))
  })
}

function normalizedTrackTitleForAzSort(title: string): string {
  const trimmed = title.trim()
  const withoutPrefix = trimmed.replace(LEADING_TRACK_PREFIX_RE, '').trim()
  const base = withoutPrefix || trimmed
  return base.replace(LEADING_PUNCTUATION_RE, '').trim() || base
}

export function sortTrackCatalog(list: TrackCatalogItem[], mode: TrackSortMode): TrackCatalogItem[] {
  const out = [...list]
  if (mode === 'newest') {
    out.sort((a, b) => {
      const pa = Date.parse((a.song_published_at || '').trim()) || Date.parse((a.created_at || '').trim()) || 0
      const pb = Date.parse((b.song_published_at || '').trim()) || Date.parse((b.created_at || '').trim()) || 0
      if (pb !== pa) return pb - pa
      return a.track_id.localeCompare(b.track_id)
    })
    return out
  }
  if (mode === 'plays') {
    out.sort((a, b) => {
      if (b.play_count !== a.play_count) return b.play_count - a.play_count
      const ca = Date.parse((a.created_at || '').trim()) || 0
      const cb = Date.parse((b.created_at || '').trim()) || 0
      if (cb !== ca) return cb - ca
      return a.track_id.localeCompare(b.track_id)
    })
    return out
  }
  if (mode === 'engagement') {
    out.sort((a, b) => {
      const ra = a.engagement_rate ?? 0
      const rb = b.engagement_rate ?? 0
      if (rb !== ra) return rb - ra
      return a.track_id.localeCompare(b.track_id)
    })
    return out
  }
  if (mode === 'title_az') {
    out.sort((a, b) => {
      const aSortTitle = normalizedTrackTitleForAzSort(a.track_title)
      const bSortTitle = normalizedTrackTitleForAzSort(b.track_title)
      const trackCmp = trackTitleAzCollator.compare(aSortTitle, bSortTitle)
      if (trackCmp !== 0) return trackCmp
      const rawCmp = trackTitleAzCollator.compare(a.track_title, b.track_title)
      if (rawCmp !== 0) return rawCmp
      const songCmp = trackTitleAzCollator.compare(a.lyrics_title, b.lyrics_title)
      if (songCmp !== 0) return songCmp
      return a.track_id.localeCompare(b.track_id)
    })
    return out
  }
  out.sort((a, b) => {
    if (b.like_count !== a.like_count) return b.like_count - a.like_count
    if (b.play_count !== a.play_count) return b.play_count - a.play_count
    return a.track_id.localeCompare(b.track_id)
  })
  return out
}
