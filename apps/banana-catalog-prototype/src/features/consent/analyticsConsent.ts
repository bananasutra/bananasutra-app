export const ANALYTICS_CONSENT_KEY = 'bs-consent'

export type AnalyticsConsentValue = 'granted' | 'denied'

export function readAnalyticsConsent(): AnalyticsConsentValue | null {
  try {
    const value = localStorage.getItem(ANALYTICS_CONSENT_KEY)
    if (value === 'granted' || value === 'denied') return value
  } catch {
    // localStorage unavailable
  }
  return null
}

export function writeAnalyticsConsent(value: AnalyticsConsentValue): void {
  try {
    localStorage.setItem(ANALYTICS_CONSENT_KEY, value)
  } catch {
    // ignore
  }
  window.gtag?.('consent', 'update', { analytics_storage: value })
}

/** Effective consent: explicit choice, or granted when unset (portfolio default). */
export function effectiveAnalyticsConsent(): AnalyticsConsentValue {
  return readAnalyticsConsent() ?? 'granted'
}
