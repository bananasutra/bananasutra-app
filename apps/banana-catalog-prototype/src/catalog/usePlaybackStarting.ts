import { useCallback, useEffect, useState } from 'react'

const PLAYBACK_STARTING_TIMEOUT_MS = 15000

/** True after user requests play until consumer clears on PLAY or timeout. */
export function usePlaybackStarting() {
  const [playbackStarting, setPlaybackStarting] = useState(false)

  const markPlaybackStarting = useCallback(() => {
    setPlaybackStarting(true)
  }, [])

  const clearPlaybackStarting = useCallback(() => {
    setPlaybackStarting(false)
  }, [])

  useEffect(() => {
    if (!playbackStarting) return
    const timeout = window.setTimeout(() => setPlaybackStarting(false), PLAYBACK_STARTING_TIMEOUT_MS)
    return () => window.clearTimeout(timeout)
  }, [playbackStarting])

  return { playbackStarting, markPlaybackStarting, clearPlaybackStarting }
}
