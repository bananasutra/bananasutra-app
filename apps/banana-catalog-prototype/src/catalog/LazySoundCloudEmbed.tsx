import { forwardRef, useEffect, useRef, useState, type ForwardedRef, type MutableRefObject } from 'react'
import { SoundCloudEmbed, type SoundCloudEmbedProps } from './SoundCloudEmbed'
import './LazySoundCloudEmbed.css'

type Props = Pick<
  SoundCloudEmbedProps,
  'scUrl' | 'title' | 'height' | 'mode' | 'autoPlay' | 'reloadKey' | 'onLoad' | 'loading'
> & {
  /**
   * `interaction_or_autoplay`: keep iframe out of initial paint until user intent
   * (tap/click) or explicit autoplay from a row action.
   * `immediate`: mount embed on first paint (home top-5 default track; no autoplay).
   */
  activation?: 'near_viewport_or_idle' | 'interaction_or_autoplay' | 'immediate'
}

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
    activation = 'near_viewport_or_idle',
  },
  ref,
) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const [active, setActive] = useState(() => activation === 'immediate')
  const [interactive, setInteractive] = useState(() => activation === 'immediate')

  const setRootRef = (node: HTMLDivElement | null) => {
    rootRef.current = node
    assignForwardedRef(ref, node)
  }

  useEffect(() => {
    if (activation !== 'near_viewport_or_idle') return
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
    const timeoutHandle = window.setTimeout(() => settle(), SET_TIMEOUT_FALLBACK_MS)

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
    return () => {
      cancelled = true
      teardown()
    }
  }, [activation, active])

  useEffect(() => {
    if (activation !== 'interaction_or_autoplay') return
    if (!autoPlay || active) return
    setActive(true)
    setInteractive(true)
  }, [activation, autoPlay, active, reloadKey])

  const handleUserActivate = () => {
    if (activation === 'interaction_or_autoplay' && !active) {
      setActive(true)
    }
    setInteractive(true)
  }

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
      onClick={handleUserActivate}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          handleUserActivate()
        }
      }}
      role={(!active && activation === 'interaction_or_autoplay') || (active && !interactive) ? 'button' : undefined}
      tabIndex={(!active && activation === 'interaction_or_autoplay') || (active && !interactive) ? 0 : undefined}
      aria-label={
        !active && activation === 'interaction_or_autoplay'
          ? 'Load SoundCloud player'
          : active && !interactive
            ? 'Enable SoundCloud player interaction'
            : undefined
      }
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
          <div className="catalog-lazy-sc-embed__skeleton">
            <div className="catalog-lazy-sc-embed__skeleton-art" />
            <div className="catalog-lazy-sc-embed__skeleton-lines">
              <div className="catalog-lazy-sc-embed__skeleton-line catalog-lazy-sc-embed__skeleton-line--title" />
              <div className="catalog-lazy-sc-embed__skeleton-line catalog-lazy-sc-embed__skeleton-line--meta" />
            </div>
          </div>
          {activation === 'interaction_or_autoplay' ? (
            <div className="catalog-lazy-sc-embed__tap-hint" aria-hidden>
              Tap to load player
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
})
