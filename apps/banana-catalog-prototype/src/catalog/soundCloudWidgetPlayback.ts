import type { SoundCloudWidget } from './soundcloudWidgetApi'

type ScGlobal = {
  Widget: ((iframe: HTMLIFrameElement) => SoundCloudWidget) & {
    Events: {
      FINISH: string
      PLAY: string
      PAUSE: string
    }
  }
}

/** Bind PLAY / PAUSE / optional FINISH on a SoundCloud widget iframe API handle. */
export function bindSoundCloudWidgetPlayback(
  widget: SoundCloudWidget,
  SC: ScGlobal,
  handlers: {
    onPlayingChange: (playing: boolean) => void
    onFinish?: () => void
  },
): void {
  const { onPlayingChange, onFinish } = handlers
  widget.unbind(SC.Widget.Events.PLAY)
  widget.unbind(SC.Widget.Events.PAUSE)
  widget.unbind(SC.Widget.Events.FINISH)
  widget.bind(SC.Widget.Events.PLAY, () => onPlayingChange(true))
  widget.bind(SC.Widget.Events.PAUSE, () => onPlayingChange(false))
  if (onFinish) {
    widget.bind(SC.Widget.Events.FINISH, onFinish)
  }
}
