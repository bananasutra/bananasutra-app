import { forwardRef, useState, type ForwardedRef, type MutableRefObject } from 'react'
import { SoundCloudEmbed, type SoundCloudEmbedProps } from './SoundCloudEmbed'
import './LazySoundCloudEmbed.css'

function assignForwardedRef<T>(ref: ForwardedRef<T>, node: T | null): void {
  if (typeof ref === 'function') {
    ref(node)
  } else if (ref) {
    ;(ref as MutableRefObject<T | null>).current = node
  }
}

type Props = SoundCloudEmbedProps

/**
 * Eager SoundCloud embed that does not capture page scroll until the user engages it.
 * Tall list-mode playlists otherwise absorb wheel/touch for ~1s while the pointer crosses the iframe.
 */
export const SoundCloudPassthroughEmbed = forwardRef<HTMLDivElement, Props>(function SoundCloudPassthroughEmbed(
  props,
  ref,
) {
  const [interactive, setInteractive] = useState(false)

  const setRootRef = (node: HTMLDivElement | null) => {
    assignForwardedRef(ref, node)
  }

  const engage = () => setInteractive(true)

  const rootClass = [
    'catalog-lazy-sc-embed',
    'catalog-sc-passthrough-embed',
    interactive ? 'catalog-lazy-sc-embed--interactive' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div
      ref={setRootRef}
      className={rootClass}
      onClick={engage}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') engage()
      }}
      role={interactive ? undefined : 'button'}
      tabIndex={interactive ? undefined : 0}
      aria-label={interactive ? undefined : 'Enable SoundCloud playlist controls'}
    >
      <SoundCloudEmbed {...props} />
    </div>
  )
})
