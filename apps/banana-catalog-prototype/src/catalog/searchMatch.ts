import type { SongCatalogItem, YouTubeCatalogVideo } from './types'

/** Split user query into lowercase tokens (AND semantics). */
export function searchTokens(raw: string): string[] {
  return raw
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean)
}

/**
 * Tokens that should match if any member appears in the haystack (quirky spellings, common alternates).
 * All strings must be lowercase.
 */
const SYNONYM_GROUPS: readonly (readonly string[])[] = [
  ['politics', 'political', 'politicize', 'politicized', 'poolitics'],
  ['fascism', 'fascist', 'fascists', 'fauxism', 'fauxist', 'fauxists'],
  ['bertrand', 'russell', 'russel'],
  /** Curated political / persona aliases (lyrics often avoid spelling the name in the first ~2.8k chars). */
  ['trump', 'trumping', 'trumped', 'trumps', 'fotus', 'don jr', 'donnie', 'vladdy'],
  ['femme', 'femmes'],
]

const TOKEN_TO_SYNONYM_ALIASES: Map<string, readonly string[]> = (() => {
  const m = new Map<string, readonly string[]>()
  for (const group of SYNONYM_GROUPS) {
    const expanded = [...new Set(group)]
    for (const t of group) {
      m.set(t, expanded)
    }
  }
  return m
})()

