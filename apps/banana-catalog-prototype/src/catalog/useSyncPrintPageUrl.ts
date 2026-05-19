import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

/** Sets `--print-page-url` on `<html>` for global print footer (actual page URL). */
export function useSyncPrintPageUrl(): void {
  const { pathname, search } = useLocation()

  useEffect(() => {
    const origin = window.location.origin
    const url = `${origin}${pathname}${search}`
    document.documentElement.style.setProperty('--print-page-url', JSON.stringify(url))
  }, [pathname, search])
}
