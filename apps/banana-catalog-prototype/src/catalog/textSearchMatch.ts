export function normalizeSearchText(value: string): string {
  return value.trim().toLowerCase()
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Whole-token match — avoids "putin" matching inside "computing". */
export function textMatchesSearchQuery(haystack: string, query: string): boolean {
  const normalizedQuery = normalizeSearchText(query)
  if (!normalizedQuery) return true
  const text = (haystack || '').trim()
  if (!text) return false
  const pattern = new RegExp(`(?:^|[^a-z0-9])${escapeRegExp(normalizedQuery)}(?:[^a-z0-9]|$)`, 'i')
  return pattern.test(text.toLowerCase())
}

export function fieldsMatchSearchQuery(fields: readonly string[], query: string): boolean {
  const normalizedQuery = normalizeSearchText(query)
  if (!normalizedQuery) return true
  return fields.some((field) => textMatchesSearchQuery(field, normalizedQuery))
}
