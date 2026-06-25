import { useCallback, useSyncExternalStore } from 'react'

/** Layout breakpoint only — do not use for Play All / persistent player eligibility. */
export const PLAY_ALL_DESKTOP_MEDIA_QUERY = '(min-width: 900px)'

/**
 * Song page lyrics+media two-column split — wide viewports or desktop-class pointers
 * (matches persistent player device gate so narrow desktop windows still get side-by-side lyrics).
 */
export const SONG_DETAIL_TWO_COL_MEDIA_QUERY = `${PLAY_ALL_DESKTOP_MEDIA_QUERY}, (hover: hover) and (pointer: fine)`

/**
 * Touch-primary devices (phones/tablets) — Play All uses inline embeds per D-021.
 * Viewport width is intentionally excluded so resizing a desktop window does not drop the queue.
 */
export const PLAY_ALL_TOUCH_PRIMARY_MEDIA_QUERY = '(hover: none) and (pointer: coarse)'

/** True on desktop-class pointers (mouse/trackpad), even when the window is narrow. */
export function isPlayAllDesktopDevice(): boolean {
  if (typeof window === 'undefined') return true
  return !window.matchMedia(PLAY_ALL_TOUCH_PRIMARY_MEDIA_QUERY).matches
}

/** D-021 honest platform limits — mobile Play All does not work reliably. */
export const PLAY_ALL_HONEST_MOBILE_COPY =
  'Mobile devices block autoplay. For a continuous listening experience, open a songbook.'

/** @deprecated Prefer SongDetailPlayAllHonestHint — kept for non-React call sites. */
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
    return 'Mobile devices block autoplay. For a continuous listening experience, switch to Full EP.'
  }
  if (hasFullEpListen) {
    return 'Mobile devices block autoplay. For a continuous listening experience, use Full EP.'
  }
  if (hasSongbookPlaylist) {
    return 'Mobile devices block autoplay. For a continuous listening experience, open a songbook.'
  }
  return PLAY_ALL_HONEST_MOBILE_COPY
}

export function usePlayAllDesktopAvailable(): boolean {
  const subscribe = useCallback((onStoreChange: () => void) => {
    const mq = window.matchMedia(PLAY_ALL_TOUCH_PRIMARY_MEDIA_QUERY)
    mq.addEventListener('change', onStoreChange)
    return () => mq.removeEventListener('change', onStoreChange)
  }, [])
  const getSnapshot = useCallback(() => isPlayAllDesktopDevice(), [])
  const getServerSnapshot = useCallback(() => true, [])
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
