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
  const mobileMenuLabel = mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'

  useEffect(() => {
    setMobileMenuOpen(false)
  }, [pathname])

  useEffect(() => {
    document.body.classList.toggle('global-mobile-menu-open', mobileMenuOpen)
    return () => {
      document.body.classList.remove('global-mobile-menu-open')
    }
  }, [mobileMenuOpen])

  useEffect(() => {
    if (!mobileMenuOpen) return
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileMenuOpen(false)
      }
    }
    window.addEventListener('keydown', onEscape)
    return () => window.removeEventListener('keydown', onEscape)
  }, [mobileMenuOpen])

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
          aria-label={mobileMenuLabel}
          title={mobileMenuLabel}
          onClick={() => setMobileMenuOpen((open) => !open)}
        >
          <span className="global-header-menu-toggle__icon" aria-hidden="true" />
          <span className="visually-hidden">{mobileMenuLabel}</span>
        </button>

        <nav
          id={primaryNavId}
          className={`global-header-nav${mobileMenuOpen ? ' is-open' : ''}`}
          aria-label="Primary"
        >
          <div className="global-header-nav__mobile-controls">
            <span className="global-header-nav__mobile-theme-label">Theme</span>
            <ThemeToggle />
          </div>
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

        <button
          type="button"
          className={`global-header-menu-backdrop${mobileMenuOpen ? ' is-open' : ''}`}
          onClick={() => setMobileMenuOpen(false)}
          aria-label="Close navigation menu"
          tabIndex={mobileMenuOpen ? 0 : -1}
        />

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
