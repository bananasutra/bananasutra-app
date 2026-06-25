import { useCallback, useEffect, useState, type ImgHTMLAttributes } from 'react'
import { coverImageFallbackUrl, coverImageUrl } from '../seo/imageUrl'

type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'srcSet' | 'onError'> & {
  source: string
  /** Request width for coverImageUrl (not the HTML width attribute). */
  requestWidth?: number
  srcSet?: string
}

/** Cover art with one-step fallback when YouTube maxresdefault (or CF transform) 404s. */
export function CoverImage({ source, requestWidth = 240, srcSet, alt = '', ...rest }: Props) {
  const trimmed = (source || '').trim()
  const primary = trimmed ? coverImageUrl(trimmed, { width: requestWidth }) : ''
  const [src, setSrc] = useState(primary)
  const [activeSrcSet, setActiveSrcSet] = useState(srcSet || '')

  useEffect(() => {
    setSrc(primary)
    setActiveSrcSet(srcSet || '')
  }, [primary, srcSet])

  const onError = useCallback(() => {
    if (!trimmed) return
    const fallback = coverImageFallbackUrl(trimmed, src)
    if (fallback && fallback !== src) {
      setSrc(fallback)
      setActiveSrcSet('')
    }
  }, [trimmed, src])

  if (!primary) return null

  return (
    <img
      src={src || primary}
      srcSet={activeSrcSet || undefined}
      alt={alt}
      onError={onError}
      {...rest}
    />
  )
}