function variantsForToken(token: string): readonly string[] {
  return TOKEN_TO_SYNONYM_ALIASES.get(token) ?? [token]
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Match a variant as a whole token in haystack (ASCII letter/digit boundaries).
 * - Avoids `trump` matching inside `trumpet` / `trumpets` while still allowing trump, trumps, trumped, trumping.
 * - Simple English plural fold: `dog` matches `dogs` and vice versa; still avoids `dog` inside `dogma`.
 * - Multi-word variants (e.g. "don jr") use flexible whitespace.
 */
function variantMatchesInHaystack(h: string, v: string): boolean {
  const trimmed = v.trim().toLowerCase()
  if (!trimmed) return false

  if (/\s/.test(trimmed)) {
    const parts = trimmed.split(/\s+/).map(escapeRegex).join('\\s+')
    return new RegExp(`(?<![a-z0-9])${parts}(?![a-z0-9])`, 'i').test(h)
  }

  if (/^trump(s|ing|ed)?$/i.test(trimmed)) {
    return /\btrump(?!et)(?:s|ing|ed)?\b/i.test(h)
  }

  const esc = escapeRegex(trimmed)
  /** Simple English singular/plural at token boundaries (e.g. dog ↔ dogs; still rejects dog ⊂ dogma). */
  if (trimmed.endsWith('s') && trimmed.length >= 4 && !trimmed.endsWith('ss')) {
    const stem = trimmed.slice(0, -1)
    const escStem = escapeRegex(stem)
    return new RegExp(`(?<![a-z0-9])(?:${esc}|${escStem})(?![a-z0-9])`, 'i').test(h)
  }
  return new RegExp(`(?<![a-z0-9])${esc}s?(?![a-z0-9])`, 'i').test(h)
}

function haystack(song: SongCatalogItem, deepLyricsText = ''): string {
  const parts: string[] = [
    song.lyrics_title,
    song.summary_short,
    song.lyrics_extract ?? '',
    song.sutra,
    song.topic,
    song.intention,
    song.light_shadow,
    song.lang,
    song.written_year,
    song.songbook ?? '',
    song.muse ?? '',
    song.song_muse_quote ?? '',
    song.lyrics_head_search ?? '',
    deepLyricsText,
    String(song.aggregate_play_count),
    String(song.aggregate_like_count),
    String(song.peak_play_count),
    String(song.peak_like_count),
  ]
  // Omit SoundCloud track/EP title blobs and genre tag fields: those segments often repeat style words
  // (e.g. “Poetry” in a DUB persona) and create topical false positives. Use catalog filters for genre.
  return parts.join(' ').toLowerCase()
}

/** Same fields as `haystack` but omits long lyric / EP curatorial blobs — Top Tracks tab meaning slice only. */
function haystackSansNotesForTopTracks(song: SongCatalogItem): string {
  const parts: string[] = [
    song.lyrics_title,
    song.summary_short,
    song.lyrics_extract ?? '',
    song.sutra,
    song.topic,
    song.intention,
    song.light_shadow,
    song.lang,
    song.written_year,
    song.songbook ?? '',
    song.muse ?? '',
    song.song_muse_quote ?? '',
    String(song.aggregate_play_count),
    String(song.aggregate_like_count),
    String(song.peak_play_count),
    String(song.peak_like_count),
  ]
  return parts.join(' ').toLowerCase()
}

function haystackIncludesAnyVariant(h: string, token: string): boolean {
  for (const v of variantsForToken(token)) {
    if (variantMatchesInHaystack(h, v)) return true
  }
  return false
}

/**
 * Count of query tokens that match as whole tokens in `lyrics_title` (same boundary rules as body search).
 * Used to surface title-strong hits in discovery previews while keeping popularity as the next sort key.
 */
export function countTitleTokenMatches(song: SongCatalogItem, tokens: string[]): number {
  if (tokens.length === 0) return 0
  const title = (song.lyrics_title || '').toLowerCase()
  let n = 0
  for (const t of tokens) {
    if (haystackIncludesAnyVariant(title, t)) n += 1
  }
  return n
}

/** Every token must match via substring (or synonym group) somewhere on the card search text. */
export function songMatchesSearchTokens(song: SongCatalogItem, tokens: string[], deepLyricsText = ''): boolean {
  if (tokens.length === 0) return false
  const h = haystack(song, deepLyricsText)
  return tokens.every((t) => haystackIncludesAnyVariant(h, t))
}

export function filterSongsBySearchQuery(songs: SongCatalogItem[], query: string): SongCatalogItem[] {
  const tokens = searchTokens(query)
  if (tokens.length === 0) return []
  return songs.filter((s) => songMatchesSearchTokens(s, tokens))
}

/**
 * Songbooks discovery — “does this *song’s* songbook line or surface text suggest the query?”
 * Includes capped opening lyrics so a book like “Play: FANANA (party)” can surface when a member
 * song mentions the term in lyrics, not only when the Airtable songbook string itself contains it.
 */
function albumHaystack(song: SongCatalogItem): string {
  return [
    song.songbook ?? '',
    song.lyrics_title,
    song.summary_short,
    song.lyrics_extract ?? '',
    song.lyrics_head_search ?? '',
  ]
    .join(' ')
    .toLowerCase()
}

function trackHaystack(song: SongCatalogItem): string {
  return [
    ...song.track_genres,
    ...song.track_secondary_genres,
    ...(song.track_instruments ?? []),
    ...(song.track_moods ?? []),
    ...(song.track_tempo_feels ?? []),
    song.discovery_top_track_genres ?? '',
  ]
    .join(' ')
    .toLowerCase()
}

/** Catalog track tags only (genres, instruments, moods, tempo, headline split) — no SC blob. */
function structuredTrackCatalogGenreHaystack(song: SongCatalogItem): string {
  const head = (song.discovery_top_track_genres ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  const parts = [
    ...song.track_genres,
    ...song.track_secondary_genres,
    ...head,
    ...(song.track_instruments ?? []),
    ...(song.track_moods ?? []),
    ...(song.track_tempo_feels ?? []),
  ]
  return parts.join(' ').toLowerCase()
}

/** Meaning (sans long lyric/EP blobs) + SC titles/genres — Top Tracks discovery. */
function topTracksTabHaystack(song: SongCatalogItem): string {
  return `${haystackSansNotesForTopTracks(song)} ${trackHaystack(song)}`
}

function matchesHaystack(h: string, tokens: string[]): boolean {
  if (tokens.length === 0) return false
  return tokens.every((t) => haystackIncludesAnyVariant(h, t))
}

/** Songbook / title / summary — “Albums” discovery tab. */
export function filterSongsByAlbumSearchQuery(songs: SongCatalogItem[], query: string): SongCatalogItem[] {
  const tokens = searchTokens(query)
  if (tokens.length === 0) return []
  return songs.filter((s) => matchesHaystack(albumHaystack(s), tokens))
}

function tokensAreAllInFacetSet(tokens: string[], facetValuesLower: ReadonlySet<string>): boolean {
  if (tokens.length === 0) return false
  return tokens.every((t) => facetValuesLower.has(t))
}

export type TrackSearchFilterOpts = {
  /**
   * Lowercased facet `value`s from `track_genre`, `track_secondary_genre`, `track_mood`,
   * `track_instrument`, and `track_tempo_feel` in `facets.json`.
   * When **every** query token is in this set, Top Tracks requires each token to match **structured**
   * catalog tags (`track_genres`, `track_secondary_genres`, `discovery_top_track_genres` headline split,
   * `track_instruments`, `track_moods`, `track_tempo_feels`) — not SC blob / notes alone — so tag-shaped
   * queries do not surface EP copy hits without catalog tags.
   */
  strictGenreFacetTokens?: ReadonlySet<string>
}

/** “Top tracks” tab — meaning (sans long lyric/EP blobs) + catalog track tags. Optional strict facet gate (see opts). */
export function filterSongsByTrackSearchQuery(
  songs: SongCatalogItem[],
  query: string,
  opts?: TrackSearchFilterOpts,
): SongCatalogItem[] {
  const tokens = searchTokens(query)
  if (tokens.length === 0) return []
  const strict = opts?.strictGenreFacetTokens
  const base = songs.filter((s) => matchesHaystack(topTracksTabHaystack(s), tokens))
  if (strict && tokensAreAllInFacetSet(tokens, strict)) {
    return base.filter((s) => matchesHaystack(structuredTrackCatalogGenreHaystack(s), tokens))
  }
  return base
}

/**
 * Tokens match SC title / genre haystack but not the full meaning-card haystack.
 * Used by discovery smart-default tab: “sound-led” hint (e.g. genre tokens without topical line match).
 */
export function songLedByTrackLayerNotFullMeaning(song: SongCatalogItem, tokens: string[]): boolean {
  if (tokens.length === 0) return false
  return matchesHaystack(trackHaystack(song), tokens) && !matchesHaystack(haystackSansNotesForTopTracks(song), tokens)
}

/** Broad “see all on /songs?find=” — matches meaning, songbook, or track surfaces for the same query. */
export function songMatchesFindAny(
  song: SongCatalogItem,
  query: string,
  deepLyricsById?: Record<string, string>,
): boolean {
  const tokens = searchTokens(query)
  if (tokens.length === 0) return true
  const lid = (song.lyrics_id || '').trim()
  const deepLyricsText = lid && deepLyricsById ? deepLyricsById[lid] ?? '' : ''
  return songMatchesSearchTokens(song, tokens, deepLyricsText) || matchesHaystack(albumHaystack(song), tokens)
}

export function filterSongsByFindAnyQuery(
  songs: SongCatalogItem[],
  query: string,
  deepLyricsById?: Record<string, string>,
): SongCatalogItem[] {
  const q = query.trim()
  if (!q) return songs
  return songs.filter((s) => songMatchesFindAny(s, q, deepLyricsById))
}

function youtubeHaystack(video: YouTubeCatalogVideo): string {
  return [
    video.title,
    video.lyrics_title,
    video.sutra,
    video.genre_primary,
    video.genre_secondary,
    video.playlist_names,
    video.content_type,
    video.duration,
    video.format,
    video.topic_categories,
    video.song_topic,
    video.song_intention,
  ]
    .join(' ')
    .toLowerCase()
}

/** Discovery “Videos” tab — AND token match on title, linked lyrics title, sutra, playlists. */
export function filterYoutubeVideosBySearchQuery(videos: YouTubeCatalogVideo[], query: string): YouTubeCatalogVideo[] {
  const tokens = searchTokens(query)
  if (tokens.length === 0) return []
  return videos.filter((v) => matchesHaystack(youtubeHaystack(v), tokens))
}
