import { useEffect, useLayoutEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'

/**
 * React Router navigations use startTransition; with lazy routes, React often keeps the
 * *previous* screen visible until the new chunk + JSON is ready — so Suspense fallbacks
 * feel invisible. Show an indeterminate bar when an in-app navigation actually starts.
 *
 * Important: use **click** (not pointerdown). On mobile, pointerdown on a link fires when
 * the user begins a scroll gesture; navigation never runs but the bar would stay stuck.
 */
export function NavigationLoadingBridge() {
  const location = useLocation()
  const [routePending, setRoutePending] = useState(false)

  useLayoutEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hide bar when URL commits
    setRoutePending(false)
  }, [location.pathname, location.search])

  useEffect(() => {
    if (!routePending) return
    const id = window.setTimeout(() => setRoutePending(false), 6_000)
    return () => window.clearTimeout(id)
  }, [routePending])

  useEffect(() => {
    const considerInternalNav = (target: EventTarget | null) => {
      if (!(target instanceof Element)) return false
      const a = target.closest('a[href]')
      if (!(a instanceof HTMLAnchorElement)) return false
      if (a.hasAttribute('download')) return false
      const hrefAttr = a.getAttribute('href')
      if (!hrefAttr || hrefAttr.startsWith('mailto:') || hrefAttr.startsWith('tel:')) return false

      let nextUrl: URL
      try {
        nextUrl = new URL(a.href)
      } catch {
        return false
      }

      if (nextUrl.origin !== window.location.origin) return false

      const cur = new URL(window.location.href)
      if (nextUrl.pathname === cur.pathname && nextUrl.search === cur.search) return false

      return true
    }

    const onClick = (e: MouseEvent) => {
      if (e.button !== 0) return
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      if (!considerInternalNav(e.target)) return
      setRoutePending(true)
    }

    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [])

  if (!routePending) return null

  return (
    <div
      className="nav-route-loading-bar"
      role="progressbar"
      aria-label="Loading page"
      aria-busy="true"
    />
  )
}
