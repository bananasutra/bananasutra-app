export const FOOTER_CONTACT_PANEL_HASH = '#footer-contact-panel'
export const FOOTER_CONTACT_PANEL_ID = 'footer-contact-panel'
export const FOOTER_CONTACT_OPEN_EVENT = 'footer-contact:open'

export function isFooterContactHref(href: string): boolean {
  const trimmed = href.trim()
  if (trimmed === FOOTER_CONTACT_PANEL_HASH || trimmed === `/${FOOTER_CONTACT_PANEL_HASH}`) return true
  try {
    const url = new URL(trimmed, 'http://local')
    return url.hash === FOOTER_CONTACT_PANEL_HASH
  } catch {
    return false
  }
}

export function openFooterContactPanel(): void {
  if (window.location.hash !== FOOTER_CONTACT_PANEL_HASH) {
    window.location.hash = FOOTER_CONTACT_PANEL_HASH
  }
  window.dispatchEvent(new Event(FOOTER_CONTACT_OPEN_EVENT))
  requestAnimationFrame(() => {
    document.getElementById(FOOTER_CONTACT_PANEL_ID)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  })
}
