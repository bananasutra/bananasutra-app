import { CATALOG_INFINITE_SCROLL_BATCH } from './useCatalogInfiniteScroll'

type CatalogInfiniteScrollFooterProps = {
  visibleCount: number
  totalCount: number
  hasMore: boolean
  loadMore: () => void
  /** e.g. "music videos" — appended after count line. */
  noun: string
  formatCount?: (n: number) => string
}

function defaultFormatCount(n: number): string {
  return n.toLocaleString('en-US')
}

export function CatalogInfiniteScrollFooter({
  visibleCount,
  totalCount,
  hasMore,
  loadMore,
  noun,
  formatCount = defaultFormatCount,
}: CatalogInfiniteScrollFooterProps) {
  if (totalCount === 0) return null

  const remaining = totalCount - visibleCount
  const nextLoad = Math.min(CATALOG_INFINITE_SCROLL_BATCH, remaining)

  return (
    <div className="catalog-infinite-scroll-footer">
      <p className="catalog-infinite-scroll-status about-result-count" aria-live="polite">
        Showing {formatCount(visibleCount)} of {formatCount(totalCount)} {noun}
      </p>
      {hasMore ? (
        <button type="button" className="catalog-index-show-more" onClick={loadMore}>
          Load more ({formatCount(nextLoad)} more)
        </button>
      ) : null}
    </div>
  )
}
