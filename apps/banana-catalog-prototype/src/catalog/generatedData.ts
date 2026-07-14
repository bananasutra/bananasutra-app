import { useEffect, useState } from 'react'
import { catalogDataFileUrl, fetchCatalogData } from './catalogDataUrl'
import type {
  MuseCatalogItem,
  QuoteWallItem,
  SongCatalogItem,
  SongDetailRecord,
  SongbookCatalogItem,
  SongEpVolume,
  TrackCatalogItem,
  YouTubeCatalogVideo,
} from './types'

let songCatalogResolved: SongCatalogItem[] | null = null
let songCatalogPromise: Promise<SongCatalogItem[]> | null = null
let songCatalogBrowseResolved: SongCatalogItem[] | null = null
let songCatalogBrowsePromise: Promise<SongCatalogItem[]> | null = null
let songSearchDeepResolved: Record<string, string> | null = null
let songSearchDeepPromise: Promise<Record<string, string>> | null = null
let musesCatalogResolved: MuseCatalogItem[] | null = null
let musesCatalogPromise: Promise<MuseCatalogItem[]> | null = null
let quotesWallResolved: QuoteWallItem[] | null = null
let quotesWallPromise: Promise<QuoteWallItem[]> | null = null
let songbookCatalogResolved: SongbookCatalogItem[] | null = null
let songbookCatalogPromise: Promise<SongbookCatalogItem[]> | null = null
let homeQuotesResolved: QuoteWallItem[] | null = null
let homeQuotesPromise: Promise<QuoteWallItem[]> | null = null

let songDetailResolved: Record<string, SongDetailRecord> | null = null
let songDetailPromise: Promise<Record<string, SongDetailRecord>> | null = null

function normalizeEpVolumes(raw: unknown): SongEpVolume[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((row) => ({
      ep_volume: Number((row as SongEpVolume).ep_volume ?? 0),
      ep_url: String((row as SongEpVolume).ep_url ?? ''),
      ep_title: String((row as SongEpVolume).ep_title ?? ''),
      ep_rating: String((row as SongEpVolume).ep_rating ?? ''),
    }))
    .filter((v) => v.ep_url.trim())
}

function normalizeSongDetailRecord(row: SongDetailRecord): SongDetailRecord {
  return {
    ...row,
    ep_volumes: normalizeEpVolumes(row.ep_volumes),
  }
}

/** One fetch + parse per session; parallel callers share the same promise. */
export async function loadSongCatalog(): Promise<SongCatalogItem[]> {
  if (songCatalogResolved) return songCatalogResolved
  if (!songCatalogPromise) {
    songCatalogPromise = fetchCatalogData(catalogDataFileUrl('song_catalog.json'))
      .then((r) => {
        if (!r.ok) throw new Error(`song_catalog.json: HTTP ${r.status}`)
        return r.json() as Promise<SongCatalogItem[]>
      })
      .then((rows) => {
        songCatalogResolved = Array.isArray(rows) ? rows : []
        return songCatalogResolved
      })
      .catch((e) => {
        songCatalogPromise = null
        throw e
      })
  }
  return songCatalogPromise
}

