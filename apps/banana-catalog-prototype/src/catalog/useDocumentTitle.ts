import { useEffect } from 'react'

const SITE = 'BANANASUTRA'

/** Sets `document.title` for the route; restores previous title on unmount. */
export function useDocumentTitle(pageTitle: string) {
  useEffect(() => {
    const prev = document.title
    document.title = pageTitle.includes(SITE) ? pageTitle : `${pageTitle} · ${SITE}`
    return () => {
      document.title = prev
    }
  }, [pageTitle])
}
