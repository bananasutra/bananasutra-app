import { useLayoutEffect, useRef, useState } from 'react'

const SCROLL_REVEAL_OBSERVER: IntersectionObserverInit = {
  threshold: 0,
  rootMargin: '0px 0px 8% 0px',
}

function scrollRevealStartsVisible(immediate: boolean): boolean {
  if (immediate) return true
  if (typeof window === 'undefined') return true
  return !('IntersectionObserver' in window)
}

/** Content this far below the fold still shows on load so the page does not look cut off. */
function peekBelowFoldPx(): number {
  if (typeof window === 'undefined') return 96
  return Math.max(80, Math.min(180, Math.round(window.innerHeight * 0.14)))
}

/** True when any part is visible, or the block starts just below the fold (scroll hint). */
function isNearOrInViewport(el: HTMLElement): boolean {
  const rect = el.getBoundingClientRect()
  const vh = window.innerHeight
  if (rect.bottom <= 0) return true
  return rect.top < vh + peekBelowFoldPx()
}

/** Fade-up when a shell section enters the viewport. Honors prefers-reduced-motion via CSS. */
export function useScrollReveal(immediate = false) {
  const ref = useRef<HTMLElement>(null)
  const [visible, setVisible] = useState(() => scrollRevealStartsVisible(immediate))

  useLayoutEffect(() => {
    if (immediate) return
    const node = ref.current
    if (!node) return

    if (!('IntersectionObserver' in window)) {
      setVisible(true)
      return
    }

    if (isNearOrInViewport(node)) {
      setVisible(true)
      return
    }

    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          setVisible(true)
          observer.disconnect()
        }
      }
    }, SCROLL_REVEAL_OBSERVER)

    observer.observe(node)
    return () => observer.disconnect()
  }, [immediate])

  return { ref, visible }
}