function normalizeBrowseSongRow(row: Partial<SongCatalogItem>): SongCatalogItem {
  return {
    lyrics_id: String(row.lyrics_id ?? ''),
    lyrics_title: String(row.lyrics_title ?? ''),
    url_slug: String(row.url_slug ?? ''),
    url_slug_locked: Boolean(row.url_slug_locked),
    summary_short: String(row.summary_short ?? ''),
    lyrics_extract: String(row.lyrics_extract ?? ''),
    sutra: String(row.sutra ?? ''),
    topic: String(row.topic ?? ''),
    intention: String(row.intention ?? ''),
    light_shadow: String(row.light_shadow ?? ''),
    cover: Boolean(row.cover),
    public_domain: Boolean(row.public_domain),
    lang: String(row.lang ?? ''),
    written_year: String(row.written_year ?? ''),
    song_in_app: Boolean(row.song_in_app),
    fav: Boolean(row.fav),
    published_at: String(row.published_at ?? ''),
    cover_image_url: String(row.cover_image_url ?? ''),
    track_genres: Array.isArray(row.track_genres) ? row.track_genres : [],
    track_secondary_genres: Array.isArray(row.track_secondary_genres) ? row.track_secondary_genres : [],
    track_instruments: Array.isArray(row.track_instruments) ? row.track_instruments : [],
    track_moods: Array.isArray(row.track_moods) ? row.track_moods : [],
    track_tempo_feels: Array.isArray(row.track_tempo_feels) ? row.track_tempo_feels : [],
    discovery_top_track_genres: String(row.discovery_top_track_genres ?? ''),
    soundcloud_genre_tags: Array.isArray(row.soundcloud_genre_tags) ? row.soundcloud_genre_tags : [],
    track_count_total: Number(row.track_count_total ?? 0),
    track_count_published: Number(row.track_count_published ?? 0),
    track_count_selected: Number(row.track_count_selected ?? 0),
    aggregate_play_count: Number(row.aggregate_play_count ?? 0),
    aggregate_like_count: Number(row.aggregate_like_count ?? 0),
    aggregate_engagement_rate: (() => {
      const raw: unknown = row.aggregate_engagement_rate
      if (typeof raw === 'number' && Number.isFinite(raw)) {
        return raw
      }
      if (typeof raw === 'string' && raw.trim() !== '') {
        const n = Number(raw)
        if (Number.isFinite(n)) return n
      }
      const ap = Number(row.aggregate_play_count ?? 0)
      const al = Number(row.aggregate_like_count ?? 0)
      return ap > 0 ? (al / ap) * 100 : 0
    })(),
    peak_play_count: Number(row.peak_play_count ?? 0),
    peak_like_count: Number(row.peak_like_count ?? 0),
    aggregate_duration_sec: Number(row.aggregate_duration_sec ?? 0),
    best_track_ids: Array.isArray(row.best_track_ids) ? row.best_track_ids : [],
    ep_refs: Array.isArray(row.ep_refs) ? row.ep_refs : [],
    primary_ep_url: String(row.primary_ep_url ?? ''),
    primary_ep_title: String(row.primary_ep_title ?? ''),
    primary_ep_volume: Number(row.primary_ep_volume ?? 0),
    primary_ep_rating: String(row.primary_ep_rating ?? ''),
    ep_volumes: normalizeEpVolumes(row.ep_volumes),
    has_fav_track: Boolean(row.has_fav_track),
    songbook: String(row.songbook ?? ''),
    muse: String(row.muse ?? ''),
    song_muse_quote: String(row.song_muse_quote ?? ''),
    lyrics_notes_excerpt: String(row.lyrics_notes_excerpt ?? ''),
    soundcloud_title_blob: String(row.soundcloud_title_blob ?? ''),
    lyrics_head_search: String(row.lyrics_head_search ?? ''),
    has_in_app_playback: Boolean(row.has_in_app_playback),
    has_sc_catalog_listen: Boolean(row.has_sc_catalog_listen),
    sc_catalog_listen_url: String(row.sc_catalog_listen_url ?? ''),
    sc_catalog_track_title: String(row.sc_catalog_track_title ?? ''),
    sc_catalog_listen_source: String(row.sc_catalog_listen_source ?? ''),
    has_youtube_video: Boolean(row.has_youtube_video),
    has_youtube_embed: Boolean(row.has_youtube_embed),
    lyrics_pipeline_status: String(row.lyrics_pipeline_status ?? ''),
  }
}

/** Smaller browse payload for `/songs` first-paint speed; normalized to SongCatalogItem shape. */
export async function loadSongCatalogBrowse(): Promise<SongCatalogItem[]> {
  if (songCatalogBrowseResolved) return songCatalogBrowseResolved
  if (!songCatalogBrowsePromise) {
    songCatalogBrowsePromise = fetchCatalogData(catalogDataFileUrl('song_catalog_browse.json'))
      .then((r) => {
        if (!r.ok) throw new Error(`song_catalog_browse.json: HTTP ${r.status}`)
        return r.json() as Promise<Partial<SongCatalogItem>[]>
      })
      .then((rows) => {
        songCatalogBrowseResolved = Array.isArray(rows) ? rows.map(normalizeBrowseSongRow) : []
        return songCatalogBrowseResolved
      })
      .catch((e) => {
        songCatalogBrowsePromise = null
        throw e
      })
  }
  return songCatalogBrowsePromise
}

/** Deep meaning text for progressive search (`lyrics_id` -> lyric head). */
export async function loadSongSearchDeep(): Promise<Record<string, string>> {
  if (songSearchDeepResolved) return songSearchDeepResolved
  if (!songSearchDeepPromise) {
    songSearchDeepPromise = fetchCatalogData(catalogDataFileUrl('song_search_deep.json'))
      .then((r) => {
        if (!r.ok) throw new Error(`song_search_deep.json: HTTP ${r.status}`)
        return r.json() as Promise<Record<string, string>>
      })
      .then((obj) => {
        songSearchDeepResolved = obj && typeof obj === 'object' ? obj : {}
        return songSearchDeepResolved
      })
      .catch((e) => {
        songSearchDeepPromise = null
        throw e
      })
  }
  return songSearchDeepPromise
}

