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

/** Avoid stale intermediary caches after deploys (stable URLs under `/catalog-data/`). */
export function fetchCatalogData(url: string): Promise<Response> {
  return fetch(url, { cache: 'no-store' })
}
