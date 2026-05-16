/** Shared SEO strings — keep in sync with `scripts/generate-seo-metadata.mjs`. */
export const SITE = 'BANANASUTRA'
export const DEFAULT_DESC =
  'BANANASUTRA — songs for a world gone bananas. Explore the catalog: browse songs by sutra, topic, intention, and sound.'
export const SITE_URL = 'https://bananasutra.com'
export const DEFAULT_OG_IMAGE_URL = 'https://bananasutra.com/og/site.png'

/** Google-friendly snippet floor — keep copy aligned with `scripts/generate-seo-metadata.mjs`. */
export const META_DESC_MIN_LEN = 100
export const META_DESC_PAD =
  'Part of the BANANASUTRA catalog — explore sutras, songbooks, lyrics, SoundCloud tracks, and curated playlists.'

export function padMetaDescription(raw: string): string {
  const d = (raw || '').trim()
  if (d.length >= META_DESC_MIN_LEN) return d
  const punct = d && !d.endsWith('.') ? '.' : ''
  const combo = `${d}${punct} ${META_DESC_PAD}`.trim()
  if (combo.length >= META_DESC_MIN_LEN) return combo
  return combo.padEnd(META_DESC_MIN_LEN, '—').slice(0, META_DESC_MIN_LEN).trimEnd()
}

export function publicTitle(shortTitle: string): string {
  const t = (shortTitle || '').trim()
  return t.includes(SITE) ? t : `${t} · ${SITE}`
}

export function songOgImageUrl(canonicalSlug: string): string {
  const s = canonicalSlug.trim()
  if (!s) return DEFAULT_OG_IMAGE_URL
  return `${SITE_URL}/og/songs/${s}.png`
}
