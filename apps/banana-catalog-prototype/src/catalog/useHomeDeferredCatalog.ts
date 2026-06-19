import { useEffect, useState } from 'react'
import { catalogDataFileUrl, fetchCatalogData } from './catalogDataUrl'
import type { TrackCatalogItem, YouTubeCatalogVideo } from './types'

export type HomeDeferredCatalog = {
  trackCatalog: TrackCatalogItem[] | null
  youtubeByLyrics: Record<string, YouTubeCatalogVideo[]> | null
  trackLoadError: string | null
  youtubeLoadError: string | null
}

/** Runtime fetch for heavy home slices — matches /listen and /watch LP pattern. */
export function useHomeDeferredCatalog(): HomeDeferredCatalog {
  const [trackCatalog, setTrackCatalog] = useState<TrackCatalogItem[] | null>(null)
  const [youtubeByLyrics, setYoutubeByLyrics] = useState<Record<string, YouTubeCatalogVideo[]> | null>(null)
  const [trackLoadError, setTrackLoadError] = useState<string | null>(null)
  const [youtubeLoadError, setYoutubeLoadError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const loadTrackCatalog = async () => {
      try {
        const r = await fetchCatalogData(catalogDataFileUrl('track_catalog.json'))
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        const rows = (await r.json()) as unknown
        if (!Array.isArray(rows)) throw new Error('Invalid track catalog payload')
        if (!cancelled) {
          setTrackLoadError(null)
          setTrackCatalog(rows as TrackCatalogItem[])
        }
      } catch {
        if (!cancelled) {
          setTrackCatalog(null)
          setTrackLoadError('Could not load track catalog data.')
        }
      }
    }

    const loadYoutubeCatalog = async () => {
      try {
        const r = await fetchCatalogData(catalogDataFileUrl('youtube_by_lyrics_id.json'))
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        const payload = (await r.json()) as unknown
        if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
          throw new Error('Invalid youtube catalog payload')
        }
        if (!cancelled) {
          setYoutubeLoadError(null)
          setYoutubeByLyrics(payload as Record<string, YouTubeCatalogVideo[]>)
        }
      } catch {
        if (!cancelled) {
          setYoutubeByLyrics(null)
          setYoutubeLoadError('Could not load video catalog data.')
        }
      }
    }

    void loadTrackCatalog()
    void loadYoutubeCatalog()

    return () => {
      cancelled = true
    }
  }, [])

  return { trackCatalog, youtubeByLyrics, trackLoadError, youtubeLoadError }
}
