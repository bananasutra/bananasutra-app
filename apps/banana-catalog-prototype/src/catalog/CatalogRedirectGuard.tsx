import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { resolveCatalogRedirect } from './catalogRedirects'

/** SPA guard — runs before route matching so renamed slugs never hit detail 404 UI. */
export function CatalogRedirectGuard({ children }: { children: ReactNode }) {
  const location = useLocation()
  const to = resolveCatalogRedirect(location.pathname)
  if (to) {
    return <Navigate to={`${to}${location.search}${location.hash}`} replace />
  }
  return children
}
