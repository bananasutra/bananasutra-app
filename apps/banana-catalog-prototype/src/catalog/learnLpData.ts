import homeQuotesJson from '../data/generated/home_quotes.json'
import type { MuseCatalogItem, QuoteWallItem, SongCatalogItem } from './types'
import { canonicalPathForRoute } from './seoPaths'
import { songCatalogPath } from './songPaths'
import {
  SUTRA_CONTEXT,
  SUTRA_INDEX_CORE_ORDER,
  type SutraFamilyKey,
  sutraHrefForFamily,
} from './sutraContext'

export const LEARN_LP_META = {
  title: 'Learn',
  description:
    'What is bananasutra? Start here. The songs make more sense once you know the sutras. Orientation hub for sutras, muses, quotes, and words.',
  lead: 'Start here. The songs make more sense once you know the sutras.',
  sub:
    'What is bananasutra? An audio testament. True stories organized by the seven questions I navigate by. Open a door; see what\'s inside before you commit.',
} as const

export type LearnHubTileKey = 'about' | 'sutras' | 'muses-quotes' | 'words' | 'manifesto'

export type LearnHubTileConfig = {
  key: LearnHubTileKey
  label: string
  description: string
  anchorId?: string
  tileClassName?: string
}

export const LEARN_HUB_TILES: LearnHubTileConfig[] = [
  {
    key: 'about',
    label: 'About',
    description: 'What the banana?',
  },
  {
    key: 'sutras',
    label: 'Sutras',
    description: 'The compass behind the songs.',
    tileClassName: 'learn-lp__tile--sutras',
  },
  {
    key: 'muses-quotes',
    label: 'Muses & quotes',
    description: 'Because sharing matters.',
  },
  {
    key: 'words',
    label: 'Words',
    description: 'Explore lyrics-only songs.',
  },
  {
    key: 'manifesto',
    label: 'Manifesto',
    description: 'Because ethics matter.',
    anchorId: 'manifesto',
    tileClassName: 'learn-lp__tile--manifesto',
  },
]

export type LearnFaqItem = { question: string; answer: string }

export const LEARN_FAQ_ITEMS: LearnFaqItem[] = [
  {
    question: 'Is this AI music?',
    answer:
      'Every lyric is written by a human. Suno generates the sonic canvas; the philosophy, the words, and the 7 questions are the content. Think of it the way Dylan used folk structures he did not invent, or hip hop builds on samples: the instrument does not invalidate the art.',
  },
  {
    question: "What's a sutra?",
    answer:
      'A sutra is a thread, a guiding question to navigate by. There are 7: Is it true? Is it fair? Is it fun? Is it brave? Is it free? Is it full? Is it awe? Each song belongs to one. Together they form a compass for a world gone bananas.',
  },
  {
    question: 'Why ideas in songs?',
    answer:
      "Because ideas land better when you feel them first. Songs skip the analytical gatekeeper. That's not a workaround; that's the whole point.",
  },
]

export type LearnMoodKey =
  | 'searching'
  | 'outraged'
  | 'laugh'
  | 'brave'
  | 'overwhelmed'
  | 'grateful'
  | 'awe'

export const LEARN_MOOD_BUTTONS: { key: LearnMoodKey; label: string; sutraKey: SutraFamilyKey }[] = [
  { key: 'searching', label: "I'm searching", sutraKey: 'KNOW' },
  { key: 'outraged', label: "I'm outraged", sutraKey: 'BLOW' },
  { key: 'laugh', label: 'I need to laugh', sutraKey: 'SHOW' },
  { key: 'brave', label: 'I need to be brave', sutraKey: 'GROW' },
  { key: 'overwhelmed', label: "I'm overwhelmed", sutraKey: 'FLOW' },
  { key: 'grateful', label: "I'm grateful", sutraKey: 'GLOW' },
  { key: 'awe', label: "I'm in awe", sutraKey: 'BOW' },
]

export type LearnMoodPivotLink = { to: string; label: string }

