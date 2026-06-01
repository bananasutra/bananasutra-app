export const BBB_NOT_FOUND_CONTEXT_PATH = '/oops'

const KNOWN_PATH_PATTERNS: RegExp[] = [
  /^\/$/,
  /^\/songs\/?$/,
  /^\/songs\/[^/]+\/?$/,
  /^\/songbooks\/?$/,
  /^\/songbooks\/[^/]+\/?$/,
  /^\/tracks\/?$/,
  /^\/videos\/?$/,
  /^\/words\/?$/,
  /^\/about\/?$/,
  /^\/about\/sutras\/?$/,
  /^\/about\/muses\/?$/,
  /^\/about\/quotes\/?$/,
  /^\/about\/[^/]+\/?$/,
  /^\/style-guide\/?$/,
  /^\/sitemap\/?$/,
  /^\/search\/?$/,
]

export const isKnownCatalogPath = (pathname: string): boolean => {
  const normalized = pathname.trim() || '/'
  return KNOWN_PATH_PATTERNS.some((pattern) => pattern.test(normalized))
}

export const toBbbPageContextPathname = (pathname: string): string =>
  isKnownCatalogPath(pathname) ? pathname : BBB_NOT_FOUND_CONTEXT_PATH

export type BbbOpenEventDetail = {
  reason: '404'
  badPath: string
}

export const buildNotFoundOpenEventDetail = (pathname: string): BbbOpenEventDetail => ({
  reason: '404',
  badPath: pathname.trim() || '/',
})
