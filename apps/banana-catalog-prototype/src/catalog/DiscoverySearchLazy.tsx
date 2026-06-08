import { lazy, Suspense, useState } from 'react'
import type { DiscoverySearchProps } from './DiscoverySearch'

const DiscoverySearchRoot = lazy(() =>
  import('./DiscoverySearch').then((m) => ({ default: m.DiscoverySearch })),
)

/** Header variant mounts on interaction to keep initial header height stable. */
export function DiscoverySearchLazy(props: DiscoverySearchProps) {
  const shouldDefer = props.variant === 'header'
  const [mountSearch, setMountSearch] = useState(!shouldDefer)
  const [openOnMount, setOpenOnMount] = useState(false)

  const mountFromIcon = () => {
    setOpenOnMount(true)
    setMountSearch(true)
  }

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
