import { useCallback, useEffect, useRef, useState } from 'react'
import './ScrollRail.css'

interface ScrollRailProps {
  children: React.ReactNode
  /** Extra class applied to the outer wrapper (for size/spacing overrides). */
  className?: string
  /** How many pixels to scroll per button press. Defaults to 320. */
  scrollStep?: number
}

/**
 * Wraps a horizontal-overflow container with prev/next arrow buttons.
 * Buttons appear only when there is content to scroll toward.
 * Touch / trackpad swipe still work naturally on the inner strip.
 */
export function ScrollRail({ children, className, scrollStep = 320 }: ScrollRailProps) {
  const innerRef = useRef<HTMLDivElement>(null)
  const [canLeft, setCanLeft] = useState(false)
  const [canRight, setCanRight] = useState(false)

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

  return (
    <div className={`scroll-rail${className ? ` ${className}` : ''}`}>
      {/* disabled removes from tab order and AT automatically; CSS handles visual hiding. */}
      <button
        className="scroll-rail__btn scroll-rail__btn--left"
        onClick={() => scroll('left')}
        aria-label="Scroll left"
        disabled={!canLeft}
      >
        ‹
      </button>

      <div ref={innerRef} className="scroll-rail__inner">
        {children}
      </div>

      <button
        className="scroll-rail__btn scroll-rail__btn--right"
        onClick={() => scroll('right')}
        aria-label="Scroll right"
        disabled={!canRight}
      >
        ›
      </button>
    </div>
  )
}
