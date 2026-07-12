const CF_IMAGE_HOST = 'bananasutra.com'

export type CoverImageOptions = {
  width?: number
  format?: 'auto' | 'webp' | 'avif' | 'jpeg' | 'png'
  quality?: number
}

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value)
}

/**
 * YouTube thumbs: prefer maxresdefault for landscape (cleaner square crops).
 * Keep sddefault as-is — catalog stores it for Shorts/reels that have no maxres
 * (maxres 404s; upgrading then falling back to hq leaves a tiny letterboxed poster).
 */
function normalizeRemoteImageSource(source: string): string {
  try {
    const u = new URL(source)
    if (u.hostname === 'i.ytimg.com') {
      if (/\/sddefault\.jpg$/i.test(u.pathname)) {
        return u.toString()
      }
      u.pathname = u.pathname.replace(
        /\/(hqdefault|mqdefault|default)\.jpg$/i,
        '/maxresdefault.jpg',
      )
      return u.toString()
    }
    if (/\.sndcdn\.com$/i.test(u.hostname)) {
      u.pathname = u.pathname.replace(/-toriginal\./i, '-t200x200.')
      return u.toString()
    }
  } catch {
    /* keep original */
  }
  return source
}

/** Downgrade YouTube poster tier when maxresdefault is missing (common on Shorts). */
export function youtubeThumbnailFallbackUrl(source: string, failedUrl?: string): string {
  const trimmed = (source || '').trim()
  if (!trimmed) return ''
  try {
    const failed = new URL((failedUrl || trimmed).trim())
    if (failed.hostname !== 'i.ytimg.com') return ''
    if (/\/maxresdefault\.jpg$/i.test(failed.pathname)) {
      // Prefer catalog sddefault when that was the original source (best Shorts art).
      try {
        const orig = new URL(trimmed)
        if (orig.hostname === 'i.ytimg.com' && /\/sddefault\.jpg$/i.test(orig.pathname)) {
          return orig.toString()
        }
      } catch {
        /* use hq below */
      }
      failed.pathname = failed.pathname.replace(/maxresdefault\.jpg$/i, 'hqdefault.jpg')
      return failed.toString()
    }
    if (/\/hqdefault\.jpg$/i.test(failed.pathname)) {
      // hq letterboxes vertical Shorts; prefer sd when available from catalog source.
      try {
        const orig = new URL(trimmed)
        if (orig.hostname === 'i.ytimg.com' && /\/sddefault\.jpg$/i.test(orig.pathname)) {
          return orig.toString()
        }
      } catch {
        /* use mq below */
      }
      failed.pathname = failed.pathname.replace(/hqdefault\.jpg$/i, 'mqdefault.jpg')
      return failed.toString()
    }
  } catch {
    return ''
  }
  return ''
}

/** Next URL to try after a cover `<img>` error (YouTube tiers, then origin). */
export function coverImageFallbackUrl(source: string, failedUrl?: string): string {
  const trimmed = (source || '').trim()
  if (!trimmed) return ''
  const yt = youtubeThumbnailFallbackUrl(trimmed, failedUrl)
  if (yt) return yt
  const normalized = normalizeRemoteImageSource(trimmed)
  if (failedUrl?.includes('/cdn-cgi/image/') && normalized && normalized !== failedUrl) {
    return normalized
  }
  return ''
}

/** Native pixel width for hosts that ship display-ready assets (no CF resize needed). */
export function nativeImageMaxWidth(source: string): number | null {
  const normalized = normalizeRemoteImageSource(source.trim())
  try {
    const u = new URL(normalized)
    if (/\.sndcdn\.com$/i.test(u.hostname)) {
      const m = u.pathname.match(/-t(\d+)x(\d+)\./i)
      if (m) return Math.max(Number(m[1]), Number(m[2]))
    }
    if (u.hostname === 'i.ytimg.com') {
      if (/\/maxresdefault\.jpg$/i.test(u.pathname)) return 1280
      // sddefault is 640×480 — bypass CF like maxres
      if (/\/sddefault\.jpg$/i.test(u.pathname)) return 640
    }
  } catch {
    return null
  }
  return null
}

/**
 * SoundCloud / YouTube thumbs are already sized for the UI. CF re-wrap adds cold-cache
 * latency (seconds) without quality gain — serve the origin URL and let the browser scale.
 */
function shouldBypassCfTransform(source: string): boolean {
  return nativeImageMaxWidth(source) != null
}

/** Wrap remote cover URLs with Cloudflare Image Transformations. */
export function coverImageUrl(source: string | null | undefined, opts: CoverImageOptions = {}): string {
  const trimmed = (source ?? '').trim()
  if (!trimmed) return ''
  if (trimmed.includes('/cdn-cgi/image/')) return trimmed
  if (!isHttpUrl(trimmed)) return trimmed

  const normalized = normalizeRemoteImageSource(trimmed)
  if (shouldBypassCfTransform(normalized)) return normalized

  const width = opts.width ?? 400
  const format = opts.format ?? 'auto'
  const quality = opts.quality ?? 80
  const params = `width=${width},format=${format},quality=${quality}`
  return `https://${CF_IMAGE_HOST}/cdn-cgi/image/${params}/${normalized}`
}

export function buildSrcset(
  source: string | null | undefined,
  widths: readonly number[] = [200, 400, 640],
  opts: Omit<CoverImageOptions, 'width'> = {},
): string {
  const trimmed = (source ?? '').trim()
  if (!trimmed) return ''

  const nativeMax = nativeImageMaxWidth(trimmed)
  let effectiveWidths = [...widths]
  if (nativeMax != null) {
    effectiveWidths = effectiveWidths.filter((w) => w <= nativeMax)
    if (effectiveWidths.length === 0) effectiveWidths = [nativeMax]
  }

  return effectiveWidths.map((w) => `${coverImageUrl(source, { ...opts, width: w })} ${w}w`).join(', ')
}
