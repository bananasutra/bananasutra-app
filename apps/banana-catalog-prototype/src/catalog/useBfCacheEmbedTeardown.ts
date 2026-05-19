import { useEffect } from 'react'

const BF_CACHE_BLOCKING_IFRAME_SELECTOR = 'iframe.sc-embed-frame, iframe.yt-embed-frame'

/**
 * SoundCloud's player iframe registers `unload` handlers that block back/forward cache.
 * Tear down embeds when the page is frozen for bfcache so return navigations can restore.
 */
export function useBfCacheEmbedTeardown(): void {
  useEffect(() => {
    const onPageHide = (event: PageTransitionEvent) => {
      if (!event.persisted) return
      document.querySelectorAll(BF_CACHE_BLOCKING_IFRAME_SELECTOR).forEach((node) => {
        node.remove()
      })
    }

    window.addEventListener('pagehide', onPageHide)
    return () => window.removeEventListener('pagehide', onPageHide)
  }, [])
}
