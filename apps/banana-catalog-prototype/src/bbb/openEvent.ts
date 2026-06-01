export type BbbOpenEventPayload = {
  reason?: string
  badPath?: string
}

export const registerBbbOpenListener = (onOpen: (detail?: BbbOpenEventPayload) => void): (() => void) => {
  const handler = (event: Event) => {
    const detail = typeof event === 'object' && event !== null && 'detail' in event ? (event as { detail?: unknown }).detail : undefined
    onOpen(detail as BbbOpenEventPayload | undefined)
  }
  window.addEventListener('bbb:open', handler)
  return () => {
    window.removeEventListener('bbb:open', handler)
  }
}
