import type { MouseEvent } from 'react'
import { trackBertrandOpen, type AnalyticsMode } from '../lib/analytics'

const LEARN_MODE: AnalyticsMode = 'read'

type Props = {
  onOpenChat?: () => void
}

/** Compact chat entry — Mood Entry is primary Bertrand on-ramp (D-033). */
export function LearnLpBertrandTail({ onOpenChat }: Props) {
  const handleOpen = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault()
    trackBertrandOpen({ surface: 'learn_lp_tail', mode: LEARN_MODE })
    window.dispatchEvent(new CustomEvent('bbb:open', { detail: { reason: 'learn_lp_tail' } }))
    onOpenChat?.()
  }

  return (
    <footer className="learn-lp__page-tail" aria-label="Chat entry">
      <aside className="learn-lp__bertrand-tail" aria-labelledby="learn-lp-bertrand-heading">
        <p id="learn-lp-bertrand-heading" className="learn-lp__bertrand-headline">
          Still not sure where to start? He knows the whole story.{' '}
          <a className="catalog-bertrand-cta learn-lp__bertrand-cta" href="#bertrand" onClick={handleOpen}>
            Ask Bertrand →
          </a>
        </p>
      </aside>
    </footer>
  )
}
