const SUTRA_KEYS = ['KNOW', 'BLOW', 'SHOW', 'GROW', 'FLOW', 'GLOW', 'BOW', 'QUACK'] as const
type SutraKey = (typeof SUTRA_KEYS)[number]

const sutraClassByKey: Record<SutraKey, string> = {
  KNOW: 'is-sutra-know',
  BLOW: 'is-sutra-blow',
  SHOW: 'is-sutra-show',
  GROW: 'is-sutra-grow',
  FLOW: 'is-sutra-flow',
  GLOW: 'is-sutra-glow',
  BOW: 'is-sutra-bow',
  QUACK: 'is-sutra-quack',
}

function normalizeSutra(raw: string): SutraKey | null {
  const upper = raw.trim().toUpperCase()
  const match = SUTRA_KEYS.find((key) => upper.startsWith(key))
  return match ?? null
}

export function sutraClassName(rawSutra: string): string {
  const key = normalizeSutra(rawSutra)
  if (!key) return ''
  return sutraClassByKey[key]
}
