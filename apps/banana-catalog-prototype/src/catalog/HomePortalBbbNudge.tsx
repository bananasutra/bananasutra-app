import type { MouseEvent } from 'react'
import { trackBertrandOpen } from '../lib/analytics'
import { ScrollRevealSection } from './ScrollRevealSection'

/** W-064 discovery nudge — text CTA between playful browse and structured sections. */
export function HomePortalBbbNudge() {
  const handleOpen = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    trackBertrandOpen({ surface: 'home_discovery_nudge' })
    window.dispatchEvent(new CustomEvent('bbb:open', { detail: { reason: 'home_discovery_nudge' } }))
  }

  return (
    <ScrollRevealSection as="aside" className="home-bbb-nudge home-portal__bbb" aria-labelledby="home-bbb-heading">
      <p id="home-bbb-heading" className="home-bbb-nudge__text">
        Not sure where to start?
      </p>
      <button type="button" className="home-bbb-nudge__cta" onClick={handleOpen}>
        Ask Bertrand (he knows)
      </button>
    </ScrollRevealSection>
  )
}
