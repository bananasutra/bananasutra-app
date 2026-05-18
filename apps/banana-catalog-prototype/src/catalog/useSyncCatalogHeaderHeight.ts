import { useLayoutEffect, type RefObject } from 'react'

/** Sets `--catalog-header-h` on `pageRef` from `headerRef` height (see `.catalog.catalog-page` in CatalogApp.css). */
export function useSyncCatalogHeaderHeight(
  pageRef: RefObject<HTMLElement | null>,
  headerRef: RefObject<HTMLElement | null>,
  deps: readonly unknown[],
) {
  useLayoutEffect(() => {
    const page = pageRef.current
    const header = headerRef.current
    if (!page || !header) return

    const applyHeight = (heightPx: number) => {
      const px = `${heightPx}px`
      page.style.setProperty('--catalog-header-h', px)
      document.documentElement.style.setProperty('--catalog-header-h', px)
    }

    const ro = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) applyHeight(entry.contentRect.height)
    })
    ro.observe(header)

    return () => {
      ro.disconnect()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- callers pass explicit resize triggers
  }, deps)
}

/** Imperative remeasure after async layout (e.g. catalog data swap on deep link). */
export function syncCatalogHeaderHeightNow(
  pageRef: RefObject<HTMLElement | null>,
  headerRef: RefObject<HTMLElement | null>,
): void {
  const page = pageRef.current
  const header = headerRef.current
  if (!page || !header) return
  applyHeightFromHeader(page, header)
}

function applyHeightFromHeader(page: HTMLElement, header: HTMLElement): void {
  const px = `${header.getBoundingClientRect().height}px`
  page.style.setProperty('--catalog-header-h', px)
  document.documentElement.style.setProperty('--catalog-header-h', px)
}
