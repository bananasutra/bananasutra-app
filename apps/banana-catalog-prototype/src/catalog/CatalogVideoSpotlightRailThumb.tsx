import { coverImageUrl } from '../seo/imageUrl'

type Props = {
  thumbnailUrl?: string | null
  /** Single-line fallback (e.g. song page genre label). */
  caption?: string | null
  /** Two-line stack: sutra, then duration (watch LP rail). */
  sutra?: string | null
  duration?: string | null
  isActive: boolean
  onSelect: () => void
  ariaLabel: string
}

/** Compact 16:9 rail thumb — shared by song page and watch LP spotlight. */
export function CatalogVideoSpotlightRailThumb({
  thumbnailUrl,
  caption,
  sutra,
  duration,
  isActive,
  onSelect,
  ariaLabel,
}: Props) {
  const poster = thumbnailUrl ? coverImageUrl(thumbnailUrl, { width: 320 }) : null

  return (
    <button
      type="button"
      className={`catalog-video-spotlight__thumb-pick${isActive ? ' is-active' : ''}`}
      aria-pressed={isActive}
      aria-label={ariaLabel}
      onClick={onSelect}
    >
      {poster ? (
        <span className="catalog-video-spotlight__thumb-frame">
          <img src={poster} alt="" width={160} height={90} loading="lazy" decoding="async" />
        </span>
      ) : (
        <span className="catalog-video-spotlight__thumb-frame catalog-video-spotlight__thumb-frame--fallback" aria-hidden>
          ▶
        </span>
      )}
      {sutra || duration ? (
        <span className="catalog-video-spotlight__thumb-caption-stack">
          {sutra ? <span className="catalog-video-spotlight__thumb-caption-sutra">{sutra}</span> : null}
          {duration ? <span className="catalog-video-spotlight__thumb-caption-duration">{duration}</span> : null}
        </span>
      ) : caption ? (
        <span className="catalog-video-spotlight__thumb-caption">{caption}</span>
      ) : null}
    </button>
  )
}
