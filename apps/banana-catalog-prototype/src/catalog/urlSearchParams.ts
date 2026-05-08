/** Parse `location.search` or any `?foo=bar` fragment into `URLSearchParams`. */
export function searchParamsFromSearchString(search: string): URLSearchParams {
  const q = search.startsWith('?') ? search.slice(1) : search
  return new URLSearchParams(q)
}
