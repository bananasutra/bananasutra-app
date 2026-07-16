import './CatalogProgressiveLoading.css'

type Variant = 'page' | 'inline'

type Props = {
  /** Short status copy, e.g. "Loading song". Trailing ellipsis is stripped; CSS dots animate instead. */
  label: string
  /** `page` = content-shaped skeleton under the header; `inline` = compact mark for section waits. */
  variant?: Variant
  className?: string
}

function normalizeLabel(label: string): string {
  return label.replace(/\u2026|\.{2,}$/u, '').trimEnd()
}

/**
 * Lightweight progressive loading treatment: CSS-only motion, existing shimmer tokens,
 * respects prefers-reduced-motion. No images, no timers, no JS animation loops.
 */
export function CatalogProgressiveLoading({ label, variant = 'inline', className }: Props) {
  const text = normalizeLabel(label)
  const rootClass = [
    'catalog-progressive-loading',
    `catalog-progressive-loading--${variant}`,
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={rootClass} role="status" aria-live="polite" aria-busy="true">
      {variant === 'page' ? (
        <div className="catalog-progressive-loading__stage" aria-hidden>
          <div className="catalog-progressive-loading__cover">
            <span className="thumb-shimmer" />
            <span className="catalog-progressive-loading__cover-glow" />
          </div>
          <div className="catalog-progressive-loading__lines">
            <span className="catalog-progressive-loading__line catalog-progressive-loading__line--title" />
            <span className="catalog-progressive-loading__line catalog-progressive-loading__line--meta" />
            <span className="catalog-progressive-loading__line catalog-progressive-loading__line--body" />
          </div>
        </div>
      ) : (
        <span className="catalog-progressive-loading__pulse" aria-hidden>
          <span className="catalog-progressive-loading__pulse-ring" />
          <span className="catalog-progressive-loading__pulse-core" />
        </span>
      )}
      <p className="catalog-progressive-loading__label">
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
