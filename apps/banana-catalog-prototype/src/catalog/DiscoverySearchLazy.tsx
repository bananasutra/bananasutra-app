import { lazy, Suspense, useState } from 'react'
import type { DiscoverySearchProps } from './DiscoverySearch'

const DiscoverySearchRoot = lazy(() =>
  import('./DiscoverySearch').then((m) => ({ default: m.DiscoverySearch })),
)

/** Header variant mounts on interaction to keep initial header height stable. */
export function DiscoverySearchLazy(props: DiscoverySearchProps) {
  const shouldDefer = props.variant === 'header'
  const [mountSearch, setMountSearch] = useState(!shouldDefer)

  if (!mountSearch) {
    return (
      <button
        type="button"
        className="global-header-discovery-fallback global-header-discovery-fallback--button"
        aria-label="Open catalog search"
        onMouseEnter={() => setMountSearch(true)}
        onFocus={() => setMountSearch(true)}
        onClick={() => setMountSearch(true)}
      />
    )
  }

  return (
    <Suspense
      fallback={
        <div
          className="global-header-discovery-fallback"
          role="status"
          aria-label="Loading search"
        />
      }
    >
      <DiscoverySearchRoot {...props} />
    </Suspense>
  )
}
