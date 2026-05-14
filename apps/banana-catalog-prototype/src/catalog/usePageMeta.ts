import { useEffect } from 'react'

/** Bot/build parity: keep route copy aligned with `_docs/planning/SEO/SEO-METADATA-PARITY-R19.md`. */
const SITE = 'BANANASUTRA'
const DEFAULT_DESC =
  'BANANASUTRA — songs for a world gone bananas. Explore the catalog: browse songs by sutra, topic, intention, and sound.'
/** Non-song routes + shell fallback — composite `dist/og/site.png` (630 slot + copy). Same as `index.html` default OG. */
export const DEFAULT_OG_IMAGE_URL = 'https://bananasutra.com/og/site.png'
const SITE_URL = 'https://bananasutra.com'

/** Per-song composite PNG (`dist/og/songs/{slug}.png`) — built for every browse slug. */
export function songOgImageUrl(canonicalSlug: string): string {
  const s = canonicalSlug.trim()
  if (!s) return DEFAULT_OG_IMAGE_URL
  return `${SITE_URL}/og/songs/${s}.png`
}

export interface PageMeta {
  title: string
  description?: string
  image?: string
  /** e.g. '/songs' — used for canonical + og:url */
  path?: string
}

function setMetaTag(property: string, content: string) {
  const attr = property.startsWith('og:') || property.startsWith('article:') ? 'property' : 'name'
  let el = document.querySelector(`meta[${attr}="${property}"]`) as HTMLMetaElement | null
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, property)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

function setCanonical(url: string) {
  let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null
  if (!link) {
    link = document.createElement('link')
    link.setAttribute('rel', 'canonical')
    document.head.appendChild(link)
  }
  link.setAttribute('href', url)
}

/** Sets document title, meta description, OG/Twitter tags, and optional canonical URL. Restores title on unmount. */
export function usePageMeta({ title, description, image, path }: PageMeta) {
  useEffect(() => {
    const prev = document.title
    document.title = title.includes(SITE) ? title : `${title} · ${SITE}`

    const desc = description || DEFAULT_DESC
    setMetaTag('description', desc)

    const fullTitle = title.includes(SITE) ? title : `${title} · ${SITE}`
    setMetaTag('og:title', fullTitle)
    setMetaTag('og:description', desc)
    setMetaTag('og:type', 'website')
    const ogImage = image ?? DEFAULT_OG_IMAGE_URL
    setMetaTag('og:image', ogImage)
    setMetaTag('og:site_name', SITE)

    setMetaTag('twitter:card', 'summary_large_image')
    setMetaTag('twitter:title', fullTitle)
    setMetaTag('twitter:description', desc)
    setMetaTag('twitter:image', ogImage)

    if (path) {
      const url = `${SITE_URL}${path}`
      setMetaTag('og:url', url)
      setCanonical(url)
    }

    return () => {
      document.title = prev
    }
  }, [title, description, image, path])
}
