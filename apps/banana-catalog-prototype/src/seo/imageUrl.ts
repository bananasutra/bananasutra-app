const CF_IMAGE_HOST = 'bananasutra.com'

export type CoverImageOptions = {
  width?: number
  format?: 'auto' | 'webp' | 'avif' | 'jpeg' | 'png'
  quality?: number
}

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value)
}

/** YouTube maxres posters often 404 or slow; hqdefault is reliable for list/hero thumbs. */
function normalizeRemoteImageSource(source: string): string {
  try {
    const u = new URL(source)
    if (u.hostname === 'i.ytimg.com' && u.pathname.endsWith('/maxresdefault.jpg')) {
      u.pathname = u.pathname.replace(/\/maxresdefault\.jpg$/i, '/hqdefault.jpg')
      return u.toString()
    }
  } catch {
    /* keep original */
  }
  return source
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
    if (u.hostname === 'i.ytimg.com' && /\/hqdefault\.jpg$/i.test(u.pathname)) {
      return 480
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
