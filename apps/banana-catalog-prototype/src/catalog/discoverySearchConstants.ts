export const DISCOVERY_SEARCH_OPEN_EVENT = 'discovery-search:open'

export function openDiscoverySearch(): void {
  window.dispatchEvent(new CustomEvent(DISCOVERY_SEARCH_OPEN_EVENT))
}
