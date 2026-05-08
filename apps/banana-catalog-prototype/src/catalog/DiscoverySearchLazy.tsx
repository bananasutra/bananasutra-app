import { lazy, Suspense, useEffect, useState } from 'react'
import type { DiscoverySearchProps } from './DiscoverySearch'

const DiscoverySearchRoot = lazy(() =>
  import('./DiscoverySearch').then((m) => ({ default: m.DiscoverySearch })),
)

/** Defers loading discovery JSON + search bundle until after first paint (mobile perf). */
export function DiscoverySearchLazy(props: DiscoverySearchProps) {
  const shouldDefer = props.variant === 'header'
  const [mountSearch, setMountSearch] = useState(!shouldDefer)

  useEffect(() => {
    if (!shouldDefer || mountSearch) return
    const schedule =
      'requestIdleCallback' in window
        ? (cb: IdleRequestCallback) => window.requestIdleCallback(cb, { timeout: 2200 })
        : (cb: () => void) => window.setTimeout(cb, 500)
    const handle = schedule(() => setMountSearch(true))
    return () => {
      if ('cancelIdleCallback' in window && typeof handle === 'number') window.cancelIdleCallback(handle)
      else window.clearTimeout(handle as number)
    }
  }, [shouldDefer, mountSearch])

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