export async function loadMusesCatalog(): Promise<MuseCatalogItem[]> {
  if (musesCatalogResolved) return musesCatalogResolved
  if (!musesCatalogPromise) {
    musesCatalogPromise = fetchCatalogData(catalogDataFileUrl('muses_catalog.json'))
      .then((r) => {
        if (!r.ok) throw new Error(`muses_catalog.json: HTTP ${r.status}`)
        return r.json() as Promise<MuseCatalogItem[]>
      })
      .then((rows) => {
        musesCatalogResolved = Array.isArray(rows) ? rows : []
        return musesCatalogResolved
      })
      .catch((e) => {
        musesCatalogPromise = null
        throw e
      })
  }
  return musesCatalogPromise
}

export async function loadQuotesWall(): Promise<QuoteWallItem[]> {
  if (quotesWallResolved) return quotesWallResolved
  if (!quotesWallPromise) {
    quotesWallPromise = fetchCatalogData(catalogDataFileUrl('quotes_wall.json'))
      .then((r) => {
        if (!r.ok) throw new Error(`quotes_wall.json: HTTP ${r.status}`)
        return r.json() as Promise<QuoteWallItem[]>
      })
      .then((rows) => {
        quotesWallResolved = Array.isArray(rows) ? rows : []
        return quotesWallResolved
      })
      .catch((e) => {
        quotesWallPromise = null
        throw e
      })
  }
  return quotesWallPromise
}

export async function loadSongbookCatalog(): Promise<SongbookCatalogItem[]> {
  if (songbookCatalogResolved) return songbookCatalogResolved
  if (!songbookCatalogPromise) {
    songbookCatalogPromise = fetchCatalogData(catalogDataFileUrl('songbook_catalog.json'))
      .then((r) => {
        if (!r.ok) throw new Error(`songbook_catalog.json: HTTP ${r.status}`)
        return r.json() as Promise<SongbookCatalogItem[]>
      })
      .then((rows) => {
        songbookCatalogResolved = Array.isArray(rows) ? rows : []
        return songbookCatalogResolved
      })
      .catch((e) => {
        songbookCatalogPromise = null
        throw e
      })
  }
  return songbookCatalogPromise
}

export async function loadHomeQuotes(): Promise<QuoteWallItem[]> {
  if (homeQuotesResolved) return homeQuotesResolved
  if (!homeQuotesPromise) {
    homeQuotesPromise = fetchCatalogData(catalogDataFileUrl('home_quotes.json'))
      .then((r) => {
        if (!r.ok) throw new Error(`home_quotes.json: HTTP ${r.status}`)
        return r.json() as Promise<QuoteWallItem[]>
      })
      .then((rows) => {
        homeQuotesResolved = Array.isArray(rows) ? rows : []
        return homeQuotesResolved
      })
      .catch((e) => {
        homeQuotesPromise = null
        throw e
      })
  }
  return homeQuotesPromise
}

/** Full lyrics/detail blobs — load only when needed (e.g. song detail route). */
export async function loadSongDetail(): Promise<Record<string, SongDetailRecord>> {
  if (songDetailResolved) return songDetailResolved
  if (!songDetailPromise) {
    songDetailPromise = fetchCatalogData(catalogDataFileUrl('song_detail.json'))
      .then((r) => {
        if (!r.ok) throw new Error(`song_detail.json: HTTP ${r.status}`)
        return r.json() as Promise<Record<string, SongDetailRecord>>
      })
      .then((obj) => {
        const raw = obj && typeof obj === 'object' ? obj : {}
        songDetailResolved = Object.fromEntries(
          Object.entries(raw).map(([id, row]) => [id, normalizeSongDetailRecord(row as SongDetailRecord)]),
        )
        return songDetailResolved
      })
      .catch((e) => {
        songDetailPromise = null
        throw e
      })
  }
  return songDetailPromise
}

export type SongCatalogLoadState = {
  data: SongCatalogItem[] | null
  error: string | null
  loading: boolean
}

export type MusesCatalogLoadState = {
  data: MuseCatalogItem[] | null
  error: string | null
  loading: boolean
}

export type QuotesWallLoadState = {
  data: QuoteWallItem[] | null
  error: string | null
  loading: boolean
}

export type SongbookCatalogLoadState = {
  data: SongbookCatalogItem[] | null
  error: string | null
  loading: boolean
}

