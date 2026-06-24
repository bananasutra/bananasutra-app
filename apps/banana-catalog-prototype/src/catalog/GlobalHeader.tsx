import { forwardRef, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import chromeStatsJson from '../data/generated/catalog_chrome_stats.json'
import { DiscoverySearchLazy } from './DiscoverySearchLazy'
import {
  SITE_NAV_DRAWER,
  SITE_NAV_EXPERIENCE,
  experienceLpActive,
  siteNavItemActive,
  type DrawerNavItem,
  type ExperienceLp,
} from './siteNav'
import { trackModeChanged, type AnalyticsMode } from '../lib/analytics'
import { isFooterContactHref, openFooterContactPanel } from './footerContactConstants'
import { ThemeToggle } from './ThemeToggle'
import './DiscoverySearch.css'
import './GlobalHeader.css'
import './CatalogApp.css'

export type GlobalHeaderProps = {
  right?: ReactNode
}

function experienceLinkClass(active: boolean): string {
  return `global-header-experience__link${active ? ' is-active' : ''}`
}

function experienceLpToAnalyticsMode(id: ExperienceLp): AnalyticsMode {
  if (id === 'listen') return 'listen'
  if (id === 'watch') return 'watch'
  return 'read'
}

function drawerLinkClass(active: boolean, muted?: boolean): string {
  const parts = ['global-header-drawer__link']
  if (active) parts.push('is-active')
  if (muted) parts.push('global-header-drawer__link--muted')
  return parts.join(' ')
}

type CatalogChromeStats = {
  sutraCount: number
  songbookCount: number
  songCount: number
  topTrackCount?: number
}

const chromeStats = chromeStatsJson as CatalogChromeStats
const { sutraCount, songbookCount, songCount, topTrackCount = 0 } = chromeStats

function DrawerNavEntry({
  item,
  pathname,
  onNavigate,
}: {
  item: DrawerNavItem
  pathname: string
  onNavigate: () => void
}) {
  if (item.kind === 'separator') {
    return <div className="global-header-drawer__sep" role="presentation" />
  }

  if (item.kind === 'group') {
    const parentActive = siteNavItemActive(pathname, item)
    return (
      <div className="global-header-drawer__group">
        <Link
          to={item.to}
          className={drawerLinkClass(parentActive)}
          aria-current={parentActive ? 'page' : undefined}
          onClick={onNavigate}
        >
          {item.label}
        </Link>
        <div className="global-header-drawer__sub">
          {item.children.map((child) => {
            const childActive = siteNavItemActive(pathname, child)
            return (
              <Link
                key={child.to}
                to={child.to}
                className={drawerLinkClass(childActive)}
                aria-current={childActive ? 'page' : undefined}
                onClick={onNavigate}
              >
                {child.label}
              </Link>
            )
          })}
        </div>
      </div>
    )
  }

  const active = siteNavItemActive(pathname, item)
  const isContact = isFooterContactHref(item.to)
  return (
    <Link
      to={isContact ? '#' : item.to}
      className={drawerLinkClass(active, item.muted)}
      aria-current={active ? 'page' : undefined}
      onClick={(event) => {
        if (isContact) {
          event.preventDefault()
          onNavigate()
          openFooterContactPanel()
          return
        }
        onNavigate()
      }}
    >
      {item.label}
    </Link>
  )
}

export const GlobalHeader = forwardRef<HTMLElement, GlobalHeaderProps>(function GlobalHeader({ right }, ref) {
  const { pathname } = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const headerElRef = useRef<HTMLElement | null>(null)
  const drawerId = useId()
  const menuLabel = menuOpen ? 'Close navigation menu' : 'Open navigation menu'
  const activeLp = experienceLpActive(pathname)

  // Close drawer after in-app navigation (pathname-driven reset).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional menu close on route change
    setMenuOpen(false)
  }, [pathname])

  useEffect(() => {
    document.body.classList.toggle('global-header-menu-open', menuOpen)
    return () => {
      document.body.classList.remove('global-header-menu-open')
    }
  }, [menuOpen])

  useEffect(() => {
    if (!menuOpen) return
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false)
      }
    }
    window.addEventListener('keydown', onEscape)
    return () => window.removeEventListener('keydown', onEscape)
  }, [menuOpen])

  const setHeaderRef = (node: HTMLElement | null) => {
    headerElRef.current = node
    if (typeof ref === 'function') {
      ref(node)
    } else if (ref) {
      ref.current = node
    }
  }

  const closeMenu = () => setMenuOpen(false)

  const onExperienceNavClick = (target: ExperienceLp) => {
    const fromMode = activeLp ? experienceLpToAnalyticsMode(activeLp) : 'read'
    const toMode = experienceLpToAnalyticsMode(target)
    if (fromMode !== toMode) {
      trackModeChanged({ from: fromMode, to: toMode, surface: 'header_nav' })
    }
  }

  return (
    <header ref={setHeaderRef} className="catalog-header catalog-header--fixed global-header global-header--v3">
      <div className="catalog-header-inner global-header-inner global-header__bar">
        <div className="global-header__brand-block">
          <Link to="/" className="global-header-brand-link bananasutra-wordmark">
            BANANASUTRA
          </Link>
          <p className="global-header-tagline global-header-tagline--compact bananasutra-tagline">
            Songs for a world gone bananas.
          </p>
        </div>

        <p
          className="global-header-stats"
          aria-label="Catalog scale: sutras, songbooks, songs, and top tracks"
        >
          {`${sutraCount} SUTRAS · ${songbookCount} SONGBOOKS · ${songCount} SONGS · ${topTrackCount} TOP TRACKS`}
        </p>

        <div className="global-header__search-slot">
          <DiscoverySearchLazy variant="header" />
        </div>

        <nav className="global-header-experience" aria-label="Experience">
          <ul className="global-header-experience__list">
            {SITE_NAV_EXPERIENCE.map((item) => {
              const active = activeLp === item.id
              return (
                <li key={item.id}>
                  <Link
                    to={item.to}
                    className={experienceLinkClass(active)}
                    aria-current={active ? 'page' : undefined}
                    onClick={() => onExperienceNavClick(item.id)}
                  >
                    {item.label}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        <div className="global-header__actions">
          <button
            type="button"
            className="global-header-menu-toggle"
            aria-expanded={menuOpen}
            aria-controls={drawerId}
            aria-label={menuLabel}
            title={menuLabel}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span className="global-header-menu-toggle__icon" aria-hidden="true" />
            <span className="visually-hidden">{menuLabel}</span>
          </button>
          {right ? <div className="global-header__slot">{right}</div> : null}
        </div>
      </div>

      <button
        type="button"
        className={`global-header-menu-backdrop${menuOpen ? ' is-open' : ''}`}
        onClick={closeMenu}
        aria-label="Close navigation menu"
        tabIndex={menuOpen ? 0 : -1}
      />

      <nav
        id={drawerId}
        className={`global-header-drawer${menuOpen ? ' is-open' : ''}`}
        aria-label="Catalog menu"
        aria-hidden={menuOpen ? undefined : true}
      >
        <div className="global-header-drawer__head">
          <h2 className="global-header-drawer__title">Menu</h2>
          <button
            type="button"
            className="global-header-drawer__close"
            aria-label="Close menu"
            onClick={closeMenu}
          >
            ×
          </button>
        </div>

        <div className="global-header-drawer__body">
          {SITE_NAV_DRAWER.map((item, index) => (
            <DrawerNavEntry key={`drawer-${index}`} item={item} pathname={pathname} onNavigate={closeMenu} />
          ))}

          <div className="global-header-drawer__theme">
            <span className="global-header-drawer__theme-label">Theme</span>
            <ThemeToggle />
          </div>
        </div>
      </nav>
    </header>
  )
})
