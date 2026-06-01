import { songMatchesMediaCombo } from './filterSongs'
import { filterYoutubeVideosBySearchQuery } from './searchMatch'
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
