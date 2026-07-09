import { outboundLinkLabelForHref } from './youtubeOutboundLink'

type Props = {
  href: string
  label?: string
}

/** Right-aligned small-caps outbound link under embeds (YouTube, SoundCloud, etc.). */
export function CatalogMediaOutbound({ href, label }: Props) {
  const resolvedLabel = label ?? outboundLinkLabelForHref(href)
  return (
    <p className="catalog-media-outbound">
      <a className="catalog-media-outbound__link" href={href} target="_blank" rel="noopener noreferrer">
        {resolvedLabel}
      </a>
    </p>
  )
}
