import { forwardRef, useEffect, useRef, useState, type ForwardedRef, type MutableRefObject } from 'react'
import { SoundCloudEmbed, type SoundCloudEmbedProps } from './SoundCloudEmbed'
import './LazySoundCloudEmbed.css'

type Props = Pick<
  SoundCloudEmbedProps,
  'scUrl' | 'title' | 'height' | 'mode' | 'autoPlay' | 'reloadKey' | 'onLoad' | 'loading'
>

function assignForwardedRef<T>(ref: ForwardedRef<T>, node: T | null): void {
  if (typeof ref === 'function') {
    ref(node)
  } else if (ref) {
    ;(ref as MutableRefObject<T | null>).current = node
  }
}

const IDLE_CALLBACK_TIMEOUT_MS = 2500
const SET_TIMEOUT_FALLBACK_MS = 1500
const VIEWPORT_ROOT_MARGIN_PX = 160
function isNearViewport(el: HTMLElement): boolean {
  const rect = el.getBoundingClientRect()
  return rect.top < window.innerHeight + VIEWPORT_ROOT_MARGIN_PX && rect.bottom > -VIEWPORT_ROOT_MARGIN_PX
}

/**
 * Defers loading the SoundCloud iframe until the block is near the viewport or the
 * main thread is idle (whichever comes first). Above-the-fold blocks mount immediately.
 * `ref` attaches to the outer wrapper.
 */
export const LazySoundCloudEmbed = forwardRef<HTMLDivElement, Props>(function LazySoundCloudEmbed(
  {
    scUrl,
    title,
    height = 280,
    mode = 'visual',
    autoPlay = false,
    reloadKey = 0,
    onLoad,
    loading = 'lazy',
  },
  ref,
) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const [active, setActive] = useState(false)
  const [interactive, setInteractive] = useState(false)

  const setRootRef = (node: HTMLDivElement | null) => {
    rootRef.current = node
    assignForwardedRef(ref, node)
  }

  useEffect(() => {
    const el = rootRef.current
    if (!el || active) return

    let cancelled = false
    let settled = false

    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) settle()
      },
      { rootMargin: `${VIEWPORT_ROOT_MARGIN_PX}px 0px`, threshold: 0.01 },
    )

    let idleHandle: number | undefined
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined

    const teardown = () => {
      obs.disconnect()
      if (idleHandle !== undefined && 'cancelIdleCallback' in window) {
        window.cancelIdleCallback(idleHandle)
      }
      if (timeoutHandle !== undefined) {
        clearTimeout(timeoutHandle)
      }
    }

    const settle = () => {
      if (cancelled || settled) return
      settled = true
      teardown()
      setActive(true)
    }

    if (isNearViewport(el)) {
      settle()
      return
    }

    obs.observe(el)

    if ('requestIdleCallback' in window) {
      idleHandle = window.requestIdleCallback(() => settle(), { timeout: IDLE_CALLBACK_TIMEOUT_MS })
    }
    timeoutHandle = window.setTimeout(() => settle(), SET_TIMEOUT_FALLBACK_MS)

    return () => {
      cancelled = true
      teardown()
    }
  }, [active])

  const rootClass = [
    'catalog-lazy-sc-embed',
    interactive ? 'catalog-lazy-sc-embed--interactive' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div
      ref={setRootRef}
      className={rootClass}
      style={{ minHeight: height }}
      onClick={() => setInteractive(true)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') setInteractive(true)
      }}
      role={active && !interactive ? 'button' : undefined}
      tabIndex={active && !interactive ? 0 : undefined}
      aria-label={active && !interactive ? 'Enable SoundCloud player interaction' : undefined}
    >
      {active ? (
        <SoundCloudEmbed
          scUrl={scUrl}
          title={title}
          height={height}
          mode={mode}
          autoPlay={autoPlay}
          reloadKey={reloadKey}
          onLoad={onLoad}
          loading={loading}
        />
      ) : (
        <div
          className="catalog-lazy-sc-embed__placeholder"
          style={{ minHeight: height }}
          aria-hidden
        >
          SoundCloud playlist (loads when in view)
        </div>
      )}
    </div>
  )
})
