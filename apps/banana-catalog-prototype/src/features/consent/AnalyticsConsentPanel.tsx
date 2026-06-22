import { useState } from 'react'
import {
  effectiveAnalyticsConsent,
  writeAnalyticsConsent,
  type AnalyticsConsentValue,
} from './analyticsConsent'
import './AnalyticsConsentPanel.css'

export function AnalyticsConsentPanel() {
  const [choice, setChoice] = useState<AnalyticsConsentValue>(() => effectiveAnalyticsConsent())

  const setPreference = (value: AnalyticsConsentValue) => {
    writeAnalyticsConsent(value)
    setChoice(value)
  }

  return (
    <section className="analytics-consent" aria-labelledby="privacy-analytics-heading">
      <h2 id="privacy-analytics-heading" className="analytics-consent__title">
        Analytics cookies
      </h2>
      <p className="analytics-consent__status" role="status">
        Current preference: {choice === 'granted' ? 'allowed' : 'declined'}
      </p>
      <p className="analytics-consent__note">
        No ads, no data selling, no personalization. Only used to see which songs and pages people find
        useful.
      </p>
      <div className="analytics-consent__actions">
        <button
          type="button"
          className={`analytics-consent__btn${choice === 'granted' ? ' is-active' : ''}`}
          aria-pressed={choice === 'granted'}
          onClick={() => setPreference('granted')}
        >
          Allow analytics
        </button>
        <button
          type="button"
          className={`analytics-consent__btn${choice === 'denied' ? ' is-active' : ''}`}
          aria-pressed={choice === 'denied'}
          onClick={() => setPreference('denied')}
        >
          Decline analytics
        </button>
      </div>
    </section>
  )
}
