import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void
  }
}

export function useAnalyticsPageView() {
  const { pathname, search } = useLocation()
  const isFirst = useRef(true)

  useEffect(() => {
    // Skip the very first render — gtag config already fires one if
    // send_page_view were true, but we disabled it so we send manually
    // for every navigation including the first.
    if (isFirst.current) {
      isFirst.current = false
    }

    const normalizedPath = pathname.length > 1 ? pathname.replace(/\/$/, '') : pathname
    window.gtag?.('event', 'page_view', {
      page_path: normalizedPath + search,
      page_location: window.location.href,
    })
  }, [pathname, search])
}
