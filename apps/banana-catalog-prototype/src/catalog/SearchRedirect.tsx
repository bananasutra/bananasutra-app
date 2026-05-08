import { Navigate, useSearchParams } from 'react-router-dom'

/** Legacy `/search?q=` bookmarks → home discovery with the same query. */
export function SearchRedirect() {
  const [params] = useSearchParams()
  const q = params.get('q') ?? ''
  const to = q ? `/?q=${encodeURIComponent(q)}` : '/'
  return <Navigate to={to} replace />
}
