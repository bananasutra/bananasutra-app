import { forwardRef, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import chromeStatsJson from '../data/generated/catalog_chrome_stats.json'
import { DiscoverySearchLazy } from './DiscoverySearchLazy'
import { SITE_NAV_PRIMARY, siteNavItemActive } from './siteNav'
import { ThemeToggle } from './ThemeToggle'
import './DiscoverySearch.css'
import './GlobalHeader.css'
import './CatalogApp.css'

export type GlobalHeaderProps = {
  right?: ReactNode
}

function navLinkClass(active: boolean): string {
  return `global-header-nav__link${active ? ' is-active' : ''}`
}

type CatalogChromeStats = {
  sutraCount: number
  songbookCount: number
  songCount: number
}

const chromeStats = chromeStatsJson as CatalogChromeStats
const { sutraCount, songbookCount, songCount } = chromeStats

export const GlobalHeader = forwardRef<HTMLElement, GlobalHeaderProps>(function GlobalHeader({ right }, ref) {
  const { pathname } = useLocation()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const headerElRef = useRef<HTMLElement | null>(null)
  const primaryNavId = useId()

  useEffect(() => {
    setMobileMenuOpen(false)
  }, [pathname])

  const setHeaderRef = (node: HTMLElement | null) => {
    headerElRef.current = node
    if (typeof ref === 'function') {
      ref(node)
    } else if (ref) {
      ref.current = node
    }
  }

  return (
    <header ref={setHeaderRef} className="catalog-header catalog-header--fixed global-header global-header--discovery-only">
      <div className="catalog-header-inner global-header-inner global-header__bar">
        <div className="global-header-brand global-header__brand">
          <Link to="/" className="global-header-brand-link bananasutra-wordmark">
            BANANASUTRA
          </Link>
          <p className="global-header-tagline global-header-tagline--compact bananasutra-tagline">
            Songs for a world gone bananas.
          </p>
        </div>

        <button
          type="button"
          className="global-header-menu-toggle"
          aria-expanded={mobileMenuOpen}
          aria-controls={primaryNavId}
          onClick={() => setMobileMenuOpen((open) => !open)}
        >
          <span className="global-header-menu-toggle__icon" aria-hidden="true" />
          {mobileMenuOpen ? 'CLOSE' : 'MENU'}
        </button>

        <nav
          id={primaryNavId}
          className={`global-header-nav${mobileMenuOpen ? ' is-open' : ''}`}
          aria-label="Primary"
        >
          <ul className="global-header-nav__list">
            <li>
              <Link
                to="/"
                className={navLinkClass(pathname === '/')}
                aria-current={pathname === '/' ? 'page' : undefined}
                aria-label="Home"
              >
                HOME
              </Link>
            </li>
            {SITE_NAV_PRIMARY.map((item) => {
              const active = siteNavItemActive(pathname, item)
              return (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    className={navLinkClass(active)}
                    aria-current={active ? 'page' : undefined}
                  >
                    {item.label}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        <DiscoverySearchLazy variant="header" />
        <p className="global-header-stats" aria-label="Catalog scale: sutras, songbooks, songs">
          {`${sutraCount} SUTRAS · ${songbookCount} SONGBOOKS · ${songCount} SONGS`}
        </p>

        <div className="global-header-right global-header__slot">
          <ThemeToggle />
          {right}
        </div>
      </div>
    </header>
  )
})
