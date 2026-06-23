import { lazy, Suspense } from 'react'

const LazyNotFoundRoute = lazy(() =>
  import('./NotFoundRoute').then((m) => ({ default: m.NotFoundRoute })),
)

/** OOOPS 404 — lazy-loaded so song/songbook route chunks do not import the entry bundle. */
export function CatalogNotFoundPage() {
  return (
    <Suspense fallback={null}>
      <LazyNotFoundRoute />
    </Suspense>
  )
}
