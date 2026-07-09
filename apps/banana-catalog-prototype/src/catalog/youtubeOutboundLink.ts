/** Shared outbound labels under embeds (YouTube watch page, SoundCloud track page, etc.). */
export const YOUTUBE_OUTBOUND_LINK_LABEL = 'Open on YouTube ↗'

export const SOUNDCLOUD_OUTBOUND_LINK_LABEL = 'Open on SoundCloud ↗'

export function outboundLinkLabelForHref(href: string): string {
  const lower = href.trim().toLowerCase()
  if (lower.includes('soundcloud.com')) return SOUNDCLOUD_OUTBOUND_LINK_LABEL
  return YOUTUBE_OUTBOUND_LINK_LABEL
}
