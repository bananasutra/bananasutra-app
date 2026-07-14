/**
 * Set only during R24 Node prerender (`renderToString`).
 * Lets components avoid Suspense/lazy and other client-only paths that break static HTML.
 */
let catalogPrerenderActive = false

export function setCatalogPrerenderActive(active: boolean): void {
  catalogPrerenderActive = active
}

export function isCatalogPrerender(): boolean {
  return catalogPrerenderActive
}
