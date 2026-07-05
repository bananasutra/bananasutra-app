import { Link } from 'react-router-dom'
import { formatHomeCount, type HomeStatsSummaryItem } from './homePortalData'

type Props = {
  items: HomeStatsSummaryItem[]
  /** `home` — large hero row on homepage; `footer` — subdued full-bleed band above contact on subpages. */
  variant?: 'home' | 'footer'
}

/** §7 — catalog scale row; echoes header stats plus videos. */
export function HomeStatsSummary({ items, variant = 'home' }: Props) {
  if (!items.length) return null

  return (
    <nav
      className={`home-stats-summary${variant === 'footer' ? ' home-stats-summary--footer' : ''}`}
      aria-label="Catalog scale"
    >
      {items.map((item) => (
        <Link key={item.label} className="home-stats-summary__item" to={item.href} aria-label={item.ariaLabel}>
          <span className="home-stats-summary__num">{formatHomeCount(item.value)}</span>
          <span className="home-stats-summary__label">{item.label}</span>
        </Link>
      ))}
    </nav>
  )
}
