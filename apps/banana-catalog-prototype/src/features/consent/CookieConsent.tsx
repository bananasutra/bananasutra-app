import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { canonicalPathForRoute } from '../../catalog/seoPaths'
import './CookieConsent.css'

const CONSENT_KEY = 'bs-consent'
const SHOW_DELAY_MS = 1500

type ConsentValue = 'granted' | 'denied'

function readStoredConsent(): ConsentValue | null {
  try {
    const value = localStorage.getItem(CONSENT_KEY)
    if (value === 'granted' || value === 'denied') return value
  } catch {
    // localStorage unavailable
  }
  return null
}

function persistConsent(value: ConsentValue): void {
  try {
    localStorage.setItem(CONSENT_KEY, value)
  } catch {
    // ignore
  }
  window.gtag?.('consent', 'update', { analytics_storage: value })
}

export function CookieConsent() {
  const [visible, setVisible] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    if (readStoredConsent() !== null) return
    const showTimer = window.setTimeout(() => {
      setMounted(true)
      window.requestAnimationFrame(() => setVisible(true))
    }, SHOW_DELAY_MS)
    return () => window.clearTimeout(showTimer)
  }, [])

  const dismiss = (value: ConsentValue) => {
    persistConsent(value)
    setVisible(false)
    window.setTimeout(() => setMounted(false), 220)
  }

  if (!mounted) return null

  return (
    <div
      className={`cookie-consent${visible ? ' cookie-consent--visible' : ''}`}
      role="region"
      aria-label="Cookie consent"
    >
      <p className="cookie-consent__text">
        We use analytics to understand how you discover music. No ads. No data selling.{' '}
        <Link className="cookie-consent__link" to={canonicalPathForRoute('/privacy')}>
          Privacy policy
        </Link>
      </p>
      <div className="cookie-consent__actions">
        <button type="button" className="cookie-consent__btn" onClick={() => dismiss('denied')}>
          No thanks
        </button>
        <button type="button" className="cookie-consent__btn" onClick={() => dismiss('granted')}>
          OK
        </button>
      </div>
    </div>
  )
}
