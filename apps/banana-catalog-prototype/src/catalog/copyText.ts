/** User dismissed the native share sheet — not an error. */
export function isShareAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError'
}

/**
 * Copy text in a user-gesture handler. Works on HTTP LAN dev hosts where
 * navigator.clipboard is blocked (non-secure context).
 */
export function copyTextToClipboard(text: string): boolean {
  const value = text.trim()
  if (!value) return false

  try {
    const textarea = document.createElement('textarea')
    textarea.value = value
    textarea.setAttribute('readonly', '')
    textarea.style.position = 'fixed'
    textarea.style.left = '-9999px'
    textarea.style.top = '0'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)

    textarea.focus({ preventScroll: true })
    textarea.select()
    textarea.setSelectionRange(0, value.length)

    const ok = document.execCommand('copy')
    document.body.removeChild(textarea)
    return ok
  } catch {
    return false
  }
}

export async function copyTextToClipboardAsync(text: string): Promise<boolean> {
  const value = text.trim()
  if (!value) return false

  if (navigator.clipboard?.writeText && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(value)
      return true
    } catch {
      // Fall through to execCommand (HTTP dev, permission denied, etc.)
    }
  }

  return copyTextToClipboard(value)
}
