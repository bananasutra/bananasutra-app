type PlayerMode = 'visual' | 'list'

type ThemeId = 'light' | 'dark'

function playerColor(theme: ThemeId): string {
  // Match `--color-link` (SoundCloud `color` query param).
  return theme === 'dark' ? '#a89f94' : '#524a40'
}

export function soundcloudPlayerSrc(
  scUrl: string,
  mode: PlayerMode = 'visual',
  autoPlay = false,
  theme: ThemeId = 'light',
): string {
  const visual = mode === 'visual'
  const params = new URLSearchParams({
    color: playerColor(theme),
    auto_play: autoPlay ? 'true' : 'false',
    // In list mode, avoid `hide_related=true`; it can drift to non-set queues for some playlist URLs.
    hide_related: visual ? 'true' : 'false',
    show_comments: 'false',
    show_user: 'true',
    show_reposts: 'false',
    show_teaser: visual ? 'false' : 'true',
    show_artwork: visual ? 'true' : 'false',
    visual: visual ? 'true' : 'false',
    dnt: '1',
  })
  return `https://w.soundcloud.com/player/?url=${encodeURIComponent(scUrl)}&${params.toString()}`
}
