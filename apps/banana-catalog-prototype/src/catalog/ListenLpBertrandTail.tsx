import type { MouseEvent } from 'react'
import { trackBertrandOpen, type AnalyticsMode } from '../lib/analytics'

const LISTEN_MODE: AnalyticsMode = 'listen'

type Props = {
  onOpenChat?: () => void
}

/** W-052 stub — full Bertrand wiring + telemetry in W-018b. */
export function ListenLpBertrandTail({ onOpenChat }: Props) {
  const handleOpen = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault()
    trackBertrandOpen({ surface: 'listen_lp_tail', mode: LISTEN_MODE })
    window.dispatchEvent(new CustomEvent('bbb:open', { detail: { reason: 'listen_lp_tail' } }))
    onOpenChat?.()
  }

  return (
    <footer className="listen-lp__page-tail" aria-label="Chat entry">
      <aside className="listen-lp__bertrand-tail" aria-labelledby="listen-lp-bertrand-heading">
        <p id="listen-lp-bertrand-heading" className="listen-lp__bertrand-headline">
          Or, tell Bertrand how you&apos;re feeling. He understands…{' '}
          <a className="catalog-bertrand-cta listen-lp__bertrand-cta" href="#bertrand" onClick={handleOpen}>
            Ask Bertrand →
          </a>
        </p>
      </aside>
    </footer>
  )
}
