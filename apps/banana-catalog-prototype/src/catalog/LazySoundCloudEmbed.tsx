import { useEffect, useRef, useState } from 'react'
import { SoundCloudEmbed } from './SoundCloudEmbed'
import './LazySoundCloudEmbed.css'

type Props = {
  scUrl: string
  title: string
  /** Visual height passed through to SoundCloudEmbed. */
  height?: number
}

/**
 * Defers loading the SoundCloud iframe until the block is near the viewport.
 */
export function LazySoundCloudEmbed({ scUrl, title, height = 280 }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(false)

  useEffect(() => {
    const el = wrapRef.current
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
    <div ref={wrapRef} className="catalog-lazy-sc-embed">
      {active ? (
        <SoundCloudEmbed scUrl={scUrl} title={title} height={height} mode="visual" loading="lazy" />
      ) : (
        <div className="catalog-lazy-sc-embed__placeholder" aria-hidden>
          SoundCloud playlist (loads when in view)
        </div>
      )}
    </div>
  )
}
