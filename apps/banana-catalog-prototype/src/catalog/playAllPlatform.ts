import { useCallback, useSyncExternalStore } from 'react'

/** Matches catalog desktop breakpoint (`min-width: 900px`); Play All queue is desktop-only per D-021. */
export const PLAY_ALL_DESKTOP_MEDIA_QUERY = '(min-width: 900px)'

/** D-021 honest platform limits — mobile Play All does not work reliably. */
export const PLAY_ALL_HONEST_MOBILE_COPY =
  'Play All works best on desktop. On mobile, open a songbook for uninterrupted listening.'

/** Song page mobile hint — EP tab/stack beats songbook when both exist (e.g. song-specific EP remix grid). */
export function songDetailPlayAllHonestMobileCopy({
  hasFullEpListen,
  hasFullEpTab,
  hasSongbookPlaylist,
}: {
  hasFullEpListen: boolean
  hasFullEpTab: boolean
  hasSongbookPlaylist: boolean
}): string {
  if (hasFullEpListen && hasFullEpTab) {
    return 'Play All works best on desktop. On mobile, switch to Full EP for uninterrupted listening.'
  }
  if (hasFullEpListen) {
    return 'Play All works best on desktop. On mobile, use Full EP for uninterrupted listening.'
  }
  if (hasSongbookPlaylist) {
    return 'Play All works best on desktop. On mobile, open a songbook for uninterrupted listening.'
  }
  return PLAY_ALL_HONEST_MOBILE_COPY
}

export function usePlayAllDesktopAvailable(): boolean {
  const subscribe = useCallback((onStoreChange: () => void) => {
    const mq = window.matchMedia(PLAY_ALL_DESKTOP_MEDIA_QUERY)
    mq.addEventListener('change', onStoreChange)
    return () => mq.removeEventListener('change', onStoreChange)
  }, [])
  const getSnapshot = useCallback(() => window.matchMedia(PLAY_ALL_DESKTOP_MEDIA_QUERY).matches, [])
  const getServerSnapshot = useCallback(() => true, [])
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
