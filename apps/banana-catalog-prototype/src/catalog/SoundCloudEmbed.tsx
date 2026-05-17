import { soundcloudPlayerSrc } from './soundcloudPlayerUrl'
import { useTheme } from './theme'

export type SoundCloudEmbedProps = {
  scUrl: string
  title?: string
  height?: number
  mode?: 'visual' | 'list'
  autoPlay?: boolean
  reloadKey?: number
  onLoad?: () => void
  /** Default `lazy` defers third-party iframe work until decode. Pass `eager` on primary playback surfaces (song detail, songbook, tracks compare). */
  loading?: 'lazy' | 'eager'
}

export function SoundCloudEmbed({
  scUrl,
  title = 'SoundCloud player',
  height = 300,
  mode = 'visual',
  autoPlay = false,
  reloadKey = 0,
  onLoad,
  loading = 'lazy',
}: SoundCloudEmbedProps) {
  const { theme } = useTheme()

  return (
    <iframe
      key={`${scUrl}::${reloadKey}::${autoPlay ? 'autoplay' : 'manual'}`}
      className="sc-embed-frame"
      title={title}
      width="100%"
      height={height}
      loading={loading}
      scrolling="no"
      allow="autoplay"
      src={soundcloudPlayerSrc(scUrl, mode, autoPlay, theme)}
      onLoad={onLoad}
    />
  )
}
