import type { SongCatalogItem } from './types'

/**
 * `/words` placement is **media-first**: only rows with no listener-facing audio path
 * (`wordsLyricsOnlyMedia`): no curated in-app SC, no SC catalog track from FULL v4,
 * no linked SC EP, and no YouTube row on file. Story chips optionally slice that pool by
 * Airtable `production_stage` (exposed as `lyrics_pipeline_status` in JSON): NEW/SUNO
 * (new seedling) and LANDR/LANDR READY (in the works). Other stages (e.g. PUBLISHED)
 * appear only under **All** — they are not a separate URL bucket.
 *
 * So if stage says LANDR but audio exists on SC (curated, catalog export, or EP) or YT,
 * the row never appears here — it lives on `/songs`. Stage is “desk intent”; media is
 * “what exists for listeners in this app.”
 *
 * URL story filter on `/words?wb=`.
 * Legacy: `pipeline` → works, `lyrics_only` → all (pool is already lyrics-only), `wb=any` → all.
 * Legacy `wb=remakes` / `remake` / `published` → all (third bucket removed).
 */
export type WordsStoryBucket = 'all' | 'seedling' | 'works'

export function parseWordsStoryBucket(raw: string | null): WordsStoryBucket {
  const v = (raw ?? '').trim().toLowerCase()
  if (v === 'seedling' || v === 'new_seedling') return 'seedling'
  if (v === 'works' || v === 'pipeline' || v === 'in_the_works') return 'works'
  return 'all'
}

function productionStageNorm(song: SongCatalogItem): string {
  return (song.lyrics_pipeline_status ?? '').trim().toUpperCase()
}

function hasLinkedSoundcloudEp(song: SongCatalogItem): boolean {
  return Boolean(song.primary_ep_url?.trim())
}

/** No curated SC, no SC catalog URL, no linked SC EP, and no YouTube on file — true “lyrics only” for /words. */
export function wordsLyricsOnlyMedia(song: SongCatalogItem): boolean {
  return (
    !song.has_in_app_playback &&
    !song.has_sc_catalog_listen &&
    !hasLinkedSoundcloudEp(song) &&
    !song.has_youtube_video
  )
}

/** Featured on Words at all: lyrics-only (listener catalog is `/songs`). */
export function songOnWordsSurface(song: SongCatalogItem): boolean {
  return wordsLyricsOnlyMedia(song)
}

/** `production_stage` NEW or SUNO — lyrics-only early / exploration work. */
export function wordsNewSeedling(song: SongCatalogItem): boolean {
  if (!wordsLyricsOnlyMedia(song)) return false
  const st = productionStageNorm(song)
  return st === 'NEW' || st === 'SUNO'
}

/** `production_stage` LANDR or LANDR READY — lyrics-only studio pipeline (vol 2 etc. until audio ships in-app). */
export function wordsInTheWorks(song: SongCatalogItem): boolean {
  if (!wordsLyricsOnlyMedia(song)) return false
  const st = productionStageNorm(song)
  return st === 'LANDR' || st === 'LANDR READY'
}

export function songMatchesWordsBucket(song: SongCatalogItem, bucket: WordsStoryBucket): boolean {
  if (bucket === 'all') return true
  if (bucket === 'seedling') return wordsNewSeedling(song)
  if (bucket === 'works') return wordsInTheWorks(song)
  return false
}

/** Card badge: pipeline slice for early stages only; other stages have no chip on the card. */
export function wordsCardStoryBadge(song: SongCatalogItem): 'seedling' | 'works' | null {
  if (!wordsLyricsOnlyMedia(song)) return null
  if (wordsNewSeedling(song)) return 'seedling'
  if (wordsInTheWorks(song)) return 'works'
  return null
}
