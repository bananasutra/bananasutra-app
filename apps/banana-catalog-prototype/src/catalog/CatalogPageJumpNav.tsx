import { useCallback, useEffect, useRef } from 'react'
import './CatalogPageJumpNav.css'

export type CatalogJumpNavItem = { id: string; label: string; mobileLabel?: string }

type Props = {
  ariaLabel?: string
  items: CatalogJumpNavItem[]
  className?: string
}

function useJumpNavScrollFade(navRef: React.RefObject<HTMLElement | null>) {
  const update = useCallback(() => {
    const nav = navRef.current
    if (!nav) return
    const list = nav.querySelector('.catalog-page-jump-nav__list') as HTMLElement | null
    if (!list) return
    const { scrollLeft, scrollWidth, clientWidth } = list
    nav.classList.toggle('can-scroll-left', scrollLeft > 2)
    nav.classList.toggle('can-scroll-right', scrollLeft + clientWidth < scrollWidth - 2)
  }, [navRef])

  useEffect(() => {
    const nav = navRef.current
    const list = nav?.querySelector('.catalog-page-jump-nav__list') as HTMLElement | null
    if (!list) return
    update()
    list.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => { list.removeEventListener('scroll', update); window.removeEventListener('resize', update) }
  }, [navRef, update])
}

/**
 * In-page jump links to section headings (see wireframes/about.html `.jump` pattern).
 */
export function CatalogPageJumpNav({ ariaLabel = 'On this page', items, className }: Props) {
  const navRef = useRef<HTMLElement>(null)
  useJumpNavScrollFade(navRef)

  if (items.length === 0) return null
  return (
    <nav ref={navRef} className={`catalog-page-jump-nav${className ? ` ${className}` : ''}`} aria-label={ariaLabel}>
      <ul className="catalog-page-jump-nav__list">
        {items.map((item) => (
          <li key={item.id} className="catalog-page-jump-nav__item">
            <a href={`#${item.id}`} className="catalog-page-jump-nav__link">
              <span className="catalog-page-jump-nav__arrow" aria-hidden="true">↓ </span>
              {item.mobileLabel ? (
                <>
                  <span className="catalog-page-jump-nav__label--full">{item.label}</span>
                  <span className="catalog-page-jump-nav__label--short">{item.mobileLabel}</span>
                </>
              ) : (
                item.label
              )}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
