import { forwardRef, useEffect, useRef, useState, type ForwardedRef, type MutableRefObject } from 'react'
import { SoundCloudEmbed } from './SoundCloudEmbed'
import './LazySoundCloudEmbed.css'

type Props = {
  scUrl: string
  title: string
  /** Visual height passed through to SoundCloudEmbed. */
  height?: number
}

function assignForwardedRef<T>(ref: ForwardedRef<T>, node: T | null): void {
  if (typeof ref === 'function') {
    ref(node)
  } else if (ref) {
    ;(ref as MutableRefObject<T | null>).current = node
  }
}

/**
 * Defers loading the SoundCloud iframe until the block is near the viewport.
 * `ref` attaches to the outer wrapper (for `useExclusiveYoutubeSoundcloudPlayback` and similar).
 */
export const LazySoundCloudEmbed = forwardRef<HTMLDivElement, Props>(function LazySoundCloudEmbed(
  { scUrl, title, height = 280 },
  ref,
) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const [active, setActive] = useState(false)

  const setRootRef = (node: HTMLDivElement | null) => {
    rootRef.current = node
    assignForwardedRef(ref, node)
  }

  useEffect(() => {
    const el = rootRef.current
    if (!el || active) return
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setActive(true)
          obs.disconnect()
        }
      },
      { rootMargin: '160px 0px', threshold: 0.01 },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [active])

  return (
    <div ref={setRootRef} className="catalog-lazy-sc-embed">
      {active ? (
        <SoundCloudEmbed scUrl={scUrl} title={title} height={height} mode="visual" loading="lazy" />
      ) : (
        <div className="catalog-lazy-sc-embed__placeholder" aria-hidden>
          SoundCloud playlist (loads when in view)
        </div>
      )}
    </div>
  )
})
