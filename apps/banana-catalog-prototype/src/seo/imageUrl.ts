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

/**
 * SoundCloud artwork URLs already include `-t500x500` (etc.). Re-wrapping them in
 * `/cdn-cgi/image/` adds multi-second cold-cache latency without quality gain.
 */
function shouldBypassCfTransform(source: string, width: number): boolean {
  try {
    const u = new URL(source)
    if (/\.sndcdn\.com$/i.test(u.hostname)) {
      const m = u.pathname.match(/-t(\d+)x(\d+)\./i)
      if (m) {
        const maxDim = Math.max(Number(m[1]), Number(m[2]))
        if (width <= maxDim) return true
      }
    }
    if (u.hostname === 'i.ytimg.com' && /\/hqdefault\.jpg$/i.test(u.pathname) && width <= 480) {
      return true
    }
  } catch {
    return false
  }
  return false
}

/** Wrap remote cover URLs with Cloudflare Image Transformations. */
export function coverImageUrl(source: string | null | undefined, opts: CoverImageOptions = {}): string {
  const trimmed = (source ?? '').trim()
  if (!trimmed) return ''
  if (trimmed.includes('/cdn-cgi/image/')) return trimmed
  if (!isHttpUrl(trimmed)) return trimmed

  const normalized = normalizeRemoteImageSource(trimmed)
  const width = opts.width ?? 400
  if (shouldBypassCfTransform(normalized, width)) return normalized

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
  return widths.map((w) => `${coverImageUrl(source, { ...opts, width: w })} ${w}w`).join(', ')
}
