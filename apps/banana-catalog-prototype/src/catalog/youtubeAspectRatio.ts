const RATIO_TOKEN_RE = /(\d+(?:\.\d+)?)\s*[:/x]\s*(\d+(?:\.\d+)?)/i

/**
 * Maps Airtable/YT format strings (`16:9`, `9:16`, `4:3`, `shorts`, etc.)
 * into a CSS `aspect-ratio` value.
 */
export function youtubeAspectRatioFromFormat(format?: string): string {
  const raw = (format || '').trim().toLowerCase()
  if (!raw) return '16 / 9'

  const ratioMatch = raw.match(RATIO_TOKEN_RE)
  if (ratioMatch) {
    const width = Number(ratioMatch[1])
    const height = Number(ratioMatch[2])
    if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
      return `${width} / ${height}`
    }
  }

  if (raw.includes('vertical') || raw.includes('short')) return '9 / 16'
  if (raw.includes('square')) return '1 / 1'
  return '16 / 9'
}

/** True only for explicit landscape 16:9 labels (homepage featured video pool). */
export function youtubeFormatIsLandscape16x9(format?: string): boolean {
  const raw = (format || '').trim().toLowerCase()
  if (!raw || raw.includes('/')) return false
  return raw === '16:9' || raw === '16x9'
}
