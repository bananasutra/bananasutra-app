import { lazy, Suspense, useEffect, useState } from 'react'
import type { DiscoverySearchProps } from './DiscoverySearch'
import { DISCOVERY_SEARCH_OPEN_EVENT } from './discoverySearchConstants'

const DiscoverySearchRoot = lazy(() =>
  import('./DiscoverySearch').then((m) => ({ default: m.DiscoverySearch })),
)

function headerSearchIsDesktop(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches
}

/** Header variant mounts on interaction to keep initial header height stable (mobile/tablet). */
export function DiscoverySearchLazy(props: DiscoverySearchProps) {
  const isHeader = props.variant === 'header'
  const [isDesktopHeader, setIsDesktopHeader] = useState(() => isHeader && headerSearchIsDesktop())
  const shouldDefer = isHeader && !isDesktopHeader
  const [mountSearch, setMountSearch] = useState(!shouldDefer)
  const [openOnMount, setOpenOnMount] = useState(false)

  useEffect(() => {
    if (!isHeader) return
    const mq = window.matchMedia('(min-width: 768px)')
    const onMq = () => {
      const desktop = mq.matches
      setIsDesktopHeader(desktop)
      if (desktop) setMountSearch(true)
    }
    onMq()
    mq.addEventListener('change', onMq)
    return () => mq.removeEventListener('change', onMq)
  }, [isHeader])

  const mountFromIcon = () => {
    setOpenOnMount(true)
    setMountSearch(true)
  }

  useEffect(() => {
    if (!shouldDefer) return
    const onOpen = () => {
      mountFromIcon()
      document.querySelector('.global-header__search-slot')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
    window.addEventListener(DISCOVERY_SEARCH_OPEN_EVENT, onOpen)
    return () => window.removeEventListener(DISCOVERY_SEARCH_OPEN_EVENT, onOpen)
  }, [shouldDefer])

  if (!mountSearch) {
    return (
      <button
        type="button"
        className="global-header-discovery-fallback global-header-discovery-fallback--button"
        aria-label="Open catalog search"
        onMouseEnter={() => setMountSearch(true)}
        onFocus={() => setMountSearch(true)}
        onClick={mountFromIcon}
      >
        <span className="global-header-discovery-fallback__icon" aria-hidden>
          ⌕
        </span>
        <span className="global-header-discovery-fallback__placeholder">Search and discover...</span>
      </button>
    )
  }

  return (
    <Suspense
      fallback={
        <div
          className="global-header-discovery-fallback"
          role="status"
          aria-label="Loading search"
        >
          <span className="global-header-discovery-fallback__icon" aria-hidden>
            ⌕
          </span>
          <span className="global-header-discovery-fallback__placeholder">Search and discover...</span>
        </div>
      }
    >
      <DiscoverySearchRoot {...props} openOnMount={openOnMount} />
    </Suspense>
  )
}
