import { YOUTUBE_OUTBOUND_LINK_LABEL } from './youtubeOutboundLink'

type Props = {
  href: string
  label?: string
}

/** Right-aligned small-caps outbound link under embeds (YouTube, SoundCloud, etc.). */
export function CatalogMediaOutbound({ href, label = YOUTUBE_OUTBOUND_LINK_LABEL }: Props) {
  return (
    <p className="catalog-media-outbound">
      <a className="catalog-media-outbound__link" href={href} target="_blank" rel="noopener noreferrer">
        {label}
      </a>
    </p>
  )
}
