export type SortMode =
  | 'newest'
  | 'title_az'
  | 'plays_total'
  | 'plays_peak'
  | 'likes_total'
  | 'likes_peak'

export type FacetEntry = { value: string; count: number }

/** `location.state` when opening a song from `/words` — breadcrumbs + back link target. */
export type SongDetailNavState = {
  wordsListReturn?: string
}

export type SongCatalogItem = {
  lyrics_id: string
  lyrics_title: string
  /** Canonical `/songs/:slug` segment from Airtable when set; otherwise derived from title at build. */
  url_slug: string
  /** Airtable `url_slug_locked` — informational for tooling; routing uses `url_slug`. */
  url_slug_locked?: boolean
  summary_short: string
  /** Curated extract / alternate blurb from Airtable (SONGS `lyrics_extract`). */
  lyrics_extract: string
  sutra: string
  topic: string
  intention: string
  light_shadow: string
  lang: string
  written_year: string
  song_in_app: boolean
  fav: boolean
  published_at: string
  cover_image_url: string
  track_genres: string[]
  track_secondary_genres: string[]
  track_instruments: string[]
  /** Distinct `mood` values from published in-app tracks (facets + header browse). */
  track_moods: string[]
  /** Lead in-app track only — for discovery “Top tracks” subtitle (not EP-wide / multi-track join). */
  discovery_top_track_genres: string
  soundcloud_genre_tags: string[]
  track_count_total: number
  track_count_published: number
  track_count_selected: number
  aggregate_play_count: number
  aggregate_like_count: number
  peak_play_count: number
  peak_like_count: number
  aggregate_duration_sec: number
  best_track_ids: string[]
  ep_refs: string[]
  /** SC EP set URL from sc_eps when known (even if no track rows in export). */
  primary_ep_url: string
  primary_ep_title: string
  primary_ep_volume: number
  primary_ep_rating: string
  has_fav_track: boolean
  /** Songbook / playlist-style subcategory from lyrics (e.g. "Speak: DUCK (shady)"). */
  songbook: string
  /** Primary muse / persona name from lyrics. */
  muse: string
  /** Curated quote / muse line; capped at artifact build. */
  song_muse_quote: string
  /** Creator notes excerpt for search only. */
  lyrics_notes_excerpt: string
  /** Deduped published SoundCloud track + EP titles. */
  soundcloud_title_blob: string
  /** Opening ~2.8k chars of lyrics for keyword search (not full corpus). */
  lyrics_head_search: string
  /** At least one SoundCloud row is `track_in_app` (in-app player + default embed). */
  has_in_app_playback: boolean
  /**
   * SoundCloud track URL from AT-TRACKS-FULL-v4 when this lyrics row has no primary SC EP link.
   * Used for singles / tracks outside the smaller Airtable SC TRACKS slice; review via sc_catalog_listen_review.csv.
   */
  has_sc_catalog_listen: boolean
  sc_catalog_listen_url: string
  sc_catalog_track_title: string
  /** `override` | `full_v4` | `full_v4_url` | `export_title` | empty — how `sc_catalog_listen_url` was resolved. */
  sc_catalog_listen_source: string
  /** At least one reconciled YouTube row on file for this lyrics_id (song detail / videos hub). */
  has_youtube_video: boolean
  /** At least one such row allows in-app iframe embed. */
  has_youtube_embed: boolean
  /** Airtable SONGS `status` (pipeline / messy); used for /words “in pipeline” vs lyrics-only heuristics. */
  lyrics_pipeline_status: string
}

export type MuseCatalogItem = {
  muse: string
  muse_id: string
  gender_pronoun: string
  type_category: string
  country: string
  era: string
  birth_year: string
  death_year: string
  core_sutra: string
  secondary_sutras: string
  themes: string
  notes: string
  wikipedia_url: string
  song_count: number
}

export type QuoteWallItem = {
  quote: string
  muse: string
  primary_sutra: string
  secondary_sutras: string
  core_topic: string
  quote_id: string
  inspired_song?: { title: string; slug: string }
}

