import { useCallback, useEffect, useRef, useState, type ImgHTMLAttributes } from 'react'
import { coverImageFallbackUrl, coverImageUrl } from '../seo/imageUrl'
import { ThumbShimmer } from './ThumbShimmer'
import './coverImage.css'

type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'srcSet' | 'onError' | 'onLoad'> & {
  source: string
  /** Request width for coverImageUrl (not the HTML width attribute). */
  requestWidth?: number
  srcSet?: string
  /** Shimmer until cover loads; persists across maxres → fallback swap. */
  showShimmer?: boolean
}

/** Cover art with one-step fallback when YouTube maxresdefault (or CF transform) 404s. */
export function CoverImage({
  source,
  requestWidth = 240,
  srcSet,
  alt = '',
  showShimmer = false,
  className,
  ...rest
}: Props) {
  const trimmed = (source || '').trim()
  const primary = trimmed ? coverImageUrl(trimmed, { width: requestWidth }) : ''
  const [src, setSrc] = useState(primary)
  const [activeSrcSet, setActiveSrcSet] = useState(srcSet || '')
  const [imageReady, setImageReady] = useState(false)
  const [terminalFailure, setTerminalFailure] = useState(false)
  const imgRef = useRef<HTMLImageElement>(null)

  useEffect(() => {
    setSrc(primary)
    setActiveSrcSet(srcSet || '')
  }, [primary, srcSet])

  useEffect(() => {
    setImageReady(false)
    setTerminalFailure(false)
    const img = imgRef.current
    if (img?.complete && img.naturalWidth > 0) {
      setImageReady(true)
    }
  }, [src, primary])

  const handleLoad = useCallback(() => {
    setImageReady(true)
  }, [])

  const handleError = useCallback(() => {
    if (!trimmed) return
    const fallback = coverImageFallbackUrl(trimmed, src)
    if (fallback && fallback !== src) {
      setSrc(fallback)
      setActiveSrcSet('')
    } else {
      setTerminalFailure(true)
    }
  }, [trimmed, src])

  if (!primary) return null

  const imgClassName = showShimmer
    ? `cover-image__img ${imageReady ? 'is-loaded' : 'is-loading'}`
    : className

  const img = (
    <img
      ref={imgRef}
      src={src || primary}
      srcSet={activeSrcSet || undefined}
      alt={alt}
      onError={handleError}
      onLoad={handleLoad}
      className={imgClassName}
      {...rest}
    />
  )

  if (!showShimmer) {
    return img
  }

  const wrapClassName = ['cover-image', 'cover-image--fill', className].filter(Boolean).join(' ')

  if (terminalFailure) {
    return (
      <span className={wrapClassName}>
        <span className="cover-image__fallback" aria-hidden>
          <span className="cover-image__fallback-icon">♪</span>
        </span>
      </span>
    )
  }

  return (
    <span className={wrapClassName}>
      {!imageReady ? <ThumbShimmer className="cover-image__shimmer" /> : null}
      {img}
    </span>
  )
}
