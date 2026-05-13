import type { SongbookCatalogItem, SongCatalogItem } from './types'
import type { SutraFamilyKey } from './sutraContext'
import { SUTRA_CONTEXT } from './sutraContext'

const FAMILY_ORDER: SutraFamilyKey[] = ['KNOW', 'BLOW', 'QUACK', 'SHOW', 'GROW', 'FLOW', 'GLOW', 'BOW']

export function sutraFamilyKeyFromSongField(sutraField: string): SutraFamilyKey | null {
  const u = sutraField.trim().toUpperCase()
  for (const k of FAMILY_ORDER) {
    if (u.startsWith(k)) return k
  }
  return null
}

export function buildSutraStats(
  catalog: SongCatalogItem[],
): Map<SutraFamilyKey, { songs: number; tracks: number }> {
  const m = new Map<SutraFamilyKey, { songs: number; tracks: number }>()
  for (const k of FAMILY_ORDER) m.set(k, { songs: 0, tracks: 0 })
  for (const s of catalog) {
    const k = sutraFamilyKeyFromSongField(s.sutra)
    if (!k) continue
    const row = m.get(k)!
    row.songs += 1
    row.tracks += Math.max(0, s.track_count_published || 0)
  }
  return m
}

/** Match SongbooksPage grouping: cores + OTHER + QUACK. */
export function primarySutraKeyForSongbook(book: SongbookCatalogItem): string {
  const rollup = (book.sutra_id_rollup || '').trim()
  if (rollup) {
    const tail = rollup.split('-').pop() || ''
    const up = tail.toUpperCase()
    if (up === 'QUACK') return 'QUACK'
    const cores = ['KNOW', 'BLOW', 'SHOW', 'GROW', 'FLOW', 'GLOW', 'BOW'] as const
    for (const k of cores) {
      if (up === k) return k
    }
  }
  const raw = book.sutras || ''
  for (const token of raw.split(',')) {
    const t = token.trim().toUpperCase()
    if (t.startsWith('QUACK')) return 'QUACK'
    const cores = ['KNOW', 'BLOW', 'SHOW', 'GROW', 'FLOW', 'GLOW', 'BOW'] as const
    for (const k of cores) {
      if (t.startsWith(k)) return k
    }
  }
  return 'OTHER'
}

function songbookPopularityScore(b: SongbookCatalogItem): number {
  return b.playlist_total_plays + 40 * b.playlist_total_likes + b.songs_with_in_app_playback
}

export function songbooksForSutraDetail(
  family: SutraFamilyKey,
  books: SongbookCatalogItem[],
): SongbookCatalogItem[] {
  const filtered = books.filter((b) => {
    const k = primarySutraKeyForSongbook(b)
    if (family === 'BLOW') return k === 'BLOW' || k === 'QUACK'
    return k === family
  })
  return filtered.sort(
    (a, b) => songbookPopularityScore(b) - songbookPopularityScore(a) || a.songbook.localeCompare(b.songbook),
  )
}

/** Prefer `songbook_type === sutra` rows for sutra-page spotlight pool; fall back to full lane if none. */
export function songbookPoolForSutraPageRotation(booksForFamily: SongbookCatalogItem[]): SongbookCatalogItem[] {
  const sutraTyped = booksForFamily.filter((b) => (b.songbook_type || '').trim().toLowerCase() === 'sutra')
  return sutraTyped.length ? sutraTyped : booksForFamily
}

/**
 * Canonical pivot targets — the natural "what's next" sutra for each family.
 * Follows the sutra cycle and the hints embedded in each sutra_essence.
 */
const PIVOT_TARGETS: Record<SutraFamilyKey, SutraFamilyKey> = {
  KNOW: 'GROW',   // "once we've found our truth, GROW helps us do something with it"
  BLOW: 'SHOW',   // "SHOW (play) and FLOW (trust) are the antidotes"
  QUACK: 'SHOW',  // "pivot to SHOWsutra to laugh at the great naked king"
  SHOW: 'GROW',   // "GROW is where the courage lives"
  GROW: 'FLOW',   // "FLOW is where you stop gripping it"
  FLOW: 'GLOW',   // "the river that flows long enough starts to shimmer—that's GLOW"
  GLOW: 'BOW',    // "Gratitude deep enough is awe—and that's BOW"
  BOW: 'KNOW',    // "it all starts again, in the KNOW"
}

export function pickPivotTargetFamily(_pivot: string, current: SutraFamilyKey): SutraFamilyKey | null {
  return PIVOT_TARGETS[current] ?? null
}

export function pickRandomQuoteSong(
  catalog: SongCatalogItem[],
  family: SutraFamilyKey,
): SongCatalogItem | null {
  const pool = catalog.filter(
    (s) => sutraFamilyKeyFromSongField(s.sutra) === family && (s.lyrics_extract || '').trim(),
  )
  if (!pool.length) return null
  const idx = Math.floor(Math.random() * pool.length)
  return pool[idx]!
}

export function sutraHrefFromSongSutraField(sutraField: string): string | null {
  const fam = sutraFamilyKeyFromSongField(sutraField)
  if (!fam) return null
  const slug = (SUTRA_CONTEXT[fam].url_slug_sutra || '').trim()
  return slug ? `/about/${slug}` : null
}
