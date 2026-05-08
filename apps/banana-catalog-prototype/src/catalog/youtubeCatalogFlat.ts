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

/** Matches {@link VideosPage} hub ordering: newest `publish_date`, then lyrics title. */
export function sortYoutubeVideosHubOrder(videos: YouTubeCatalogVideo[]): YouTubeCatalogVideo[] {
  return [...videos].sort((a, b) => {
    const da = a.publish_date || ''
    const db = b.publish_date || ''
    if (da !== db) return db.localeCompare(da)
    return a.lyrics_title.localeCompare(b.lyrics_title, undefined, { sensitivity: 'base' })
  })
}
