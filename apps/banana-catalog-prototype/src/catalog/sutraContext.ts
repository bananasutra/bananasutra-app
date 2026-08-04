import sutraContextJson from '../data/generated/sutra_context.json'
import { ABOUT_SUTRAS_HREF } from './iaPaths'
import { sutraDetailPath } from './songPaths'

export type SutraFamilyKey = 'KNOW' | 'BLOW' | 'QUACK' | 'SHOW' | 'GROW' | 'FLOW' | 'GLOW' | 'BOW'

export type SutraFeaturedEp = {
  ep_url: string
  ep_title: string
  ep_description: string
  ep_songbook_title: string
  duration_total?: string | number | null
  total_plays: number
  total_likes: number
  ep_total_tracks: number
  created_at: string
  artwork_url: string
  artwork_lg_url: string
}

export type SutraFeaturedVideo = {
  yt_video_id: string
  title: string
  description?: string
}

export type SutraContextEntry = {
  sutra: string
  sutra_id: string
  question: string
  practice: string
  themes: string
  mental_health_pivot: string
  sutra_when: string
  sutra_card_essence: string
  sutra_lens: string
  sutra_essence: string
  url_slug_sutra: string
  url_sutra_locked: boolean
  featured_ep?: SutraFeaturedEp
  featured_video?: SutraFeaturedVideo
}

export const SUTRA_CONTEXT = sutraContextJson as Record<SutraFamilyKey, SutraContextEntry>

export const SUTRA_INDEX_CORE_ORDER: readonly SutraFamilyKey[] = [
  'KNOW',
  'BLOW',
  'SHOW',
  'GROW',
  'FLOW',
  'GLOW',
  'BOW',
] as const

/** Canonical filter-chip order: core seven, then QUACK, then anything else A–Z. */
export function sutraDisplaySortRank(display: string): number {
  const norm = (display || '').trim().toUpperCase()
  for (let i = 0; i < SUTRA_INDEX_CORE_ORDER.length; i += 1) {
    const key = SUTRA_INDEX_CORE_ORDER[i]
    if (norm === key || norm.startsWith(`${key}SUTRA`) || norm.startsWith(key)) return i
  }
  if (norm.includes('QUACK')) return SUTRA_INDEX_CORE_ORDER.length
  return SUTRA_INDEX_CORE_ORDER.length + 100
}

export function compareSutraDisplayNames(a: string, b: string): number {
  const rankDiff = sutraDisplaySortRank(a) - sutraDisplaySortRank(b)
  if (rankDiff !== 0) return rankDiff
  return a.localeCompare(b, undefined, { sensitivity: 'base' })
}

export function sortSutraDisplayNames(values: readonly string[]): string[] {
  return [...values].sort(compareSutraDisplayNames)
}

export function sortSutraFacetEntries<T extends { value: string }>(entries: readonly T[]): T[] {
  return [...entries].sort((a, b) => compareSutraDisplayNames(a.value, b.value))
}

export function sutraHrefForFamily(key: SutraFamilyKey): string {
  const slug = (SUTRA_CONTEXT[key]?.url_slug_sutra || '').trim()
  return slug ? sutraDetailPath(slug) : ABOUT_SUTRAS_HREF
}

/** Given a sutra display name (e.g. "KNOWsutra"), return its guiding question for tooltip use. */
export function sutraQuestionFromDisplay(displayName: string): string {
  const norm = (displayName || '').trim().toUpperCase()
  for (const key of Object.keys(SUTRA_CONTEXT) as SutraFamilyKey[]) {
    if (norm.startsWith(key)) return SUTRA_CONTEXT[key].question
  }
  return ''
}

export function sutraEntryBySlug(slug: string): { key: SutraFamilyKey; entry: SutraContextEntry } | null {
  const s = slug.trim().toLowerCase()
  if (!s) return null
  for (const key of Object.keys(SUTRA_CONTEXT) as SutraFamilyKey[]) {
    const entry = SUTRA_CONTEXT[key]
    if (!entry) continue
    if ((entry.url_slug_sutra || '').trim().toLowerCase() === s) {
      return { key, entry }
    }
  }
  return null
}
