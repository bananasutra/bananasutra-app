const CF_IMAGE_HOST = 'bananasutra.com'

export type CoverImageOptions = {
  width?: number
  format?: 'auto' | 'webp' | 'avif' | 'jpeg' | 'png'
  quality?: number
}

function isTransformHost(): boolean {
  if (typeof window !== 'undefined') {
    return window.location.hostname === CF_IMAGE_HOST || window.location.hostname === `www.${CF_IMAGE_HOST}`
  }
  return true
}

/** Wrap a remote cover URL with Cloudflare Image Transformations on production. */
export function coverImageUrl(source: string | null | undefined, opts: CoverImageOptions = {}): string {
  const trimmed = (source ?? '').trim()
  if (!trimmed) return ''
  if (trimmed.includes('/cdn-cgi/image/')) return trimmed
  if (!isTransformHost()) return trimmed

  const width = opts.width ?? 400
  const format = opts.format ?? 'auto'
  const quality = opts.quality ?? 80
  const params = `width=${width},format=${format},quality=${quality}`
  return `https://${CF_IMAGE_HOST}/cdn-cgi/image/${params}/${trimmed}`
}

export function buildSrcset(
  source: string | null | undefined,
  widths: readonly number[] = [200, 400, 640],
  opts: Omit<CoverImageOptions, 'width'> = {},
): string {
  return widths.map((w) => `${coverImageUrl(source, { ...opts, width: w })} ${w}w`).join(', ')
}
