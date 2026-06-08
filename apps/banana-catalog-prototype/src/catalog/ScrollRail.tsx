import { useCallback, useEffect, useRef, useState } from 'react'
import './ScrollRail.css'

interface ScrollRailProps {
  children: React.ReactNode
  /** Extra class applied to the outer wrapper (for size/spacing overrides). */
  className?: string
  /** How many pixels to scroll per button press. Defaults to 320. */
  scrollStep?: number
  /** `buttons` (default): side arrows. `fade`: horizontal scroll with edge fade mask (LP rails). */
  variant?: 'buttons' | 'fade'
}

/**
 * Wraps a horizontal-overflow container with prev/next arrow buttons.
 * Buttons appear only when there is content to scroll toward.
 * Touch / trackpad swipe still work naturally on the inner strip.
 */
export function ScrollRail({ children, className, scrollStep = 320, variant = 'buttons' }: ScrollRailProps) {
  const innerRef = useRef<HTMLDivElement>(null)
  const [canLeft, setCanLeft] = useState(false)
  const [canRight, setCanRight] = useState(false)
  const useFade = variant === 'fade'

  const sync = useCallback(() => {
    const el = innerRef.current
    if (!el) return
    setCanLeft(el.scrollLeft > 4)
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4)
  }, [])

  useEffect(() => {
    const el = innerRef.current
    if (!el) return
    sync()
    el.addEventListener('scroll', sync, { passive: true })
    const ro = new ResizeObserver(sync)
    ro.observe(el)
    return () => {
      el.removeEventListener('scroll', sync)
      ro.disconnect()
    }
  }, [sync])

  const scroll = (dir: 'left' | 'right') => {
    innerRef.current?.scrollBy({
      left: dir === 'left' ? -scrollStep : scrollStep,
      behavior: 'smooth',
    })
  }

  const fadeClass =
    useFade && (canLeft || canRight)
      ? ` scroll-rail--fade${canLeft ? ' scroll-rail--fade-left' : ''}${canRight ? ' scroll-rail--fade-right' : ''}`
      : useFade
        ? ' scroll-rail--fade'
        : ''

  return (
    <div className={`scroll-rail${useFade ? ' scroll-rail--fade-mode' : ''}${fadeClass}${className ? ` ${className}` : ''}`}>
      {!useFade ? (
        <button
          className="scroll-rail__btn scroll-rail__btn--left"
          onClick={() => scroll('left')}
          aria-label="Scroll left"
          disabled={!canLeft}
        >
          ‹
        </button>
      ) : null}

      <div ref={innerRef} className={`scroll-rail__inner${useFade ? ' scroll-rail__inner--fade' : ''}`}>
        {children}
      </div>

      {!useFade ? (
        <button
          className="scroll-rail__btn scroll-rail__btn--right"
          onClick={() => scroll('right')}
          aria-label="Scroll right"
          disabled={!canRight}
        >
          ›
        </button>
      ) : null}
    </div>
  )
}
