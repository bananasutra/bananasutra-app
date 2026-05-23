import type { CatalogDataFilename } from './catalogDataUrl.types'

export type { CatalogDataFilename }

type CatalogJsonFallbackModule = { default?: unknown } | unknown

const CATALOG_FILENAMES: readonly CatalogDataFilename[] = [
  'song_catalog.json',
  'song_catalog_browse.json',
  'song_search_deep.json',
  'song_detail.json',
  'youtube_by_lyrics_id.json',
  'track_catalog.json',
  'muses_catalog.json',
  'quotes_wall.json',
]

const CATALOG_FILENAME_SET = new Set<string>(CATALOG_FILENAMES)

const fallbackCatalogLoaders: Record<CatalogDataFilename, () => Promise<CatalogJsonFallbackModule>> = {
  'song_catalog.json': () => import('../data/generated/song_catalog.json'),
  'song_catalog_browse.json': () => import('../data/generated/song_catalog_browse.json'),
  'song_search_deep.json': () => import('../data/generated/song_search_deep.json'),
  'song_detail.json': () => import('../data/generated/song_detail.json'),
  'youtube_by_lyrics_id.json': () => import('../data/generated/youtube_by_lyrics_id.json'),
  'track_catalog.json': () => import('../data/generated/track_catalog.json'),
  'muses_catalog.json': () => import('../data/generated/muses_catalog.json'),
  'quotes_wall.json': () => import('../data/generated/quotes_wall.json'),
}

const fallbackCatalogCache = new Map<CatalogDataFilename, unknown>()

/**
 * Stable `/catalog-data/*.json` URLs for runtime `fetch`.
 *
 * Production: files copied to `dist/catalog-data/` by `scripts/sync-catalog-data-dist.mjs`.
 * Dev: served from `src/data/generated/` via `catalogDataDevPlugin` in `vite.config.ts`.
 */
export function catalogDataFileUrl(filename: CatalogDataFilename): string {
  const base = import.meta.env.BASE_URL
  const prefix = base.endsWith('/') ? base : `${base}/`
  return `${prefix}catalog-data/${filename}`
}

function catalogFilenameFromUrl(url: string): CatalogDataFilename | null {
  const clean = url.split('?')[0] ?? url
  const marker = '/catalog-data/'
  const markerIdx = clean.indexOf(marker)
  if (markerIdx >= 0) {
    const candidate = clean.slice(markerIdx + marker.length)
    if (CATALOG_FILENAME_SET.has(candidate)) return candidate as CatalogDataFilename
  }
  try {
    const parsed = new URL(url, 'http://catalog.local')
    const filename = parsed.pathname.split('/').filter(Boolean).at(-1) ?? ''
    if (CATALOG_FILENAME_SET.has(filename)) return filename as CatalogDataFilename
  } catch {
    return null
  }
  return null
}

function responseLooksLikeHtml(res: Response): boolean {
  const contentType = res.headers.get('content-type')?.toLowerCase() ?? ''
  return contentType.includes('text/html')
}

function normalizeFallbackModule(mod: CatalogJsonFallbackModule): unknown {
  if (mod && typeof mod === 'object' && 'default' in mod) {
    return (mod as { default: unknown }).default
  }
  return mod
}

async function fallbackCatalogResponse(url: string): Promise<Response | null> {
  const filename = catalogFilenameFromUrl(url)
  if (!filename) return null
  if (!fallbackCatalogCache.has(filename)) {
    const loader = fallbackCatalogLoaders[filename]
    if (!loader) return null
    try {
      const mod = await loader()
      fallbackCatalogCache.set(filename, normalizeFallbackModule(mod))
    } catch {
      return null
    }
  }
  const payload = fallbackCatalogCache.get(filename)
  if (payload === undefined) return null
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'X-Catalog-Source': 'bundled-fallback',
    },
  })
}

/**
 * Default stays `no-store` for deploy freshness on stable `/catalog-data/*.json` paths.
 * Callers can override when route performance benefits from normal browser caching.
 */
export async function fetchCatalogData(url: string, init?: RequestInit): Promise<Response> {
  try {
    const res = await fetch(url, { cache: 'no-store', ...init })
    if (res.ok && !responseLooksLikeHtml(res)) return res
    const fallback = await fallbackCatalogResponse(url)
    return fallback ?? res
  } catch {
    const fallback = await fallbackCatalogResponse(url)
    if (fallback) return fallback
    throw new Error(`Failed to load catalog data: ${url}`)
  }
}
