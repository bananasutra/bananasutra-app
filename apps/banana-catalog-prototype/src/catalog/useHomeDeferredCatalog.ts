import { useEffect, useState } from 'react'
import {
  getTrackCatalogSync,
  getYoutubeByLyricsIdSync,
  loadTrackCatalog,
  loadYoutubeByLyricsId,
} from './generatedData'
import type { TrackCatalogItem, YouTubeCatalogVideo } from './types'

export type HomeDeferredCatalog = {
  trackCatalog: TrackCatalogItem[] | null
  youtubeByLyrics: Record<string, YouTubeCatalogVideo[]> | null
  trackLoadError: string | null
  youtubeLoadError: string | null
}

/** Heavy home slices — prefers build-time/module caches (R24) then runtime fetch. */
export function useHomeDeferredCatalog(): HomeDeferredCatalog {
  const [trackCatalog, setTrackCatalog] = useState<TrackCatalogItem[] | null>(() => getTrackCatalogSync())
  const [youtubeByLyrics, setYoutubeByLyrics] = useState<Record<string, YouTubeCatalogVideo[]> | null>(
    () => getYoutubeByLyricsIdSync(),
  )
  const [trackLoadError, setTrackLoadError] = useState<string | null>(null)
  const [youtubeLoadError, setYoutubeLoadError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    if (!getTrackCatalogSync()) {
      void loadTrackCatalog()
        .then((rows) => {
          if (!cancelled) {
            setTrackLoadError(null)
            setTrackCatalog(rows)
          }
        })
        .catch(() => {
          if (!cancelled) {
            setTrackCatalog(null)
            setTrackLoadError('Could not load track catalog data.')
          }
        })
    } else {
      setTrackCatalog(getTrackCatalogSync())
      setTrackLoadError(null)
    }

    if (!getYoutubeByLyricsIdSync()) {
      void loadYoutubeByLyricsId()
        .then((payload) => {
          if (!cancelled) {
            setYoutubeLoadError(null)
            setYoutubeByLyrics(payload)
          }
        })
        .catch(() => {
          if (!cancelled) {
            setYoutubeByLyrics(null)
            setYoutubeLoadError('Could not load video catalog data.')
          }
        })
    } else {
      setYoutubeByLyrics(getYoutubeByLyricsIdSync())
      setYoutubeLoadError(null)
    }

    return () => {
      cancelled = true
    }
  }, [])

  return { trackCatalog, youtubeByLyrics, trackLoadError, youtubeLoadError }
}
