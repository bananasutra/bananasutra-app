/** Catalog publish labels use Pacific calendar dates (SC timestamps are UTC). */
const CATALOG_PUBLISH_TZ = 'America/Los_Angeles'

/**
 * Parse catalog `published_at` / SC `created_at` to epoch ms.
 * Naive ISO / space-separated values are treated as UTC (export strips the trailing Z).
 */
export function parseCatalogPublishedAt(iso: string): number {
  const t = (iso || '').trim()
  if (!t) return NaN
  if (/Z$/i.test(t) || /[+-]\d{2}:?\d{2}$/.test(t)) {
    return Date.parse(t)
  }
  const asIso = t.includes('T') ? t : t.replace(' ', 'T')
  return Date.parse(`${asIso}Z`)
}

/** Short human-readable publish label for catalog cards (e.g. Latest drops). */
export function formatPublishDate(iso: string): string {
  const ms = parseCatalogPublishedAt(iso)
  if (!Number.isFinite(ms)) return ''
  return new Date(ms).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: CATALOG_PUBLISH_TZ,
  })
}

/** Compact home-portal date (month + day) in Pacific. */
export function formatPublishDateShort(iso: string): string {
  const ms = parseCatalogPublishedAt(iso)
  if (!Number.isFinite(ms)) return ''
  return new Date(ms).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: CATALOG_PUBLISH_TZ,
  })
}
