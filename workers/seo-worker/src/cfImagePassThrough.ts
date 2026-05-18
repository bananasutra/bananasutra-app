/**
 * Cloudflare Image Transformations use `/cdn-cgi/image/{options}/{source-url}`.
 * Zone Workers on `bananasutra.com/*` otherwise fetch that path from GitHub Pages → 403.
 * Parse the URL and re-fetch the source with `cf.image` so resizing runs at the edge.
 */

export type CfImageOptions = {
  width?: number
  height?: number
  quality?: number
  format?: string
  fit?: string
}

export function parseImageOptionString(optionsStr: string): CfImageOptions {
  const image: CfImageOptions = {}
  for (const part of optionsStr.split(',')) {
    const eq = part.indexOf('=')
    if (eq === -1) continue
    const key = part.slice(0, eq).trim()
    const value = part.slice(eq + 1).trim()
    if (key === 'width' || key === 'height' || key === 'quality') {
      const n = Number(value)
      if (!Number.isNaN(n)) image[key] = n
    } else if (key === 'format' || key === 'fit') {
      image[key] = value
    }
  }
  return image
}

/** Returns source URL + cf.image options when pathname is a `/cdn-cgi/image/...` request. */
export function parseCdnCgiImageRequest(url: URL): { sourceUrl: string; image: CfImageOptions } | null {
  const match = url.pathname.match(/^\/cdn-cgi\/image\/([^/]+)\/(https:\/.+)$/i)
  if (!match) return null
  return {
    image: parseImageOptionString(match[1]),
    sourceUrl: match[2],
  }
}
