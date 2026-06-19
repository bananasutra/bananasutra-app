import { parseDurationClock } from './durationFormat'
import { loadYoutubeByLyricsId } from './generatedData'
import type { YouTubeCatalogVideo } from './types'

export async function flattenYoutubeCatalogVideos(): Promise<YouTubeCatalogVideo[]> {
  const o = await loadYoutubeByLyricsId()
  return Object.values(o).flat()
}

/** Same row can appear under multiple lyrics buckets — keep one iframe target per `video_id`. */
export function dedupeYoutubeVideosByVideoId(videos: YouTubeCatalogVideo[]): YouTubeCatalogVideo[] {
  const seen = new Set<string>()
  const out: YouTubeCatalogVideo[] = []
  for (const v of videos) {
    const id = (v.video_id || '').trim()
    if (!id || seen.has(id)) continue
    seen.add(id)
    out.push(v)
  }
  return out
}

/** Sum video durations by YT playlist name (from comma-separated `playlist_names`). */
export function buildYoutubePlaylistDurationByName(
  videos: YouTubeCatalogVideo[],
): Map<string, number> {
  const map = new Map<string, number>()
  for (const video of videos) {
    const names = (video.playlist_names || '')
      .split(',')
      .map((name) => name.trim())
      .filter(Boolean)
    const seconds = parseDurationClock(video.duration || '')
    for (const name of names) {
      map.set(name, (map.get(name) ?? 0) + seconds)
    }
  }
  return map
}

/** Matches {@link VideosPage} hub ordering: newest `publish_date`, then lyrics title. */
export function sortYoutubeVideosHubOrder(videos: YouTubeCatalogVideo[]): YouTubeCatalogVideo[] {
  return [...videos].sort((a, b) => {
    const da = a.publish_date || ''
    const db = b.publish_date || ''
    if (da !== db) return db.localeCompare(da)
    return a.lyrics_title.localeCompare(b.lyrics_title, undefined, { sensitivity: 'base' })
  })
}
