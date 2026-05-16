import { Helmet } from 'react-helmet-async'
import { DEFAULT_DESC, DEFAULT_OG_IMAGE_URL, SITE, SITE_URL, publicTitle, padMetaDescription } from './pageMetaConstants'

export { DEFAULT_OG_IMAGE_URL, songOgImageUrl } from './pageMetaConstants'

export interface PageMetaProps {
  title: string
  description?: string
  image?: string
  /** e.g. '/songs' — canonical + og:url */
  path?: string
  /** ISO date for article:published_time */
  publishedAt?: string
  /** Optional JSON-LD object (rendered as application/ld+json) */
  jsonLd?: Record<string, unknown> | Record<string, unknown>[]
}

function toIsoDateTime(value: string | undefined): string | undefined {
  const v = (value || '').trim()
  if (!v) return undefined
  if (v.includes('T')) return v
  return `${v.slice(0, 10)}T00:00:00Z`
}

/** Static + client head tags (R24 pre-render via react-helmet-async). */
export function PageMeta({ title, description, image, path, publishedAt, jsonLd }: PageMetaProps) {
  const desc = padMetaDescription((description || '').trim() || DEFAULT_DESC)
  const fullTitle = publicTitle(title)
  const ogImage = image ?? DEFAULT_OG_IMAGE_URL
  const canonical = path ? `${SITE_URL}${path}` : undefined
  const publishedIso = toIsoDateTime(publishedAt)

  const ldBlocks = jsonLd
    ? Array.isArray(jsonLd)
      ? jsonLd
      : [jsonLd]
    : []

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={desc} />
      <meta name="author" content="BANANASUTRA" />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={desc} />
      <meta property="og:type" content="website" />
      <meta property="og:image" content={ogImage} />
      <meta property="og:site_name" content={SITE} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={desc} />
      <meta name="twitter:image" content={ogImage} />
      {canonical ? <meta property="og:url" content={canonical} /> : null}
      {canonical ? <link rel="canonical" href={canonical} /> : null}
      {publishedIso ? <meta property="article:published_time" content={publishedIso} /> : null}
      {publishedIso ? <meta property="og:updated_time" content={publishedIso} /> : null}
      {ldBlocks.map((block, i) => (
        <script key={i} type="application/ld+json">
          {JSON.stringify(block)}
        </script>
      ))}
    </Helmet>
  )
}
