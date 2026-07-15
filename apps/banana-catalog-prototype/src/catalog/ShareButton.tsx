import { useCallback, useState, type PointerEvent, type MouseEvent } from 'react'
import { copyTextToClipboardAsync, isShareAbortError } from './copyText'
import './ShareButton.css'

export type ShareButtonProps = {
  /** Full URL to share (use builders from shareUrl.ts). */
  url: string
  /** navigator.share title (shown in native share sheet). */
  title?: string
  /** navigator.share text body (shown in native share sheet). */
  text?: string
  /** Additional CSS classes. */
  className?: string
  /**
   * 'chip'  — icon + "share" label (default, used in persistent player)
   * 'icon'  — icon only with tooltip (heroes, track rows)
   */
  variant?: 'chip' | 'icon'
}

const SHARE_ICON = (
  <svg
    className="share-btn__icon"
    width="13"
    height="13"
    viewBox="0 0 13 13"
    fill="none"
    aria-hidden="true"
    focusable="false"
  >
    <path
      d="M6.5 1L6.5 8M6.5 1L4 3.5M6.5 1L9 3.5"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M2 6.5V10.5C2 11.05 2.45 11.5 3 11.5H10C10.55 11.5 11 11.05 11 10.5V6.5"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
)

function stopRowActivation(e: MouseEvent | PointerEvent): void {
  e.stopPropagation()
}

export function ShareButton({ url, title, text, className = '', variant = 'chip' }: ShareButtonProps) {
  const [copied, setCopied] = useState(false)

  const markCopied = useCallback(() => {
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }, [])

  const handleShare = useCallback(
    async (e: MouseEvent) => {
      stopRowActivation(e)

      const sharePayload = { url, title, text }
      if (typeof navigator.share === 'function') {
        const canShare = typeof navigator.canShare !== 'function' || navigator.canShare(sharePayload)
        if (canShare) {
          try {
            await navigator.share(sharePayload)
            return
          } catch (err) {
            if (isShareAbortError(err)) return
          }
        }
      }

      const didCopy = await copyTextToClipboardAsync(url)
      if (didCopy) {
        markCopied()
      }
    },
    [markCopied, text, title, url],
  )

  const isIcon = variant === 'icon'
  const label = copied ? 'copied!' : 'share'
  const ariaLabel = copied ? 'Link copied' : title ? `Share: ${title}` : 'Share'
  const tooltip = copied ? 'Link copied' : 'Share'

  return (
    <button
      type="button"
      className={`share-btn share-btn--${variant}${copied ? ' share-btn--copied' : ''} ${className}`.trim()}
      onClick={handleShare}
      onPointerDown={stopRowActivation}
      aria-label={isIcon ? ariaLabel : undefined}
      title={tooltip}
    >
      {SHARE_ICON}
      {!isIcon ? <span className="share-btn__label">{label}</span> : null}
      {isIcon && copied ? (
        <span className="share-btn__copied-hint" aria-hidden>
          ✓
        </span>
      ) : null}
    </button>
  )
}
