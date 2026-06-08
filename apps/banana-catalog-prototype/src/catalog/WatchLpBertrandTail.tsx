import type { MouseEvent } from 'react'
import { trackBertrandOpen, type AnalyticsMode } from '../lib/analytics'

const WATCH_MODE: AnalyticsMode = 'watch'

type Props = {
  onOpenChat?: () => void
}

/** Compact chat entry — W-054 stub; full Bertrand wiring in W-018b. */
export function WatchLpBertrandTail({ onOpenChat }: Props) {
  const handleOpen = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault()
    trackBertrandOpen({ surface: 'watch_lp_tail', mode: WATCH_MODE })
    window.dispatchEvent(new CustomEvent('bbb:open', { detail: { reason: 'watch_lp_tail' } }))
    onOpenChat?.()
  }

  return (
    <footer className="watch-lp__page-tail" aria-label="Chat entry">
      <aside className="watch-lp__bertrand-tail" aria-labelledby="watch-lp-bertrand-heading">
        <p id="watch-lp-bertrand-heading" className="watch-lp__bertrand-headline">
          Not finding it? Describe what you&apos;re after.{' '}
          <a className="watch-lp__bertrand-cta" href="#bertrand" onClick={handleOpen}>
            Open chat →
          </a>
        </p>
      </aside>
    </footer>
  )
}
