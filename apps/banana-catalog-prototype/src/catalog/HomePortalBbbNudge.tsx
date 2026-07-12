import type { MouseEvent } from 'react'
import { trackBertrandOpen } from '../lib/analytics'

/** Bertrand entry — own section under Feeling lucky. */
export function HomePortalBbbNudge() {
  const handleOpen = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    trackBertrandOpen({ surface: 'home_discovery_nudge' })
    window.dispatchEvent(new CustomEvent('bbb:open', { detail: { reason: 'home_discovery_nudge' } }))
  }

  return (
    <aside className="home-bbb-nudge" aria-labelledby="home-bbb-nudge-heading">
      <p id="home-bbb-nudge-heading" className="home-bbb-nudge__headline">
        <span className="home-bbb-nudge__text">Not sure where to start?</span>{' '}
        <button type="button" className="catalog-bertrand-cta home-bbb-nudge__cta" onClick={handleOpen}>
          Ask Bertrand →
        </button>
      </p>
    </aside>
  )
}
