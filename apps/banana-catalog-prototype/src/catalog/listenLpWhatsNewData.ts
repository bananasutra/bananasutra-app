import type { To } from 'react-router-dom'
import type { SongCatalogItem, TrackCatalogItem } from './types'
import { trackCatalogItemToPlayable } from './playerQueue/playableTrackAdapters'
import type { PlayableTrack } from './playerQueue/types'
import { browseRowHasAudioSection, songCatalogLinkTo } from './songPaths'
import { parseCatalogPublishedAt } from './formatPublishDate'

export const LISTEN_LP_WHATS_NEW_SPOTLIGHT_LIMIT = 3

/** Same weight as `build_artifacts.py` / `discoveryRanking.ts` (plays + likes). */
const LIKE_WEIGHT = 40

function parsePublishedAt(raw: string): number {
  const n = parseCatalogPublishedAt(raw)
  return Number.isFinite(n) ? n : 0
}

function songHasPlayableAudio(song: SongCatalogItem): boolean {
  return Boolean(song.has_in_app_playback || song.has_sc_catalog_listen)
}

function normalizeEpUrl(url: string): string {
  return url.trim().replace(/\/+$/, '').toLowerCase()
}

function latestReleaseEpUrl(song: SongCatalogItem): string {
  const volumes = (song.ep_volumes ?? [])
    .map((v) => ({ volume: Number(v.ep_volume) || 0, url: (v.ep_url || '').trim() }))
    .filter((v) => v.url)
  if (volumes.length >= 2) {
    volumes.sort((a, b) => a.volume - b.volume || a.url.localeCompare(b.url))
    return volumes[volumes.length - 1]!.url
  }
  return (song.primary_ep_url || '').trim() || volumes[0]?.url || ''
}

function scoreSampleTrack(track: TrackCatalogItem): number {
  return track.play_count + LIKE_WEIGHT * track.like_count
}

function rankSampleTracks(tracks: TrackCatalogItem[]): TrackCatalogItem[] {
  return [...tracks].sort(
    (a, b) =>
      scoreSampleTrack(b) - scoreSampleTrack(a) ||
      b.play_count - a.play_count ||
      b.like_count - a.like_count,
  )
}

function indexTracksByLyricsId(catalog: TrackCatalogItem[] | null): Map<string, TrackCatalogItem[]> {
  const map = new Map<string, TrackCatalogItem[]>()
  if (!catalog?.length) return map
  for (const row of catalog) {
    const lyricsId = (row.lyrics_id || '').trim()
    const scUrl = (row.sc_url || '').trim()
    if (!lyricsId || !scUrl) continue
    const list = map.get(lyricsId) ?? []
    list.push(row)
    map.set(lyricsId, list)
  }
  return map
}

function pickBestCatalogTrack(
  song: SongCatalogItem,
  byLyricsId: Map<string, TrackCatalogItem[]>,
): TrackCatalogItem | null {
  const tracks = byLyricsId.get(song.lyrics_id) ?? []
  const inApp = tracks.filter((t) => t.track_in_app)
  const pool = inApp.length ? inApp : tracks
  const latestEp = latestReleaseEpUrl(song)
  const latestKey = latestEp ? normalizeEpUrl(latestEp) : ''
  const onLatest = latestKey
    ? pool.filter((t) => normalizeEpUrl(t.ep_url || '') === latestKey)
    : []
  const ranked = rankSampleTracks(onLatest.length ? onLatest : pool)
  if (ranked[0]) return ranked[0]
  for (const trackId of song.best_track_ids ?? []) {
    const hit = tracks.find((t) => t.track_id === trackId)
    if (hit) return hit
  }
  return tracks[0] ?? null
}

function catalogListenFallbackPlayable(song: SongCatalogItem): PlayableTrack | null {
  const scUrl = (song.sc_catalog_listen_url || '').trim()
  if (!scUrl) return null
  return {
    track_id: `sc-catalog-${song.lyrics_id}`,
    sc_url: scUrl,
    track_title: (song.sc_catalog_track_title || song.lyrics_title).trim(),
    lyrics_title: song.lyrics_title,
    lyrics_id: song.lyrics_id,
    sutra: song.sutra,
    primary_genre: (song.discovery_top_track_genres || song.track_genres[0] || '').trim(),
    lyrics_extract: (song.lyrics_extract || '').trim() || undefined,
    cover_url: (song.cover_image_url || '').trim() || undefined,
    url_slug: song.url_slug,
  }
}

export type ListenLpWhatsNewPick = {
  lyricsId: string
  song: SongCatalogItem
  track: PlayableTrack
  catalogTrack: TrackCatalogItem | null
  songHref: To
}

export function pickWhatsNewSpotlightSongs(
  catalog: SongCatalogItem[] | null,
  limit = LISTEN_LP_WHATS_NEW_SPOTLIGHT_LIMIT,
): SongCatalogItem[] {
  if (!catalog?.length) return []
  return [...catalog]
    .filter((s) => (s.url_slug || '').trim() && (s.cover_image_url || '').trim())
    .filter(songHasPlayableAudio)
    .sort((a, b) => parsePublishedAt(b.published_at) - parsePublishedAt(a.published_at))
    .slice(0, limit)
}

export function buildListenLpWhatsNewPicks(
  songs: SongCatalogItem[],
  trackCatalog: TrackCatalogItem[] | null,
): ListenLpWhatsNewPick[] {
  const byLyricsId = indexTracksByLyricsId(trackCatalog)
  const picks: ListenLpWhatsNewPick[] = []
  for (const song of songs) {
    const catalogTrack = pickBestCatalogTrack(song, byLyricsId)
    const track = catalogTrack
      ? trackCatalogItemToPlayable(catalogTrack)
      : catalogListenFallbackPlayable(song)
    if (!track?.sc_url?.trim()) continue
    picks.push({
      lyricsId: song.lyrics_id,
      song,
      track,
      catalogTrack,
      songHref: songCatalogLinkTo(song.lyrics_title, song.url_slug, {
        section: browseRowHasAudioSection(song) ? 'audio' : undefined,
        trackId: catalogTrack?.track_id,
      }),
    })
  }
  return picks
}