export type LearnMoodResponse = {
  sutraLine: string
  body: string
  trap?: string
  pivot?: {
    label: string
    text: string
    sutraLink?: LearnMoodPivotLink
    songLink?: LearnMoodPivotLink
  }
  cta: LearnMoodPivotLink
}

export const LEARN_MOOD_RESPONSES: Record<LearnMoodKey, LearnMoodResponse> = {
  searching: {
    sutraLine: 'KNOWsutra · step 1 of 7',
    body:
      "Good. That's the whole point. Before you fix anything, ask what matters and what's true. What's the real goal? Peace with someone you love beats winning the argument.",
    trap: 'The trap: skipping straight to outrage or advice. Two things, darling: get the facts right, keep love in sight.',
    pivot: {
      label: 'Next in sequence · step 2',
      text: "When something's foul, BLOW names it. Stay in KNOW until the goal is honest.",
      sutraLink: { to: sutraHrefForFamily('BLOW'), label: 'Open BLOWsutra →' },
    },
    cta: { to: sutraHrefForFamily('KNOW'), label: 'Start in KNOWsutra →' },
  },
  outraged: {
    sutraLine: 'BLOWsutra · step 2 of 7',
    body:
      "Good. Something foul earned that heat. Name the problem, the pain, the fear. Set boundaries. Don't normalize evil. QUACK (sub of BLOW) catches when evil wears a normal face.",
    trap: 'The trap: outrage is fuel, not furniture. BLOW is for naming what\'s foul, not for living in the burn.',
    pivot: {
      label: 'Next in sequence · step 3',
      text:
        'SHOW grounds you in joy and intention. Then GROW, FLOW, GLOW, BOW, and back to KNOW. Switch on purpose; don\'t camp in one step.',
      sutraLink: { to: sutraHrefForFamily('SHOW'), label: 'Open SHOWsutra →' },
      songLink: {
        to: songCatalogPath('The accordion of ignorance', 'the-accordion-of-ignorance'),
        label: 'Try "The accordion of ignorance" →',
      },
    },
    cta: { to: sutraHrefForFamily('BLOW'), label: 'Start in BLOWsutra →' },
  },
  laugh: {
    sutraLine: 'SHOWsutra · step 3 of 7',
    body:
      'Step 3: ground in joy and intention. Meditate on the light. Remember why this matters and how it feels when you\'re anchored. Absurdity is medicine when heaviness needs a release valve.',
    trap: 'The trap: using SHOW to dodge the hard thing. The cosmic joke is medicine, not anesthesia.',
    pivot: {
      label: 'Next in sequence · step 4',
      text: "GROW is the brave conversation. Radical honesty, humility, kindness. That's where evolution actually happens.",
      sutraLink: { to: sutraHrefForFamily('GROW'), label: 'Open GROWsutra →' },
    },
    cta: { to: sutraHrefForFamily('SHOW'), label: 'Start in SHOWsutra →' },
  },
  brave: {
    sutraLine: 'GROWsutra · step 4 of 7',
    body:
      "Step 4, and maybe the hardest: the conversation you don't want to have. Radical honesty, humility, kindness. This is where evolution actually happens, not in the rant and not in the joke.",
    trap: 'The trap: bravery as performance. GROW expects the real talk, not virtue signaling or a speech you wrote in the shower.',
    pivot: {
      label: 'Next in sequence · step 5',
      text: 'FLOW is not just feeling better. Rebuild trust. Accept differences consciously. Let go of the grip. Flow is work too.',
      sutraLink: { to: sutraHrefForFamily('FLOW'), label: 'Open FLOWsutra →' },
    },
    cta: { to: sutraHrefForFamily('GROW'), label: 'Start in GROWsutra →' },
  },
  overwhelmed: {
    sutraLine: 'FLOWsutra · step 5 of 7',
    body:
      "Step 5: stop pushing the river. FLOW isn't only comfort. It's rebuilding trust, accepting differences on purpose, letting the thing you're gripping loosen its hold.",
    trap: "The trap: using FLOW to bypass GROW. You don't earn flow by skipping the hard conversation.",
    pivot: {
      label: 'Next in sequence · step 6',
      text: 'GLOW names what makes the work worth it: gratitude for what you can see and name. The shimmer after the climb.',
      sutraLink: { to: sutraHrefForFamily('GLOW'), label: 'Open GLOWsutra →' },
    },
    cta: { to: sutraHrefForFamily('FLOW'), label: 'Start in FLOWsutra →' },
  },
  grateful: {
    sutraLine: 'GLOWsutra · step 6 of 7',
    body:
      'Step 6: notice what makes it worth it. Thankfulness for what you can name: people, small wins, the shimmer after the climb. Ideas you can feel, not holiness.',
    trap: "The trap: confusing GLOW with BOW. Gratitude names what you see. Awe bows to what you can't. GLOW is earned sight, not denial or surrender.",
    pivot: {
      label: 'Next in sequence · step 7 · BOWsutra',
      text: "BOW is not more gratitude. It's humility before mystery: life is short, the cosmic is bigger than your plan, let go of controlling the outcome.",
      sutraLink: { to: sutraHrefForFamily('BOW'), label: 'Open BOWsutra →' },
    },
    cta: { to: sutraHrefForFamily('GLOW'), label: 'Start in GLOWsutra →' },
  },
  awe: {
    sutraLine: 'BOWsutra · step 7 of 7',
    body:
      "Step 7: bow before the vastness. Not thankfulness for what you have (that's GLOW), but surrender to mystery, mortality, and the magic you can't schedule.",
    trap: "The trap: skipping GLOW to jump here. Name what glows first. BOW releases the illusion of control, not the work you still owe.",
    pivot: {
      label: 'Full circle · back to step 1',
      text: 'KNOW again: what matters now, with fresh eyes? The sequence restarts. Seven steps, one compass.',
      sutraLink: { to: sutraHrefForFamily('KNOW'), label: 'Open KNOWsutra →' },
    },
    cta: { to: sutraHrefForFamily('BOW'), label: 'Start in BOWsutra →' },
  },
}

