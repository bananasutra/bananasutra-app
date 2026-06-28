/**
 * Canonical duration display for tracks, songbooks, EP sets, and playlist metadata.
 * Clock inputs: `M:SS` or `H:MM:SS`. Output: explicit units (`4 min 31 sec`, `1 hr 13 min 46 sec`).
 * Seconds are zero-padded (`09 sec`) so fixed-width row chrome stays aligned.
 */

/** Parse clock duration (`M:SS` or `H:MM:SS`) to seconds. */
export function parseDurationClock(raw: string): number {
  const text = raw.trim()
  if (!text) return 0
  const parts = text.split(':').map((part) => Number.parseInt(part, 10))
  if (parts.some((n) => !Number.isFinite(n) || n < 0)) return 0
  if (parts.length === 2) return parts[0]! * 60 + parts[1]!
  if (parts.length === 3) return parts[0]! * 3600 + parts[1]! * 60 + parts[2]!
  return 0
}

export function formatDurationFromSeconds(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return ''
  const rounded = Math.round(totalSeconds)
  const hours = Math.floor(rounded / 3600)
  const minutes = Math.floor((rounded % 3600) / 60)
  const seconds = rounded % 60
  const parts: string[] = []
  if (hours > 0) parts.push(`${hours} hr`)
  if (minutes > 0) parts.push(`${minutes} min`)
  if (seconds > 0 || !parts.length) parts.push(`${String(seconds).padStart(2, '0')} sec`)
  return parts.join(' ')
}

function formatDurationFromClockSegments(text: string): string {
  const segments = text.split(':').map((part) => Number.parseInt(part, 10))
  if (segments.some((n) => !Number.isFinite(n) || n < 0)) return text
  if (segments.length === 3) {
    const [hours, minutes, seconds] = segments
    const parts: string[] = []
    if (hours > 0) parts.push(`${hours} hr`)
    if (minutes > 0) parts.push(`${minutes} min`)
    if (seconds > 0 || !parts.length) parts.push(`${String(seconds).padStart(2, '0')} sec`)
    return parts.join(' ')
  }
  if (segments.length === 2) {
    const [minutes, seconds] = segments
    const parts: string[] = []
    if (minutes > 0) parts.push(`${minutes} min`)
    if (seconds > 0 || !parts.length) parts.push(`${String(seconds).padStart(2, '0')} sec`)
    return parts.join(' ')
  }
  return text
}

/** Human-readable duration for all catalog UI surfaces. */
export function formatDurationDisplay(raw: string | number | null | undefined): string {
  if (raw === null || raw === undefined) return ''
  if (typeof raw === 'number') {
    return formatDurationFromSeconds(raw)
  }
  const text = String(raw).trim()
  if (!text) return ''
  if (/^\d+$/.test(text)) {
    const secs = Number.parseInt(text, 10)
    if (secs > 0) return formatDurationFromSeconds(secs)
  }
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(text)) {
    return formatDurationFromClockSegments(text)
  }
  return text
}
