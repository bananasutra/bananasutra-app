import { songMatchesMediaCombo } from './filterSongs'
import { filterYoutubeVideosBySearchQuery } from './searchMatch'
import { browsePathWithQuery } from './seoPaths'
import type { SongCatalogItem, YouTubeCatalogVideo } from './types'

export type VideoMediaFilter = 'all' | 'has_sc'
export type VideoCardLinkTarget = 'all' | 'in_app' | 'off_site'
export type VideosUrlFilters = {
  find: string
  sutra: string
  topic: string
  intention: string
  linkTarget: VideoCardLinkTarget
  media: VideoMediaFilter
  page: number
}

/** Returns true when the video's linked song is also available on SoundCloud. */
export function videoLinkedSongHasSC(v: YouTubeCatalogVideo, songs: Map<string, SongCatalogItem>): boolean {
  const lid = (v.lyrics_id || '').trim()
  const song = lid ? songs.get(lid) : undefined
  if (!song) return false
  return songMatchesMediaCombo(song, 'lyrics_sc') || songMatchesMediaCombo(song, 'full')
}

export function applyVideoFilters(
  videos: YouTubeCatalogVideo[],
  f: VideosUrlFilters,
  inAppIds: Set<string>,
  songsByLyricsId: Map<string, SongCatalogItem>,
): YouTubeCatalogVideo[] {
  let out = videos
  if (f.media === 'has_sc') {
    out = out.filter((v) => videoLinkedSongHasSC(v, songsByLyricsId))
  }
  if (f.linkTarget === 'in_app') {
    out = out.filter((v) => inAppIds.has(v.lyrics_id))
  } else if (f.linkTarget === 'off_site') {
    out = out.filter((v) => !inAppIds.has(v.lyrics_id))
  }
  if (f.sutra) {
    const s = f.sutra.toLowerCase()
    out = out.filter((v) => (v.sutra || '').trim().toLowerCase() === s)
  }
  if (f.topic) {
    out = out.filter((v) => (v.song_topic || '').trim() === f.topic)
  }
  if (f.intention) {
    out = out.filter((v) => (v.song_intention || '').trim() === f.intention)
  }
  if (f.find) {
    out = filterYoutubeVideosBySearchQuery(out, f.find)
  }
  return out
}

function readLinkTarget(searchParams: URLSearchParams): VideoCardLinkTarget {
  const raw = (searchParams.get('link') ?? '').trim().toLowerCase()
  if (raw === 'in_app' || raw === 'song') return 'in_app'
  if (raw === 'off_site' || raw === 'youtube' || raw === 'external') return 'off_site'
  if (searchParams.get('catalog') === '1') return 'in_app'
  return 'all'
}

function readVideoMediaFilter(searchParams: URLSearchParams): VideoMediaFilter {
  const raw = (searchParams.get('media') ?? '').trim().toLowerCase()
  if (raw === 'has_sc') return 'has_sc'
  if (raw === 'any') return 'all'
  return 'all'
}

export function readVideosFiltersFromParams(searchParams: URLSearchParams): VideosUrlFilters {
  return {
    find: (searchParams.get('find') ?? '').trim(),
    sutra: (searchParams.get('sutra') ?? '').trim(),
    topic: (searchParams.get('topic') ?? '').trim(),
    intention: (searchParams.get('intention') ?? '').trim(),
    linkTarget: readLinkTarget(searchParams),
    media: readVideoMediaFilter(searchParams),
    page: Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1),
  }
}

export function videosFiltersToQueryString(f: VideosUrlFilters): string {
  const p = new URLSearchParams()
  if (f.find) p.set('find', f.find)
  if (f.sutra) p.set('sutra', f.sutra)
  if (f.topic) p.set('topic', f.topic)
  if (f.intention) p.set('intention', f.intention)
  if (f.linkTarget === 'in_app') p.set('link', 'in_app')
  else if (f.linkTarget === 'off_site') p.set('link', 'off_site')
  if (f.media && f.media !== 'all') p.set('media', f.media)
  if (f.page > 1) p.set('page', String(f.page))
  const s = p.toString()
  return s ? `?${s}` : ''
}

export function hrefVideos(partial: Partial<VideosUrlFilters>, base: VideosUrlFilters): string {
  const merged: VideosUrlFilters = { ...base, ...partial }
  const keys = Object.keys(partial) as (keyof VideosUrlFilters)[]
  if (keys.some((k) => k !== 'page')) merged.page = 1
  return browsePathWithQuery('/videos', videosFiltersToQueryString(merged).replace(/^\?/, ''))
}
