const CF_IMAGE_HOST = 'bananasutra.com'

export type CoverImageOptions = {
  width?: number
  format?: 'auto' | 'webp' | 'avif' | 'jpeg' | 'png'
  quality?: number
}

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value)
}

/** YouTube thumbs: maxresdefault (16:9) crops cleanly to square; sd/hq (4:3) bake letterboxing. */
function normalizeRemoteImageSource(source: string): string {
  try {
    const u = new URL(source)
    if (u.hostname === 'i.ytimg.com') {
      u.pathname = u.pathname.replace(
        /\/(hqdefault|mqdefault|sddefault|default)\.jpg$/i,
        '/maxresdefault.jpg',
      )
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
    const u = new URL((failedUrl || trimmed).trim())
    if (u.hostname !== 'i.ytimg.com') return ''
    if (/\/maxresdefault\.jpg$/i.test(u.pathname)) {
      u.pathname = u.pathname.replace(/maxresdefault\.jpg$/i, 'hqdefault.jpg')
      return u.toString()
    }
    if (/\/hqdefault\.jpg$/i.test(u.pathname)) {
      u.pathname = u.pathname.replace(/hqdefault\.jpg$/i, 'mqdefault.jpg')
      return u.toString()
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
    if (u.hostname === 'i.ytimg.com' && /\/maxresdefault\.jpg$/i.test(u.pathname)) {
      return 1280
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
function shouldBypassCfTransform(source: string, requestedWidth?: number): boolean {
  const nativeMax = nativeImageMaxWidth(source)
  if (nativeMax == null) return false
  if (requestedWidth != null && requestedWidth < 200) return false
  return true
}

/** Wrap remote cover URLs with Cloudflare Image Transformations. */
export function coverImageUrl(source: string | null | undefined, opts: CoverImageOptions = {}): string {
  const trimmed = (source ?? '').trim()
  if (!trimmed) return ''
  if (trimmed.includes('/cdn-cgi/image/')) return trimmed
  if (!isHttpUrl(trimmed)) return trimmed

  const normalized = normalizeRemoteImageSource(trimmed)
  if (shouldBypassCfTransform(normalized, opts.width)) return normalized

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
