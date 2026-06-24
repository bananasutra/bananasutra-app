export const DISCOVERY_SEARCH_OPEN_EVENT = 'discovery-search:open'

/** R64 #127: always-open header search field — desktop only (tablets use icon-expand). */
export const HEADER_DESKTOP_SEARCH_FIELD_MQ = '(min-width: 1024px)'

export function openDiscoverySearch(): void {
  window.dispatchEvent(new CustomEvent(DISCOVERY_SEARCH_OPEN_EVENT))
}
