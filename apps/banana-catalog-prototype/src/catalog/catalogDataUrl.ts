import type { CatalogDataFilename } from './catalogDataUrl.types'

export type { CatalogDataFilename }

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

/**
 * Default stays `no-store` for deploy freshness on stable `/catalog-data/*.json` paths.
 * Callers can override when route performance benefits from normal browser caching.
 */
export function fetchCatalogData(url: string, init?: RequestInit): Promise<Response> {
  return fetch(url, { cache: 'no-store', ...init })
}
