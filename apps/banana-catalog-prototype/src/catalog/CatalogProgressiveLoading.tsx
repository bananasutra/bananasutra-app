import './CatalogProgressiveLoading.css'

type Variant = 'page' | 'inline'

type Props = {
  /** Visible status copy. Trailing ellipsis is stripped; CSS dots animate instead. */
  label: string
  /**
   * Screen-reader label when visible copy is playful.
   * Defaults to `label` (after ellipsis strip).
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
 */
export function CatalogProgressiveLoading({
  label,
  ariaLabel,
  variant = 'inline',
  className,
}: Props) {
  const text = normalizeLabel(label)
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
