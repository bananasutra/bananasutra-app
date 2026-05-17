import { forwardRef, useCallback, useEffect, useLayoutEffect, useRef, type ReactNode } from 'react'
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

/** Toggle can-scroll-left / can-scroll-right on the nav wrapper based on list scroll position. */
function useScrollFade(navRef: React.RefObject<HTMLElement | null>) {
  const update = useCallback(() => {
    const nav = navRef.current
    if (!nav) return
    const list = nav.querySelector('.global-header-nav__list') as HTMLElement | null
    if (!list) return
    const { scrollLeft, scrollWidth, clientWidth } = list
    nav.classList.toggle('can-scroll-left', scrollLeft > 2)
    nav.classList.toggle('can-scroll-right', scrollLeft + clientWidth < scrollWidth - 2)
  }, [navRef])

  useEffect(() => {
    const nav = navRef.current
    const list = nav?.querySelector('.global-header-nav__list') as HTMLElement | null
    if (!list) return
    update()
    list.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => { list.removeEventListener('scroll', update); window.removeEventListener('resize', update) }
  }, [navRef, update])
}

function syncCatalogHeaderHeightToRoot(header: HTMLElement | null): void {
  if (!header) return
  document.documentElement.style.setProperty('--catalog-header-h', `${header.offsetHeight}px`)
}

export const GlobalHeader = forwardRef<HTMLElement, GlobalHeaderProps>(function GlobalHeader({ right }, ref) {
  const { pathname } = useLocation()
  const navRef = useRef<HTMLElement>(null)
  const headerElRef = useRef<HTMLElement | null>(null)
  useScrollFade(navRef)

  const setHeaderRef = (node: HTMLElement | null) => {
    headerElRef.current = node
    if (typeof ref === 'function') {
      ref(node)
    } else if (ref) {
      ref.current = node
    }
  }

  useLayoutEffect(() => {
    const header = headerElRef.current
    if (!header) return

    const sync = () => syncCatalogHeaderHeightToRoot(header)
    sync()
    requestAnimationFrame(sync)

    const ro = new ResizeObserver(sync)
    ro.observe(header)

    let cancelled = false
    void document.fonts?.ready.then(() => {
      if (!cancelled) sync()
    })

    return () => {
      cancelled = true
      ro.disconnect()
    }
  }, [pathname])

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

        <nav ref={navRef} className="global-header-nav" aria-label="Primary">
          <ul className="global-header-nav__list">
            <li>
              <Link
                to="/"
                className={navLinkClass(pathname === '/')}
                aria-current={pathname === '/' ? 'page' : undefined}
                aria-label="Home"
              >
                /
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
