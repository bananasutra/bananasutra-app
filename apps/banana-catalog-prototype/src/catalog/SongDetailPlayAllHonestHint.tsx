type Props = {
  variant: 'full-ep-tab' | 'full-ep-only' | 'songbook' | 'generic'
  onSwitchToFullEp?: () => void
}

export function SongDetailPlayAllHonestHint({ variant, onSwitchToFullEp }: Props) {
  if (variant === 'full-ep-tab') {
    return (
      <p className="song-detail-audio-hint song-detail-audio-hint--honest">
        Mobile devices block autoplay. For a continuous listening experience,{' '}
        <button type="button" className="song-detail-audio-hint__action" onClick={onSwitchToFullEp}>
          switch to an EP tab
        </button>
        .
      </p>
    )
  }

  if (variant === 'full-ep-only') {
    return (
      <p className="song-detail-audio-hint song-detail-audio-hint--honest">
        Mobile devices block autoplay. For a continuous listening experience, use an EP tab.
      </p>
    )
  }

  if (variant === 'songbook') {
    return (
      <p className="song-detail-audio-hint song-detail-audio-hint--honest">
        Mobile devices block autoplay. For a continuous listening experience, open a songbook.
      </p>
    )
  }

  return (
    <p className="song-detail-audio-hint song-detail-audio-hint--honest">
      Mobile devices block autoplay. For a continuous listening experience, open a songbook.
    </p>
  )
}
