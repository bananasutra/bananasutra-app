import type { To } from 'react-router-dom'
import chromeStatsJson from '../data/generated/catalog_chrome_stats.json'
import songCatalogBrowseJson from '../data/generated/song_catalog_browse.json'
import trackCatalogJson from '../data/generated/track_catalog.json'
import youtubeByLyricsJson from '../data/generated/youtube_by_lyrics_id.json'
import type { SongCatalogItem, TrackCatalogItem, YouTubeCatalogVideo } from './types'
import { songCatalogLinkTo } from './songPaths'
import { dedupeYoutubeVideosByVideoId } from './youtubeCatalogFlat'
import {
  SUTRA_CONTEXT,
  SUTRA_INDEX_CORE_ORDER,
  type SutraFamilyKey,
  sutraHrefForFamily,
} from './sutraContext'

/** Curated pool (~15) — one pick per visit (day-hash, matches W-064 prototype). */
export const HERO_QUOTE_SLUGS = [
  'ego-ain-t-your-amigo',
  'a-man-s-a-man-and-a-that',
  'broken-whole-encore',
  'the-courage-to-care',
  'camus-dit-oui',
  'no-i-m-not-being-political-circa-2026',
  'what-s-behind-every-door',
  'grifters',
  'the-sound-of-logic',
  'tell-the-truth',
  'it-s-an-ethical-paradox',
  'the-love-of-a-dove',
  'drop-di-baggage',
  'the-great-naked-king',
  'we-re-tiny-specks-right',
] as const

/** Feeling lucky strip — square covers in a responsive grid (wireframe §4). */
export const HOME_COVER_STRIP_COUNT = 11

/** Latest drops on home — 2×2 grid beside top-5 player (wireframe §3). */
export const HOME_LATEST_DROPS_LIMIT = 4

/** Video teaser cards on home (wireframe §6). */
export const HOME_VIDEO_TEASER_LIMIT = 3

const HOME_BROWSE = songCatalogBrowseJson as SongCatalogItem[]
const HOME_TRACKS = trackCatalogJson as TrackCatalogItem[]
const YT_BY_LYRICS = youtubeByLyricsJson as Record<string, YouTubeCatalogVideo[]>

const BROWSE_BY_SLUG = new Map(HOME_BROWSE.map((s) => [(s.url_slug || '').trim(), s]))

export type HomeHeroQuote = {
  slug: string
  title: string
  sutra: string
  extract: string
  href: To
}

export type HomeListenDoorPreview = {
  title: string
  art: string
  sutra: string
  plays: number
  href: To
}

export type HomeWatchDoorPreview = {
  videoId: string
  title: string
  thumbnail: string
  href: To
}

export type HomeDropRow = {
  title: string
  slug: string
  sutra: string
  art: string
  extract: string
  publishedAt: string
  href: To
}

export type HomeCoverTile = {
  title: string
  slug: string
  art: string
  href: To
}

export type HomeSutraCard = {
  key: SutraFamilyKey
  name: string
  cardEssence: string
  when: string
  href: string
  subOf?: string
}

export type HomeListenerFavorite = {
  rank: number
  trackId: string
  title: string
  slug: string
  sutra: string
  genre: string
  duration: string
  plays: number
  art: string
  scUrl: string
  href: To
}

export type HomeVideoTeaser = {
  videoId: string
  title: string
  sutra: string
  thumbnail: string
  href: To
}

export type HomeStatsSummaryItem = {
  value: number
  label: string
  href: string
  ariaLabel: string
}

export function hashString(input: string): number {
  let hash = 0
  for (let idx = 0; idx < input.length; idx += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(idx)
    hash |= 0
  }
  return Math.abs(hash)
}

export function formatHomeCount(n: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(n || 0)
}