export const LEARN_ABOUT_PREVIEW = {
  lead:
    "It's not just songs. It's important questions, and clear intentions. It's true stories that matter. It's ideas you can feel.",
  zappa: 'Why music? Because I agree with Frank Zappa: music is the only religion that delivers the goods.',
  compass:
    "I invented the sutras to help me remember what matters. They aren't taxonomy. They're a tool for staying sane.",
  homemade:
    'Homemade, end to end. Songs sorted by seven guiding questions, not by algorithm or mood.',
  href: canonicalPathForRoute('/about'),
} as const

/** Stage preview copy — orientation, not a second copy of the deep pages. */
export const LEARN_HUB_STAGE_INTRO = {
  sutras: {
    lead: 'Seven questions from KNOW to BOW. Each song belongs to one.',
    support: 'Not taxonomy. A compass for staying sane in a world gone bananas.',
  },
  musesQuotes: {
    lead: 'Thinkers who sparked a line. Lines that became songs.',
    support: 'Every quote names its muse and sutra. The wall is long; this is one door in.',
  },
  words: {
    lead: 'Lyrics without music. Pieces still brewing, or that live as text alone.',
    support: 'Read the words on their own terms. No player required.',
  },
  manifesto: {
    lead: 'Ethics before novelty. Transparency before polish.',
    support:
      'A position on AI in art: liberty for the maker, equality in credit and pay, fraternity with the community that trained the culture. Not a petition. A compass.',
  },
} as const

export const LEARN_QUOTES: QuoteWallItem[] = homeQuotesJson as QuoteWallItem[]

export function sutraDisplayNameForKey(key: SutraFamilyKey): string {
  return (SUTRA_CONTEXT[key]?.sutra || '').trim() || `${key}sutra`
}

