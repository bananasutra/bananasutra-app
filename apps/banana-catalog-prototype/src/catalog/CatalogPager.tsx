import { Link } from 'react-router-dom'
import './CatalogPager.css'

export type CatalogPagerProps = {
  variant: 'top' | 'bottom'
  safePage: number
  pageCount: number
  totalInView: number
  pageSize: number
  pagerLink: (page: number) => string
}

export function CatalogPager({
  variant,
  safePage,
  pageCount,
  totalInView,
  pageSize,
  pagerLink,
}: CatalogPagerProps) {
  const atFirst = safePage <= 1
  const atLast = safePage >= pageCount
  const label = variant === 'top' ? 'Pagination' : 'Pagination (end of list)'
  const rangeStart = totalInView === 0 ? 0 : (safePage - 1) * pageSize + 1
  const rangeEnd = Math.min(safePage * pageSize, totalInView)

  return (
    <nav className={`catalog-pager catalog-pager--${variant}`} aria-label={label}>
      <span className="catalog-pager__meta">
        Showing {rangeStart}–{rangeEnd} of {totalInView} · page {safePage} of {pageCount} · {pageSize} per page
      </span>
      <div className="catalog-pager__nav">
        <Link
          className={`catalog-pager__link${atFirst ? ' catalog-pager__link--disabled' : ''}`}
          to={pagerLink(1)}
          aria-disabled={atFirst}
          tabIndex={atFirst ? -1 : undefined}
        >
          First
        </Link>
        <span className="catalog-pager__dot" aria-hidden={true}>
          ·
        </span>
        <Link
          className={`catalog-pager__link${atFirst ? ' catalog-pager__link--disabled' : ''}`}
          to={pagerLink(safePage - 1)}
          aria-disabled={atFirst}
          tabIndex={atFirst ? -1 : undefined}
        >
          Previous
        </Link>
        <span className="catalog-pager__dot" aria-hidden={true}>
          ·
        </span>
        <Link
          className={`catalog-pager__link${atLast ? ' catalog-pager__link--disabled' : ''}`}
          to={pagerLink(safePage + 1)}
          aria-disabled={atLast}
          tabIndex={atLast ? -1 : undefined}
        >
          Next
        </Link>
        <span className="catalog-pager__dot" aria-hidden={true}>
          ·
        </span>
        <Link
          className={`catalog-pager__link${atLast ? ' catalog-pager__link--disabled' : ''}`}
          to={pagerLink(pageCount)}
          aria-disabled={atLast}
          tabIndex={atLast ? -1 : undefined}
        >
          Last
        </Link>
      </div>
    </nav>
  )
}
