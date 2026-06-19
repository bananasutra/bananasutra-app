type ThemeId = 'light' | 'dark'

/** `visual` = full-bleed artwork; `list` = playlist rows; `compact` = artwork + waveform; `waveform` = scrub bar only. */
export type SoundCloudPlayerMode = 'visual' | 'list' | 'compact' | 'waveform'

/** SC compact chrome needs ~480px+ for readable track titles (persistent player / mini-bar). */
export const PERSISTENT_SC_PLAYER_MIN_WIDTH_PX = 480
/** SC compact chrome: small cover + linked title + scrubbable waveform. */
export const PERSISTENT_SC_PLAYER_MODE: SoundCloudPlayerMode = 'compact'
export const PERSISTENT_SC_PLAYER_HEIGHT_PX = 112

function playerColor(theme: ThemeId): string {
  // Match `--color-link` (SoundCloud `color` query param).
  return theme === 'dark' ? '#a89f94' : '#524a40'
}

type PlayerParamFlags = {
  visual: boolean
  showArtwork: boolean
  hideRelated: boolean
  showTeaser: boolean
  showUser: boolean
  showPlaycount: boolean
}

function playerParamFlags(mode: SoundCloudPlayerMode): PlayerParamFlags {
  const visual = mode === 'visual'
  const compact = mode === 'compact'
  const waveform = mode === 'waveform'
  return {
    visual,
    showArtwork: visual || compact,
    hideRelated: visual || compact || waveform,
    showTeaser: visual ? false : compact || waveform ? false : true,
    showUser: compact || waveform ? false : true,
    showPlaycount: compact || waveform ? false : true,
  }
}

function playerQueryParams(mode: SoundCloudPlayerMode, autoPlay: boolean, theme: ThemeId): URLSearchParams {
  const flags = playerParamFlags(mode)
  return new URLSearchParams({
    color: playerColor(theme),
    auto_play: autoPlay ? 'true' : 'false',
    hide_related: flags.hideRelated ? 'true' : 'false',
    show_comments: 'false',
    show_user: flags.showUser ? 'true' : 'false',
    show_reposts: 'false',
    show_teaser: flags.showTeaser ? 'true' : 'false',
    show_artwork: flags.showArtwork ? 'true' : 'false',
    show_playcount: flags.showPlaycount ? 'true' : 'false',
    visual: flags.visual ? 'true' : 'false',
    dnt: '1',
  })
}

/** Shared SC widget params for iframe `src` and `widget.load()` — keeps persistent player appearance consistent. */
export function soundcloudWidgetLoadOptions(
  theme: ThemeId,
  autoPlay: boolean,
  mode: SoundCloudPlayerMode = PERSISTENT_SC_PLAYER_MODE,
): Record<string, boolean | string> {
  const flags = playerParamFlags(mode)
  return {
    auto_play: autoPlay,
    color: playerColor(theme),
    hide_related: flags.hideRelated,
    show_comments: false,
    show_user: flags.showUser,
    show_reposts: false,
    show_teaser: flags.showTeaser,
    show_artwork: flags.showArtwork,
    show_playcount: flags.showPlaycount,
    visual: flags.visual,
    dnt: true,
  }
}

export function soundcloudPlayerSrc(
  scUrl: string,
  mode: SoundCloudPlayerMode = 'visual',
  autoPlay = false,
  theme: ThemeId = 'light',
): string {
  const params = playerQueryParams(mode, autoPlay, theme)
  return `https://w.soundcloud.com/player/?url=${encodeURIComponent(scUrl)}&${params.toString()}`
}