function parsePublishedAt(raw: string): number {
  const n = Date.parse((raw || '').trim())
  return Number.isNaN(n) ? 0 : n
}

function wordsLyricsOnly(song: SongCatalogItem): boolean {
  return (
    !song.has_in_app_playback &&
    !song.has_sc_catalog_listen &&
    !(song.primary_ep_url || '').trim() &&
    !song.has_youtube_video
  )
}

export function pickMuseSample(muses: MuseCatalogItem[] | null, limit = 6): MuseCatalogItem[] {
  if (!muses?.length) return []
  return [...muses]
    .filter((m) => (m.muse || '').trim() && (m.song_count || 0) > 0)
    .sort((a, b) => (b.song_count || 0) - (a.song_count || 0))
    .slice(0, limit)
}

export function pickQuoteSample(quotes: QuoteWallItem[], limit = 4): QuoteWallItem[] {
  return quotes.slice(0, limit)
}

export function pickQuoteAtIndex(quotes: QuoteWallItem[], index: number): QuoteWallItem | null {
  if (!quotes.length) return null
  const idx = ((index % quotes.length) + quotes.length) % quotes.length
  return quotes[idx] ?? null
}

export function pickWordsSample(catalog: SongCatalogItem[] | null, limit = 5): SongCatalogItem[] {
  if (!catalog?.length) return []
  return catalog
    .filter((s) => (s.url_slug || '').trim() && wordsLyricsOnly(s))
    .sort((a, b) => parsePublishedAt(b.published_at) - parsePublishedAt(a.published_at))
    .slice(0, limit)
}

export function countWordsCatalog(catalog: SongCatalogItem[] | null): number {
  if (!catalog?.length) return 0
  return catalog.filter((s) => (s.url_slug || '').trim() && wordsLyricsOnly(s)).length
}

export function pickSongsForSutraName(
  catalog: SongCatalogItem[] | null,
  sutraName: string,
  limit = 6,
): { total: number; sample: SongCatalogItem[] } {
  if (!catalog?.length) return { total: 0, sample: [] }
  const pool = catalog.filter(
    (s) => s.sutra === sutraName && (s.url_slug || '').trim() && (s.cover_image_url || '').trim(),
  )
  const sample = [...pool]
    .sort((a, b) => parsePublishedAt(b.published_at) - parsePublishedAt(a.published_at))
    .slice(0, limit)
  return { total: pool.length, sample }
}

export function pickSongsForMoodKey(
  catalog: SongCatalogItem[] | null,
  moodKey: LearnMoodKey,
  limit = 6,
): { total: number; sample: SongCatalogItem[]; sutraName: string } {
  const button = LEARN_MOOD_BUTTONS.find((b) => b.key === moodKey)
  const sutraName = button ? sutraDisplayNameForKey(button.sutraKey) : ''
  const block = pickSongsForSutraName(catalog, sutraName, limit)
  return { ...block, sutraName }
}

export function pickStageCurtainSongs(catalog: SongCatalogItem[] | null, limit = 30): SongCatalogItem[] {
  if (!catalog?.length) return []
  const pool = catalog.filter((s) => (s.url_slug || '').trim() && (s.cover_image_url || '').trim())
  const shuffled = [...pool]
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled.slice(0, limit)
}

export function coreSutraRowsForHub(): SutraFamilyKey[] {
  return [...SUTRA_INDEX_CORE_ORDER]
}

export const LEARN_HUB_LINKS = {
  sutras: canonicalPathForRoute('/sutras'),
  muses: canonicalPathForRoute('/muses'),
  quotes: canonicalPathForRoute('/quotes'),
  words: canonicalPathForRoute('/words'),
  manifesto: canonicalPathForRoute('/manifesto'),
  manifestoSong: songCatalogPath('AI Fair Use Manifesto', 'ai-fair-use-manifesto'),
  privacy: canonicalPathForRoute('/privacy'),
  listen: canonicalPathForRoute('/listen'),
} as const
