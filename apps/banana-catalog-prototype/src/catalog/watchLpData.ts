import { LISTEN_LP_SUTRA_FILTER_OPTIONS, type ListenLpSutraFilter } from './listenLpData'
import type { YouTubeCatalogVideo, YouTubePlaylistCatalogItem } from './types'
import { formatDurationDisplay, formatDurationFromSeconds } from './durationFormat'
import { sortYoutubeVideosHubOrder } from './youtubeCatalogFlat'

export const WATCH_LP_META = {
  title: 'Watch',
  description:
    'Picture the songs. Same catalog, eyes open. Recent clips and playlists on the watch door; browse every upload with filters on Videos.',
  lead: 'Picture the songs. Same catalog, eyes open.',
} as const

export const WATCH_LP_PICKS_RAIL_LIMIT = 8
export const WATCH_LP_PLAYLIST_GRID_LIMIT = 12

export type WatchLpSutraFilter = ListenLpSutraFilter

export const WATCH_LP_SUTRA_FILTER_OPTIONS = LISTEN_LP_SUTRA_FILTER_OPTIONS

export type WatchLpPlaylistPick = YouTubePlaylistCatalogItem

/** Pending YT rename + Airtable yt_playlists.sutra sync (WATCH-VIDEOS-IA). */
const WATCH_LP_QUACK_PLAYLIST_IDS = new Set([
  'PLmBA9ODM1xHMxgsW1Sh4GGaZ1WKioQZ0g', // Quack: DUCK (Shady)
  'PLmBA9ODM1xHOiz68fft3F-Tw_GaC0nYz2', // Quack: FOTUS Circus
  'PLmBA9ODM1xHPBTS5-4F6iCrzF0uzm4Nz4', // Quack: MAxxxA Saga
  'PLmBA9ODM1xHN3xHvgvok6BNwHXMpb9idM', // FOTUS CIRCUS (Felon Of The United States)
])

export function resolveWatchLpPlaylistSutra(pl: YouTubePlaylistCatalogItem): string {
  const id = (pl.playlist_id || '').trim()
  if (WATCH_LP_QUACK_PLAYLIST_IDS.has(id)) return 'QUACKsutra'
  return (pl.sutra || '').trim()
}

function playlistGenreLabel(name: string): string {
  return name
    .replace(/\s*\(Best Of\)\s*/gi, '')
    .replace(/\s*sutra\s*/gi, '')
    .trim()
}

export function shortPlaylistDisplayName(name: string): string {
  const idx = (name || '').indexOf(':')
  if (idx >= 0) return name.slice(idx + 1).trim()
  return (name || '').trim()
}

export function watchLpPlaylistKind(pl: YouTubePlaylistCatalogItem): 'songbook' | 'genre' {
  const type = (pl.playlist_type || '').trim().toLowerCase()
  if (type.startsWith('genre')) return 'genre'
  return 'songbook'
}

export function watchLpPlaylistDurationTotal(
  pl: YouTubePlaylistCatalogItem,
  durationByName: Map<string, number>,
): string {
  const name = (pl.playlist_name || '').trim()
  if (!name) return ''
  return formatDurationFromSeconds(durationByName.get(name) ?? 0)
}

export function watchLpPlaylistMetaLine(
  pl: YouTubePlaylistCatalogItem,
  durationByName?: Map<string, number>,
): string {
  const parts: string[] = []
  if (watchLpPlaylistKind(pl) === 'songbook') {
    const sutra = resolveWatchLpPlaylistSutra(pl)
    if (sutra) parts.push(sutra)
  }
  if (pl.video_count) parts.push(`${pl.video_count} videos`)
  if (durationByName) {
    const duration = watchLpPlaylistDurationTotal(pl, durationByName)
    if (duration) parts.push(duration)
  }
  return parts.filter(Boolean).join(' · ')
}

export function watchLpPlaylistEmbedDescription(pl: YouTubePlaylistCatalogItem): string {
  return (pl.featured_description || pl.description || '').trim()
}

export function watchLpVideoMetaLine(video: YouTubeCatalogVideo, inApp: boolean): string {
  const duration = formatDurationDisplay(video.duration)
  const parts = [(video.sutra || '').trim(), duration, (video.content_type || '').trim()].filter(Boolean)
  if (!inApp) parts.push('YouTube-only')
  return parts.join(' · ')
}

/** Compact rail thumb: sutra on one line, duration on the next (no content type). */
export function watchLpVideoRailThumbLines(video: YouTubeCatalogVideo): {
  sutra: string | null
  duration: string | null
} {
  const sutra = (video.sutra || '').trim() || null
  const duration = formatDurationDisplay(video.duration) || null
  return { sutra, duration }
}

