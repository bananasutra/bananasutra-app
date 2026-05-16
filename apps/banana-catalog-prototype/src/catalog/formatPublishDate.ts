/** Short human-readable publish label for catalog cards (e.g. Latest drops). */
export function formatPublishDate(iso: string): string {
  const t = (iso || '').trim()
  if (!t) return ''
  const ms = Date.parse(t)
  if (!Number.isFinite(ms)) return ''
  return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
