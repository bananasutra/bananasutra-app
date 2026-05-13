import { useEffect } from 'react'

/** Bot/build parity: keep route copy aligned with `_docs/planning/SEO/SEO-METADATA-PARITY-R19.md`. */
const SITE = 'BANANASUTRA'
const DEFAULT_DESC =
  'BANANASUTRA — songs for a world gone bananas. Explore the catalog: browse songs by sutra, topic, intention, and sound.'
const DEFAULT_IMAGE = 'https://bananasutra.com/android-chrome-512x512.png'
const SITE_URL = 'https://bananasutra.com'

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
    setMetaTag('og:image', image || DEFAULT_IMAGE)
    setMetaTag('og:site_name', SITE)

    setMetaTag('twitter:card', 'summary')
    setMetaTag('twitter:title', fullTitle)
    setMetaTag('twitter:description', desc)
    setMetaTag('twitter:image', image || DEFAULT_IMAGE)

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
