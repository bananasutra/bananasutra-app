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

const ABOUT_TAB_H1: Record<(typeof ABOUT_TABS)[number]['label'], string> = {
  About: 'Ideas you can feel.',
  Sutras: 'The seven sutras',
  Muses: 'The muses',
  Quotes: 'The quotes',
}

function normalizeAboutPath(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith('/')) return pathname.slice(0, -1)
  return pathname
}

function activeAboutLabel(pathname: string): string {
  const path = normalizeAboutPath(pathname)
  const tab = ABOUT_TABS.find((item) => {
    const to = normalizeAboutPath(item.to)
    return item.end ? path === to : path === to || path.startsWith(`${to}/`)
  })
  return tab?.label ?? 'About'
}

export function AboutTabLayout({ children }: { children: ReactNode }) {
  const pageRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLElement>(null)
  const location = useLocation()
  const currentLabel = activeAboutLabel(location.pathname)
  const pageH1 = ABOUT_TAB_H1[currentLabel as keyof typeof ABOUT_TAB_H1] ?? ABOUT_TAB_H1.About

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
            <h1 className="catalog-page-h1">{pageH1}</h1>
            <p className="catalog-page-sub">
              {currentLabel === 'About'
                ? 'Songs for a world gone bananas. This is us in sonderland.'
                : 'Ideas you can feel. Songs for a world gone bananas.'}
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