export function formatHomeShortDate(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function formatHeroExtract(raw: string): string {
  return raw.trim().replace(/\s*\/\s*/g, '… ')
}

function parsePublishedAt(raw: string): number {
  const n = Date.parse((raw || '').trim())
  return Number.isNaN(n) ? 0 : n
}

function songHasReleasedListenerAudio(s: SongCatalogItem): boolean {
  return Boolean(s.has_in_app_playback || s.has_sc_catalog_listen || (s.primary_ep_url || '').trim())
}

function songHasReleasedVideo(s: SongCatalogItem): boolean {
  return Boolean(s.has_youtube_video)
}

function songHasAudioOrVideo(s: SongCatalogItem): boolean {
  return songHasReleasedListenerAudio(s) || songHasReleasedVideo(s)
}

function trimHeroQuote(slug: string): HomeHeroQuote | null {
  const s = BROWSE_BY_SLUG.get(slug)
  if (!s || !(s.lyrics_extract || '').trim()) return null
  return {
    slug,
    title: s.lyrics_title,
    sutra: s.sutra,
    extract: formatHeroExtract(s.lyrics_extract),
    href: songCatalogLinkTo(s.lyrics_title, s.url_slug),
  }
}

export function buildHeroQuotePool(): HomeHeroQuote[] {
  return HERO_QUOTE_SLUGS.map(trimHeroQuote).filter((q): q is HomeHeroQuote => Boolean(q))
}

/** Day-hash pick — stable for a calendar day (legacy / non-home surfaces). */
export function pickHeroQuoteForVisit(quotes: HomeHeroQuote[]): HomeHeroQuote | null {
  if (!quotes.length) return null
  const dayKey = new Date().toISOString().slice(0, 10)
  const idx = hashString(dayKey) % quotes.length
  return quotes[idx] ?? null
}

/** Random pick on each page load (home hero). */
export function pickRandomHeroQuote(quotes: HomeHeroQuote[]): HomeHeroQuote | null {
  if (!quotes.length) return null
  const idx = Math.floor(Math.random() * quotes.length)
  return quotes[idx] ?? null
}

export function pickListenDoorPreview(): HomeListenDoorPreview | null {
  const top = [...HOME_TRACKS]
    .filter((t) => (t.url_slug || '').trim() && t.play_count > 0)
    .sort((a, b) => b.play_count - a.play_count)[0]
  if (!top) return null
  const song = BROWSE_BY_SLUG.get((top.url_slug || '').trim())
  const art = (song?.cover_image_url || top.list_cover_url || '').trim()
  if (!art) return null
  return {
    title: top.lyrics_title || top.track_title,
    art,
    sutra: top.sutra || song?.sutra || '',
    plays: top.play_count || 0,
    href: songCatalogLinkTo(top.lyrics_title, top.url_slug),
  }
}

function flattenYoutubeVideos(): YouTubeCatalogVideo[] {
  const rows: YouTubeCatalogVideo[] = []
  Object.values(YT_BY_LYRICS).forEach((arr) => {
    arr.forEach((v) => rows.push(v))
  })
  return rows
}

export function pickWatchDoorPreview(): HomeWatchDoorPreview | null {
  const rows = flattenYoutubeVideos()
    .filter((v) => (v.url_slug || '').trim() && (v.thumbnail_url || '').trim())
    .map((v) => ({
      videoId: v.video_id,
      title: v.lyrics_title || v.title,
      thumbnail: v.thumbnail_url,
      href: songCatalogLinkTo(v.lyrics_title, v.url_slug),
      publishDate: v.publish_date || '',
      featured: Boolean(v.video_featured),
    }))
    .sort((a, b) => {
      if (a.featured !== b.featured) return a.featured ? -1 : 1
      return (b.publishDate || '').localeCompare(a.publishDate || '')
    })
  const pick = rows[0]
  if (!pick) return null
  return {
    videoId: pick.videoId,
    title: pick.title,
    thumbnail: pick.thumbnail,
    href: pick.href,
  }
}

export function buildLatestDrops(limit = 3): HomeDropRow[] {
  return [...HOME_BROWSE]
    .filter((s) => s.url_slug && s.cover_image_url && songHasAudioOrVideo(s) && parsePublishedAt(s.published_at) > 0)
    .sort((a, b) => parsePublishedAt(b.published_at) - parsePublishedAt(a.published_at))
    .slice(0, limit)
    .map((s) => ({
      title: s.lyrics_title,
      slug: s.url_slug,
      sutra: s.sutra,
      art: s.cover_image_url,
      extract: (s.lyrics_extract || s.summary_short || '').trim(),
      publishedAt: s.published_at,
      href: songCatalogLinkTo(s.lyrics_title, s.url_slug),
    }))
}

export function buildCoverPool(): HomeCoverTile[] {
  return HOME_BROWSE.filter((s) => s.url_slug && s.cover_image_url).map((s) => ({
    title: s.lyrics_title,
    slug: s.url_slug,
    art: s.cover_image_url,
    href: songCatalogLinkTo(s.lyrics_title, s.url_slug),
  }))
}

export function shuffleCoverStrip(pool: HomeCoverTile[], seed: string, count = HOME_COVER_STRIP_COUNT): HomeCoverTile[] {
  const copy = [...pool]
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = hashString(`${seed}:${i}`) % (i + 1)
    const tmp = copy[i]!
    copy[i] = copy[j]!
    copy[j] = tmp
  }
  return copy.slice(0, count)
}

