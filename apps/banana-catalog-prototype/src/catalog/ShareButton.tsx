import { useCallback, useState } from 'react'
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
   * 'chip'  — icon + "share" label (default, used in persistent player + page heroes)
   * 'icon'  — icon only with aria-label (used in track rows where space is tight)
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

export function ShareButton({ url, title, text, className = '', variant = 'chip' }: ShareButtonProps) {
  const [copied, setCopied] = useState(false)

  const handleShare = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation()

      if (navigator.share) {
        try {
          await navigator.share({ url, title, text })
          return
        } catch {
          // User cancelled or API unavailable — fall through to clipboard
        }
      }

      try {
        await navigator.clipboard.writeText(url)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      } catch {
        // Clipboard blocked — silent fail
      }
    },
    [url, title, text],
  )

  const isIcon = variant === 'icon'
  const label = copied ? 'copied!' : 'share'
  const ariaLabel = copied ? 'Link copied' : `Share: ${title ?? url}`

  return (
    <button
      type="button"
      className={`share-btn share-btn--${variant}${copied ? ' share-btn--copied' : ''} ${className}`.trim()}
      onClick={handleShare}
      aria-label={isIcon ? ariaLabel : undefined}
      title={isIcon ? ariaLabel : undefined}
    >
      {SHARE_ICON}
      {!isIcon && <span className="share-btn__label">{label}</span>}
    </button>
  )
}
