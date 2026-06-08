import type { ReactNode } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { canonicalPathForRoute } from './seoPaths'
import { GlobalFooter } from './GlobalFooter'
import { GlobalHeader } from './GlobalHeader'
import { useSyncCatalogHeaderHeight } from './useSyncCatalogHeaderHeight'
import { useRef } from 'react'

const ABOUT_TABS = [
  { to: canonicalPathForRoute('/about'), label: 'About', end: true },
  { to: canonicalPathForRoute('/sutras'), label: 'Sutras', end: false },
  { to: canonicalPathForRoute('/muses'), label: 'Muses', end: false },
  { to: canonicalPathForRoute('/quotes'), label: 'Quotes', end: false },
] as const

function activeAboutLabel(pathname: string): string {
  const tab = ABOUT_TABS.find((item) => (item.end ? pathname === item.to : pathname.startsWith(item.to)))
  return tab?.label ?? 'About'
}

export function AboutTabLayout({ children }: { children: ReactNode }) {
  const pageRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLElement>(null)
  const location = useLocation()
  const currentLabel = activeAboutLabel(location.pathname)

  useSyncCatalogHeaderHeight(pageRef, headerRef, [location.pathname])

  return (
    <div ref={pageRef} className="catalog catalog-page catalog-page--shell">
      <GlobalHeader ref={headerRef} />
      <div className="catalog-page__main">
        <main className="about-page catalog-layout-shell" id="main-content">
          <nav className="catalog-breadcrumbs" aria-label="Breadcrumb">
            <Link className="catalog-breadcrumbs__link" to="/">
              Home
            </Link>
            <span className="catalog-breadcrumbs__sep" aria-hidden>
              /
            </span>
            {currentLabel === 'About' ? (
              <span className="catalog-breadcrumbs__current" aria-current="page">
                About
              </span>
            ) : (
              <>
                <Link className="catalog-breadcrumbs__link" to={canonicalPathForRoute('/about')}>
                  About
                </Link>
                <span className="catalog-breadcrumbs__sep" aria-hidden>
                  /
                </span>
                <span className="catalog-breadcrumbs__current" aria-current="page">
                  {currentLabel}
                </span>
              </>
            )}
          </nav>

          <header className="catalog-page-intro">
            <h1 className="catalog-page-h1">Ideas you can feel.</h1>
            <p className="catalog-page-sub">
              Songs for a world gone bananas. This is us in sonderland.
            </p>
          </header>

          <nav className="about-tab-row" aria-label="About sections">
            {ABOUT_TABS.map((tab) => (
              <NavLink
                key={tab.to}
                to={tab.to}
                end={tab.end}
                className={({ isActive }) =>
                  `about-tab-row__item${isActive ? ' about-tab-row__item--active' : ''}`
                }
              >
                {tab.label}
              </NavLink>
            ))}
          </nav>

          {children}
        </main>
      </div>
      <GlobalFooter />
    </div>
  )
}