export function buildSutraCards(): HomeSutraCard[] {
  const cards: HomeSutraCard[] = SUTRA_INDEX_CORE_ORDER.map((key) => {
    const e = SUTRA_CONTEXT[key]
    if (!e) return null
    return {
      key,
      name: e.sutra,
      cardEssence: e.sutra_card_essence,
      when: e.sutra_when,
      href: sutraHrefForFamily(key),
    }
  }).filter((c): c is HomeSutraCard => Boolean(c))

  const quack = SUTRA_CONTEXT.QUACK
  if (quack) {
    cards.push({
      key: 'QUACK',
      name: quack.sutra,
      cardEssence: quack.sutra_card_essence,
      when: quack.sutra_when,
      href: sutraHrefForFamily('QUACK'),
      subOf: 'sub of BLOW',
    })
  }

  return cards
}

export function buildHomeVideoTeasers(limit = HOME_VIDEO_TEASER_LIMIT): HomeVideoTeaser[] {
  return pickRandomHomeVideoTeasers(limit)
}

/** YouTube mqdefault is always 16:9 (320×180). */
export function youtubeVideoThumb16x9(videoId: string, fallback = ''): string {
  const id = (videoId || '').trim()
  return id ? `https://i.ytimg.com/vi/${id}/mqdefault.jpg` : fallback
}

function shuffleHomeVideoPool<T>(items: T[]): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    const tmp = copy[i]!
    copy[i] = copy[j]!
    copy[j] = tmp
  }
  return copy
}

/** Random video teaser picks on each page load. */
export function pickRandomHomeVideoTeasers(limit = HOME_VIDEO_TEASER_LIMIT): HomeVideoTeaser[] {
  const rows = dedupeYoutubeVideosByVideoId(flattenYoutubeVideos()).filter(
    (v) => (v.url_slug || '').trim() && (v.video_id || '').trim(),
  )
  return shuffleHomeVideoPool(rows)
    .slice(0, limit)
    .map((v) => ({
      videoId: v.video_id,
      title: v.lyrics_title || v.title,
      sutra: (v.sutra || '').trim(),
      thumbnail: youtubeVideoThumb16x9(v.video_id, v.thumbnail_url),
      href: songCatalogLinkTo(v.lyrics_title, v.url_slug, { section: 'video' }),
    }))
}

function countCatalogVideos(): number {
  const seen = new Set<string>()
  flattenYoutubeVideos().forEach((v) => {
    const id = (v.video_id || '').trim()
    if (id) seen.add(id)
  })
  return seen.size
}

/** Bottom stats row — echoes header counts plus videos (wireframe §7). */
export function buildHomeStatsSummary(): HomeStatsSummaryItem[] {
  const stats = chromeStatsJson as {
    sutraCount: number
    songbookCount: number
    songCount: number
    topTrackCount: number
  }
  const videoCount = countCatalogVideos()
  return [
    {
      value: stats.sutraCount,
      label: 'Sutras',
      href: '/sutras/',
      ariaLabel: `${formatHomeCount(stats.sutraCount)} sutras`,
    },
    {
      value: stats.songbookCount,
      label: 'Songbooks',
      href: '/songbooks/',
      ariaLabel: `${formatHomeCount(stats.songbookCount)} songbooks`,
    },
    {
      value: stats.songCount,
      label: 'Songs',
      href: '/songs/',
      ariaLabel: `${formatHomeCount(stats.songCount)} songs`,
    },
    {
      value: stats.topTrackCount,
      label: 'Tracks',
      href: '/tracks/',
      ariaLabel: `${formatHomeCount(stats.topTrackCount)} tracks`,
    },
    {
      value: videoCount,
      label: 'Videos',
      href: '/videos/',
      ariaLabel: `${formatHomeCount(videoCount)} videos`,
    },
  ]
}

export function buildListenerFavorites(limit = 5): HomeListenerFavorite[] {
  const seen = new Set<string>()
  const rows: HomeListenerFavorite[] = []
  for (const t of [...HOME_TRACKS].filter((x) => x.url_slug && x.play_count).sort((a, b) => b.play_count - a.play_count)) {
    const slug = (t.url_slug || '').trim()
    if (seen.has(slug)) continue
    seen.add(slug)
    const song = BROWSE_BY_SLUG.get(slug)
    rows.push({
      rank: rows.length + 1,
      trackId: t.track_id,
      title: t.lyrics_title || t.track_title,
      slug,
      sutra: t.sutra || song?.sutra || '',
      genre: (t.primary_genre || '').trim(),
      duration: (t.duration_raw || '').trim(),
      plays: t.play_count || 0,
      art: (song?.cover_image_url || t.list_cover_url || '').trim(),
      scUrl: (t.sc_url || '').trim(),
      href: songCatalogLinkTo(t.lyrics_title, t.url_slug),
    })
    if (rows.length >= limit) break
  }
  return rows
}

export function sutraCardToneClass(key: SutraFamilyKey): string {
  return `home-sutra-card--${key.toLowerCase()}`
}
