import { useState } from 'react'
import './CatalogProgressiveLoading.css'
import { pickCatalogPageLoadingLine } from './catalogPageLoadingCopy'

export { CATALOG_PAGE_LOADING_LINES } from './catalogPageLoadingCopy'

type Variant = 'page' | 'inline'

type Props = {
  /** Visible status copy when not using `labels`. Trailing ellipsis is stripped. */
  label?: string
  /**
   * When set, one line is picked at random on mount (stable for that wait).
   * Prefer this for playful page waits.
   */
  labels?: readonly string[]
  /**
   * Screen-reader label when visible copy is playful.
   * Defaults to the visible line.
   */
  ariaLabel?: string
  /** `page` = centered hero wait; `inline` = compact mark for section waits. */
  variant?: Variant
  className?: string
}

function normalizeLabel(label: string): string {
  return label.replace(/\u2026|\.{2,}$/u, '').trimEnd()
}

/**
 * Lightweight progressive loading: CSS-only motion, respects prefers-reduced-motion.
 * No images, no JS animation loops.
 *
 * Do not import this module from App.tsx / the entry bundle — it must stay in lazy
 * route chunks (see verify-build-chunks.mjs circular-dep guard).
 */
export function CatalogProgressiveLoading({
  label = 'Loading',
  labels,
  ariaLabel,
  variant = 'inline',
  className,
}: Props) {
  const [text] = useState(() =>
    labels && labels.length > 0 ? pickCatalogPageLoadingLine(labels) : normalizeLabel(label),
  )
  const announced = ariaLabel ? normalizeLabel(ariaLabel) : text
  const rootClass = [
    'catalog-progressive-loading',
    `catalog-progressive-loading--${variant}`,
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div
      className={rootClass}
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={announced}
    >
      <span className="catalog-progressive-loading__spinner" aria-hidden />
      <p className="catalog-progressive-loading__label" aria-hidden={ariaLabel ? true : undefined}>
        {text}
        <span className="catalog-progressive-loading__dots" aria-hidden>
          <span />
          <span />
          <span />
        </span>
      </p>
    </div>
  )
}
