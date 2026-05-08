import sutraContextJson from '../data/generated/sutra_context.json'
import { ABOUT_SUTRAS_HREF } from './iaPaths'

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

export function sutraHrefForFamily(key: SutraFamilyKey): string {
  const slug = (SUTRA_CONTEXT[key]?.url_slug_sutra || '').trim()
  return slug ? `/about/${slug}` : ABOUT_SUTRAS_HREF
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