function matchesSutraFilter(pl: YouTubePlaylistCatalogItem, sutra: WatchLpSutraFilter): boolean {
  if (sutra === 'ALL') return true
  return resolveWatchLpPlaylistSutra(pl).toUpperCase() === sutra.toUpperCase()
}

function matchesGenreFilter(pl: YouTubePlaylistCatalogItem, genre: string): boolean {
  if (genre === 'ALL') return true
  if (watchLpPlaylistKind(pl) !== 'genre') return false
  const label = playlistGenreLabel(pl.playlist_name)
  if (!label) return false
  return label.toUpperCase() === genre.toUpperCase()
}

export function dedupeWatchPlaylists(playlists: WatchLpPlaylistPick[]): WatchLpPlaylistPick[] {
  const seen = new Set<string>()
  const out: WatchLpPlaylistPick[] = []
  for (const pl of playlists) {
    const id = (pl.playlist_id || '').trim()
    if (!id || seen.has(id)) continue
    seen.add(id)
    out.push(pl)
  }
  return out
}

export function pickSpotlightHero(videos: YouTubeCatalogVideo[]): YouTubeCatalogVideo | null {
  const sorted = sortYoutubeVideosHubOrder(videos)
  return sorted[0] ?? null
}

export function pickRecentClipsRail(
  videos: YouTubeCatalogVideo[],
  heroVideoId: string | null,
): { total: number; shown: YouTubeCatalogVideo[] } {
  const sorted = sortYoutubeVideosHubOrder(videos)
  const pool = heroVideoId ? sorted.filter((v) => v.video_id !== heroVideoId) : sorted
  return {
    total: pool.length,
    shown: pool.slice(0, WATCH_LP_PICKS_RAIL_LIMIT),
  }
}

export function pickFilteredWatchPlaylists(
  playlists: WatchLpPlaylistPick[],
  activeSutra: WatchLpSutraFilter,
  activeGenre: string,
): WatchLpPlaylistPick[] {
  return playlists.filter((pl) => {
    const kind = watchLpPlaylistKind(pl)
    if (kind === 'songbook') {
      if (activeGenre !== 'ALL') return false
      return matchesSutraFilter(pl, activeSutra)
    }
    if (kind === 'genre') {
      if (activeSutra !== 'ALL') return false
      return matchesGenreFilter(pl, activeGenre)
    }
    return false
  })
}

export function pickVisibleWatchPlaylists(pool: WatchLpPlaylistPick[]): {
  total: number
  shown: WatchLpPlaylistPick[]
} {
  const sorted = [...pool].sort((a, b) => (b.video_count || 0) - (a.video_count || 0))
  return {
    total: sorted.length,
    shown: sorted.slice(0, WATCH_LP_PLAYLIST_GRID_LIMIT),
  }
}

export function watchLpGenreFilterOptions(playlists: WatchLpPlaylistPick[]): { value: string; label: string }[] {
  const seen = new Set<string>()
  const options: { value: string; label: string }[] = [{ value: 'ALL', label: 'All' }]
  for (const pl of playlists) {
    if (watchLpPlaylistKind(pl) !== 'genre') continue
    const label = playlistGenreLabel(pl.playlist_name)
    if (!label || seen.has(label.toUpperCase())) continue
    seen.add(label.toUpperCase())
    options.push({ value: label, label })
  }
  return options.sort((a, b) => {
    if (a.value === 'ALL') return -1
    if (b.value === 'ALL') return 1
    return a.label.localeCompare(b.label)
  })
}

export function watchLpFacetStatusText(p: {
  activeSutra: WatchLpSutraFilter
  activeGenre: string
  shownCount: number
  totalCount: number
}): string {
  const parts: string[] = []
  if (p.activeSutra !== 'ALL') {
    const opt = LISTEN_LP_SUTRA_FILTER_OPTIONS.find((o) => o.value === p.activeSutra)
    parts.push(opt?.label ?? p.activeSutra)
  }
  if (p.activeGenre !== 'ALL') parts.push(p.activeGenre)
  const countLabel =
    p.totalCount > p.shownCount
      ? `${p.shownCount} playlists shown of ${p.totalCount}`
      : `${p.shownCount} playlists`
  if (parts.length) return `${parts.join(' · ')} · ${countLabel}`
  return countLabel
}

export function watchLpPlaylistThumbLabel(pl: YouTubePlaylistCatalogItem): string {
  if (watchLpPlaylistKind(pl) === 'genre') return playlistGenreLabel(pl.playlist_name)
  return shortPlaylistDisplayName(pl.playlist_name)
}

export function watchLpRecentClipsNote(total: number, shown: number): string {
  if (!total) return ''
  if (total > shown) return `${shown} of ${total} recent clips.`
  return `${total} recent clips.`
}