/** `/songs` media combo filter (lyrics-only rows live on `/words`). Default: all combos in this grid. */
export type MediaComboFilter = 'all' | 'lyrics_sc' | 'lyrics_yt' | 'full'

export type FilterState = {
  sutra: Set<string>
  topic: Set<string>
  intention: Set<string>
  light_shadow: Set<string>
  written_year: Set<string>
  track_genre: Set<string>
  track_secondary_genre: Set<string>
  track_instrument: Set<string>
  lang: Set<string>
}

export function emptyFilterState(): FilterState {
  return {
    sutra: new Set(),
    topic: new Set(),
    intention: new Set(),
    light_shadow: new Set(),
    written_year: new Set(),
    track_genre: new Set(),
    track_secondary_genre: new Set(),
    track_instrument: new Set(),
    lang: new Set(),
  }
}

/** Facets that participate in `/songs` URL filter state. */
export type FilterFacetKey = keyof FilterState

/** `/tracks` URL filter params (`primary_genre`, `secondary_genre`, …). */
export type TracksFacetFilterKey =
  | 'primary_genre'
  | 'secondary_genre'
  | 'mood'
  | 'instrument'
  | 'tempo_feel'

export type TracksFilterState = Record<TracksFacetFilterKey, Set<string>>

export type TrackSortMode = 'newest' | 'plays' | 'likes'

export function emptyTracksFilterState(): TracksFilterState {
  return {
    primary_genre: new Set(),
    secondary_genre: new Set(),
    mood: new Set(),
    instrument: new Set(),
    tempo_feel: new Set(),
  }
}

/**
 * Keys present in `facets.json` (includes values that only deep-link to `/tracks`
 * from the header browse panel until Phase 3 URL sync).
 */
export type FacetGroupKey = FilterFacetKey | 'track_mood'

export type FacetsPayload = Record<FacetGroupKey, FacetEntry[]>

export type SongDetailTrack = {
  track_id: string
  lyrics_id: string
  track_title: string
  lyrics_title: string
  sc_url: string
  play_count: number
  like_count: number
  duration_sec: number
  duration_raw: string
  genres: string[]
  primary_genre: string
  secondary_genres: string[]
  soundcloud_genre: string
  secondary_genre: string
  instruments: string[]
  ep_title: string
  ep_url: string
  ep_track_number: number
  ep_total_tracks: number
  created_at: string
  artwork_url: string
  waveform_url: string
  bpm: number
  track_status: string
  track_in_app: boolean
  fav_track: boolean
  mood: string
  tempo_feel: string
  curation_rating: string
  /** Airtable / sc_tracks `sutra` (sutra family for this track). */
  sutra: string
}

/** Flat `track_catalog.json` row: published in-app SC track + parent song join (Phase 3 `/tracks`). */
export type TrackCatalogItem = SongDetailTrack & {
  url_slug: string
  list_cover_url: string
  song_published_at: string
  popularity_score: number
}

export type SongDetailRecord = {
  lyrics_id: string
  lyrics_title: string
  /** Canonical `/songs/:slug` segment (Airtable or build-time fallback). */
  url_slug: string
  url_slug_locked?: boolean
  lyrics_summary: string
  lyrics_extract: string
  lyrics_text: string
  sutra: string
  topic: string
  intention: string
  light_shadow: string
  lang: string
  written_year?: string
  song_in_app: boolean
  fav: boolean
  cover_image_url: string
  primary_ep_volume: number
  /** SC EP set URL from sc_eps (for pages with no in-app tracks). */
  primary_ep_url: string
  primary_ep_title: string
  primary_ep_rating: string
  /** Normalized SoundCloud `/sets/` URL → `duration_total` from sc_eps CSV (e.g. `"1:51:06"`). */
  sc_ep_set_duration_totals?: Record<string, string>
  fallback_sc_url?: string
  has_sc_catalog_listen?: boolean
  sc_catalog_listen_url?: string
  sc_catalog_track_title?: string
  sc_catalog_listen_source?: string
  related_songs: SongRelatedSong[]
  /** Lyrics Airtable songbook (curated topical series), not the SoundCloud playlist name. */
  songbook: string
  muse: string
  tracks: SongDetailTrack[]
}

