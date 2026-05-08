import type { FilterState, MediaComboFilter, SongCatalogItem, SortMode } from './types'

function scalarInSet(set: Set<string>, value: string): boolean {
  if (set.size === 0) return true
  return value !== '' && set.has(value)
}

export function songMatchesFilters(song: SongCatalogItem, f: FilterState): boolean {
  if (!scalarInSet(f.sutra, song.sutra)) return false
  if (!scalarInSet(f.topic, song.topic)) return false
  if (!scalarInSet(f.intention, song.intention)) return false
  if (!scalarInSet(f.light_shadow, song.light_shadow)) return false
  if (!scalarInSet(f.lang, song.lang)) return false
  if (!scalarInSet(f.written_year, song.written_year)) return false
  return true
}

export function songMatchesMediaCombo(song: SongCatalogItem, mode: MediaComboFilter): boolean {
  if (mode === 'all') return true
  const sc = Boolean(
    song.has_in_app_playback || song.has_sc_catalog_listen || song.primary_ep_url?.trim(),
  )
  const yt = Boolean(song.has_youtube_video)
  if (mode === 'lyrics_sc') return sc && !yt
  if (mode === 'lyrics_yt') return !sc && yt
  if (mode === 'full') return sc && yt
  return true
}

export function sortSongs(songs: SongCatalogItem[], mode: SortMode): SongCatalogItem[] {
  const out = [...songs]
  if (mode === 'plays_total') {
    out.sort((a, b) => b.aggregate_play_count - a.aggregate_play_count || a.lyrics_id.localeCompare(b.lyrics_id))
  } else if (mode === 'plays_peak') {
    out.sort((a, b) => b.peak_play_count - a.peak_play_count || a.lyrics_id.localeCompare(b.lyrics_id))
  } else if (mode === 'likes_total') {
    out.sort((a, b) => b.aggregate_like_count - a.aggregate_like_count || a.lyrics_id.localeCompare(b.lyrics_id))
  } else if (mode === 'likes_peak') {
    out.sort((a, b) => b.peak_like_count - a.peak_like_count || a.lyrics_id.localeCompare(b.lyrics_id))
  } else if (mode === 'title_az') {
    out.sort((a, b) => {
      const cmp = a.lyrics_title.localeCompare(b.lyrics_title, undefined, { sensitivity: 'base' })
      if (cmp !== 0) return cmp
      return a.lyrics_id.localeCompare(b.lyrics_id)
    })
  } else {
    out.sort((a, b) => {
      const sa = String(a.published_at)
      const sb = String(b.published_at)
      const ta = Date.parse(sa)
      const tb = Date.parse(sb)
      if (Number.isFinite(ta) && Number.isFinite(tb) && ta !== tb) {
        return tb - ta
      }
      if (sa !== sb) return sb.localeCompare(sa)
      return a.lyrics_id.localeCompare(b.lyrics_id)
    })
  }
  return out
}
