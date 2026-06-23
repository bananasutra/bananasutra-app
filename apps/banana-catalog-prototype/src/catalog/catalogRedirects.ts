import catalogRedirectsFile from '../../catalog-redirects.json'

export type CatalogRedirectEntry = {
  from: string
  to: string
  reason?: string
}

/** Strip trailing slash except preserve `/`. */
export function normalizeRedirectPathname(pathname: string): string {
  let path = (pathname || '').trim() || '/'
  if (path.length > 1 && path.endsWith('/')) {
    path = path.slice(0, -1)
  }
  return path
}

const REDIRECT_LOOKUP = new Map<string, string>(
  (catalogRedirectsFile.redirects as CatalogRedirectEntry[]).map((entry) => [
    normalizeRedirectPathname(entry.from),
    entry.to,
  ]),
)

/** Resolve a legacy catalog path to its canonical target, or null. */
export function resolveCatalogRedirect(pathname: string): string | null {
  return REDIRECT_LOOKUP.get(normalizeRedirectPathname(pathname)) ?? null
}
