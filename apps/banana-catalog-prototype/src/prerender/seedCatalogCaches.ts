/**
 * R24 — hydrate in-memory catalog caches before SSR (no runtime fetch during pre-render).
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type {
  MuseCatalogItem,
  QuoteWallItem,
  SongCatalogItem,
  SongDetailRecord,
  TrackCatalogItem,
  YouTubeCatalogVideo,
  YouTubePlaylistCatalogItem,
} from '../catalog/types'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const generatedDir = path.join(__dirname, '../data/generated')

function readJson<T>(filename: string): T {
  return JSON.parse(fs.readFileSync(path.join(generatedDir, filename), 'utf8')) as T
}

/** Mirrors browse normalization in `generatedData.ts`. */
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
    aggregate_engagement_rate: Number(row.aggregate_engagement_rate ?? 0),
    peak_play_count: Number(row.peak_play_count ?? 0),
    peak_like_count: Number(row.peak_like_count ?? 0),
    aggregate_duration_sec: Number(row.aggregate_duration_sec ?? 0),
    best_track_ids: Array.isArray(row.best_track_ids) ? row.best_track_ids : [],
    ep_refs: Array.isArray(row.ep_refs) ? row.ep_refs : [],
    primary_ep_url: String(row.primary_ep_url ?? ''),
    primary_ep_title: String(row.primary_ep_title ?? ''),
    primary_ep_volume: Number(row.primary_ep_volume ?? 0),
    primary_ep_rating: String(row.primary_ep_rating ?? ''),
    ep_volumes: Array.isArray(row.ep_volumes) ? row.ep_volumes : [],
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

export type SeededCatalogData = {
  songCatalog: SongCatalogItem[]
  songCatalogBrowse: SongCatalogItem[]
  songDetail: Record<string, SongDetailRecord>
  songSearchDeep: Record<string, string>
  muses: MuseCatalogItem[]
  quotes: QuoteWallItem[]
  youtubeByLyricsId: Record<string, YouTubeCatalogVideo[]>
  trackCatalog: TrackCatalogItem[]
  youtubePlaylists: YouTubePlaylistCatalogItem[]
}

export function loadSeededCatalogData(): SeededCatalogData {
  const songCatalog = readJson<SongCatalogItem[]>('song_catalog.json')
  const browseRaw = readJson<Partial<SongCatalogItem>[]>('song_catalog_browse.json')
  const trackCatalog = readJson<TrackCatalogItem[]>('track_catalog.json')
  const youtubePlaylists = readJson<YouTubePlaylistCatalogItem[]>('youtube_playlists_catalog.json')
  return {
    songCatalog: Array.isArray(songCatalog) ? songCatalog : [],
    songCatalogBrowse: Array.isArray(browseRaw) ? browseRaw.map(normalizeBrowseSongRow) : [],
    songDetail: readJson<Record<string, SongDetailRecord>>('song_detail.json'),
    songSearchDeep: readJson<Record<string, string>>('song_search_deep.json'),
    muses: readJson<MuseCatalogItem[]>('muses_catalog.json'),
    quotes: readJson<QuoteWallItem[]>('quotes_wall.json'),
    youtubeByLyricsId: readJson<Record<string, YouTubeCatalogVideo[]>>('youtube_by_lyrics_id.json'),
    trackCatalog: Array.isArray(trackCatalog) ? trackCatalog : [],
    youtubePlaylists: Array.isArray(youtubePlaylists) ? youtubePlaylists : [],
  }
}
