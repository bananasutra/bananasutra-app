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

    const sync = () => {
      page.style.setProperty('--catalog-header-h', `${header.offsetHeight}px`)
    }

    sync()
    const ro = new ResizeObserver(sync)
    ro.observe(header)
    return () => ro.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- callers pass explicit resize triggers
  }, deps)
}