export type SongRelatedSong = {
  lyrics_id: string
  lyrics_title: string
  url_slug: string
  cover_image_url: string
  has_in_app_playback: boolean
  has_sc_catalog_listen?: boolean
  has_youtube_video: boolean
}

export type SongbookMemberSong = {
  lyrics_id: string
  lyrics_title: string
  url_slug: string
  summary_short: string
  cover_image_url: string
  has_in_app_playback: boolean
  has_sc_catalog_listen?: boolean
  has_youtube_video: boolean
  has_youtube_embed: boolean
  aggregate_play_count: number
  aggregate_like_count: number
}

/** One YouTube row (from clean `yt_videos` snapshot via `youtube_by_lyrics_id.json`). */
export type YouTubeCatalogVideo = {
  video_id: string
  title: string
  lyrics_title: string
  /** Empty when the Airtable row has no lyrics_id yet (card opens YouTube only in the hub). */
  lyrics_id: string
  /** Airtable `video_featured` marker for rotating hero/spotlight sections. */
  video_featured?: boolean
  /** Airtable `video_featured_description` (currently optional/frequently blank). */
  video_featured_description?: string
  /** Song-level summary copied from `lyrics_summary` when linked in catalog. */
  lyrics_summary?: string
  sutra: string
  /** Curator genres from Airtable (`yt_videos` snapshot). */
  genre_primary: string
  genre_secondary: string
  instruments: string
  yt_url: string
  thumbnail_url: string
  duration: string
  publish_date: string
  playlist_names: string
  content_type: string
  /** YouTube / Airtable format label, e.g. `9:16`, `16:9`. */
  format: string
  /** Comma-separated YouTube topic categories from the upload. */
  topic_categories: string
  /** From `song_catalog` when `lyrics_id` is featured; empty when not in app catalog. */
  song_topic: string
  song_intention: string
  /** From `song_catalog` when linked in-app; absent for off-catalog / unlinked rows. */
  url_slug?: string
  /** True when the row is allowed to use an in-app iframe (API embeddable + basic gates). */
  can_embed: boolean
}

/** From Airtable SONGBOOKs `songbook_type` (drives app grouping; not `sc_playlist_type`). */
export type SongbookCatalogType = 'sutra' | 'collection' | 'genre' | 'language' | ''

export type SongbookCatalogItem = {
  songbook: string
  /** Mirrors Airtable SONGBOOKs `songbook_in_app`; catalog only includes rows where this is true. */
  songbook_in_app: boolean
  songbook_id: string
  /** Lowercase Airtable `songbook_type`: sutra · collection · genre · language. */
  songbook_type: SongbookCatalogType
  /** Primary sutra ordering key rollup (ex: 01-KNOW, 02-BLOW, 02-QUACK). */
  sutra_id_rollup: string
  status: string
  description: string
  sutras: string
  secondary_sutra: string
  topics_primary: string
  landr_url: string
  /** Resolved `/songbooks/:slug` segment (Airtable `url_slug_songbook` or slugified `songbook`). */
  url_slug_songbook: string
  /** When true, treat `url_slug_songbook` as editorially frozen (same contract as song `url_slug_locked`). */
  url_songbook_locked: boolean
  /** SONGBOOKs CSV `sc_playlist_url` (manual / audit); embed + cards use `playlist_url` from SC Playlists join. */
  sc_playlist_url: string
  /** SONGBOOKs CSV `songbook_art_url` (audit); displayed art uses `playlist_artwork_url`. */
  songbook_art_url: string
  /** SoundCloud playlist URL — **only** from SC Playlists CSV joined by `songbook_id`. */
  playlist_url: string
  /** Playlist cover — build prefers SoundCloud oEmbed thumbnail for `playlist_url`, else SC CSV `artwork_url`. */
  playlist_artwork_url: string
  playlist_total_plays: number
  playlist_total_likes: number
  song_count: number
  songs_with_in_app_playback: number
  member_lyrics_ids: string[]
  member_songs: SongbookMemberSong[]
}
