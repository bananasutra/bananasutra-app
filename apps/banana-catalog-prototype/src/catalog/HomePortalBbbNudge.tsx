import type { MouseEvent } from 'react'
import { trackBertrandOpen } from '../lib/analytics'

/** Bertrand inline nudge under feeling lucky. */
export function HomePortalBbbNudge() {
  const handleOpen = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    trackBertrandOpen({ surface: 'home_discovery_nudge' })
    window.dispatchEvent(new CustomEvent('bbb:open', { detail: { reason: 'home_discovery_nudge' } }))
  }

  return (
    <p className="home-bbb-nudge home-portal__bbb home-portal__bbb--lucky">
      <span className="home-bbb-nudge__text">Not sure where to start?</span>{' '}
      <button type="button" className="catalog-bertrand-cta home-bbb-nudge__cta" onClick={handleOpen}>
        Ask Bertrand →
      </button>
    </p>
  )
}