/** Mirrors TracksPage track-catalog loading — skips loading UI when cache already warm. */
export function useSongCatalog(): SongCatalogLoadState {
  const [data, setData] = useState<SongCatalogItem[] | null>(() => songCatalogResolved)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(() => !songCatalogResolved)

  useEffect(() => {
    /* BootPrefetch may finish between first paint and this effect — cache warm but hook state still
     * loading:true. Sync from cache instead of returning early with stale state. */
    if (songCatalogResolved) {
      queueMicrotask(() => {
        setData(songCatalogResolved)
        setError(null)
        setLoading(false)
      })
      return
    }
    let cancelled = false
    loadSongCatalog()
      .then((rows) => {
        if (!cancelled) {
          setData(rows)
          setError(null)
          setLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setData(null)
          setError('Could not load song catalog data.')
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  return { data, error, loading }
}

export function useSongCatalogBrowse(): SongCatalogLoadState {
  const [data, setData] = useState<SongCatalogItem[] | null>(() => songCatalogBrowseResolved)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(() => !songCatalogBrowseResolved)

  useEffect(() => {
    if (songCatalogBrowseResolved) {
      queueMicrotask(() => {
        setData(songCatalogBrowseResolved)
        setError(null)
        setLoading(false)
      })
      return
    }
    let cancelled = false
    loadSongCatalogBrowse()
      .then((rows) => {
        if (!cancelled) {
          setData(rows)
          setError(null)
          setLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setData(null)
          setError('Could not load song catalog data.')
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  return { data, error, loading }
}

export function useMusesCatalog(): MusesCatalogLoadState {
  const [data, setData] = useState<MuseCatalogItem[] | null>(() => musesCatalogResolved)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(() => !musesCatalogResolved)

  useEffect(() => {
    if (musesCatalogResolved) {
      queueMicrotask(() => {
        setData(musesCatalogResolved)
        setError(null)
        setLoading(false)
      })
      return
    }
    let cancelled = false
    loadMusesCatalog()
      .then((rows) => {
        if (!cancelled) {
          setData(rows)
          setError(null)
          setLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setData(null)
          setError('Could not load muses data.')
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  return { data, error, loading }
}

export function useQuotesWall(): QuotesWallLoadState {
  const [data, setData] = useState<QuoteWallItem[] | null>(() => quotesWallResolved)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(() => !quotesWallResolved)

  useEffect(() => {
    if (quotesWallResolved) {
      queueMicrotask(() => {
        setData(quotesWallResolved)
        setError(null)
        setLoading(false)
      })
      return
    }
    let cancelled = false
    loadQuotesWall()
      .then((rows) => {
        if (!cancelled) {
          setData(rows)
          setError(null)
          setLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setData(null)
          setError('Could not load quotes data.')
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  return { data, error, loading }
}

export function useSongbookCatalog(): SongbookCatalogLoadState {
  const [data, setData] = useState<SongbookCatalogItem[] | null>(() => songbookCatalogResolved)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(() => !songbookCatalogResolved)

  useEffect(() => {
    if (songbookCatalogResolved) {
      queueMicrotask(() => {
        setData(songbookCatalogResolved)
        setError(null)
        setLoading(false)
      })
      return
    }
    let cancelled = false
    loadSongbookCatalog()
      .then((rows) => {
        if (!cancelled) {
          setData(rows)
          setError(null)
          setLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setData(null)
          setError('Could not load songbook catalog data.')
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  return { data, error, loading }
}

export function useHomeQuotes(): QuotesWallLoadState {
  const [data, setData] = useState<QuoteWallItem[] | null>(() => homeQuotesResolved)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(() => !homeQuotesResolved)

  useEffect(() => {
    if (homeQuotesResolved) {
      queueMicrotask(() => {
        setData(homeQuotesResolved)
        setError(null)
        setLoading(false)
      })
      return
    }
    let cancelled = false
    loadHomeQuotes()
      .then((rows) => {
        if (!cancelled) {
          setData(rows)
          setError(null)
          setLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setData(null)
          setError('Could not load quotes data.')
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  return { data, error, loading }
}

export type SongCatalogDetailLoadState = {
  catalog: SongCatalogItem[] | null
  detailMap: Record<string, SongDetailRecord> | null
  error: string | null
  loading: boolean
}

/** Loads browse + detail payloads (song detail page only). */
export function useSongCatalogAndDetail(): SongCatalogDetailLoadState {
  const [catalog, setCatalog] = useState<SongCatalogItem[] | null>(() => songCatalogResolved)
  const [detailMap, setDetailMap] = useState<Record<string, SongDetailRecord> | null>(() => songDetailResolved)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(() => !(songCatalogResolved && songDetailResolved))

  useEffect(() => {
    if (songCatalogResolved && songDetailResolved) {
      queueMicrotask(() => {
        setCatalog(songCatalogResolved)
        setDetailMap(songDetailResolved)
        setError(null)
        setLoading(false)
      })
      return
    }
    let cancelled = false
    Promise.all([loadSongCatalog(), loadSongDetail()])
      .then(([cat, det]) => {
        if (!cancelled) {
          setCatalog(cat)
          setDetailMap(det)
          setError(null)
          setLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCatalog(null)
          setDetailMap(null)
          setError('Could not load song data.')
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  return { catalog, detailMap, error, loading }
}

let youtubeResolved: Record<string, YouTubeCatalogVideo[]> | null = null
let youtubePromise: Promise<Record<string, YouTubeCatalogVideo[]>> | null = null
let trackCatalogResolved: TrackCatalogItem[] | null = null
let trackCatalogPromise: Promise<TrackCatalogItem[]> | null = null

/** Sync peek for prerendered / already-fetched youtube map (null until resolved). */
export function getYoutubeByLyricsIdSync(): Record<string, YouTubeCatalogVideo[]> | null {
  return youtubeResolved
}

/** Sync peek for prerendered / already-fetched track catalog (null until resolved). */
export function getTrackCatalogSync(): TrackCatalogItem[] | null {
  return trackCatalogResolved
}

/** Grouped YT rows — shared cache for discovery, videos hub, song detail. */
export async function loadYoutubeByLyricsId(): Promise<Record<string, YouTubeCatalogVideo[]>> {
  if (youtubeResolved) return youtubeResolved
  if (!youtubePromise) {
    youtubePromise = fetchCatalogData(catalogDataFileUrl('youtube_by_lyrics_id.json'))
      .then((r) => {
        if (!r.ok) throw new Error(`youtube_by_lyrics_id.json: HTTP ${r.status}`)
        return r.json() as Promise<Record<string, YouTubeCatalogVideo[]>>
      })
      .then((obj) => {
        youtubeResolved = obj && typeof obj === 'object' ? obj : {}
        return youtubeResolved
      })
      .catch((e) => {
        youtubePromise = null
        throw e
      })
  }
  return youtubePromise
}

/** Flat published in-app SC tracks — shared cache for home, /listen, /tracks. */
export async function loadTrackCatalog(): Promise<TrackCatalogItem[]> {
  if (trackCatalogResolved) return trackCatalogResolved
  if (!trackCatalogPromise) {
    trackCatalogPromise = fetchCatalogData(catalogDataFileUrl('track_catalog.json'))
      .then((r) => {
        if (!r.ok) throw new Error(`track_catalog.json: HTTP ${r.status}`)
        return r.json() as Promise<unknown>
      })
      .then((rows) => {
        if (!Array.isArray(rows)) throw new Error('Invalid track catalog payload')
        trackCatalogResolved = rows as TrackCatalogItem[]
        return trackCatalogResolved
      })
      .catch((e) => {
        trackCatalogPromise = null
        throw e
      })
  }
  return trackCatalogPromise
}

/** R24 pre-render: seed module caches from disk (call before `renderToString`). */
export function seedBuildTimeCatalogCaches(data: {
  songCatalog?: SongCatalogItem[]
  songCatalogBrowse?: SongCatalogItem[]
  songDetail?: Record<string, SongDetailRecord>
  songSearchDeep?: Record<string, string>
  muses?: MuseCatalogItem[]
  quotes?: QuoteWallItem[]
  youtubeByLyricsId?: Record<string, YouTubeCatalogVideo[]>
  trackCatalog?: TrackCatalogItem[]
}): void {
  if (data.songCatalog) {
    songCatalogResolved = data.songCatalog
    songCatalogPromise = null
  }
  if (data.songCatalogBrowse) {
    songCatalogBrowseResolved = data.songCatalogBrowse
    songCatalogBrowsePromise = null
  }
  if (data.songDetail) {
    songDetailResolved = data.songDetail
    songDetailPromise = null
  }
  if (data.songSearchDeep) {
    songSearchDeepResolved = data.songSearchDeep
    songSearchDeepPromise = null
  }
  if (data.muses) {
    musesCatalogResolved = data.muses
    musesCatalogPromise = null
  }
  if (data.quotes) {
    quotesWallResolved = data.quotes
    quotesWallPromise = null
  }
  if (data.youtubeByLyricsId) {
    youtubeResolved = data.youtubeByLyricsId
    youtubePromise = null
  }
  if (data.trackCatalog) {
    trackCatalogResolved = data.trackCatalog
    trackCatalogPromise = null
  }
}
