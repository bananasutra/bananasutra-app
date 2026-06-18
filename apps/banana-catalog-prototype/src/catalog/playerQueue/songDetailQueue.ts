import { useCallback, useMemo, type MutableRefObject } from 'react'
import {
  findTrackByScUrl,
  trackSongDetailPlayAllStarted,
  trackSongDetailPlayAllStopped,
  trackSongDetailPlayStarted,
  trackSongDetailQueueAdvanced,
  trackSongDetailQueueSkipped,
} from '../catalogAnalytics'
import type { SongDetailTrack } from '../types'
import type { SoundCloudWidget } from '../soundcloudWidgetApi'
import type { PagePlayerQueueAnalytics } from './pagePlayerQueueAnalytics'
import { normScUrl, songDetailTrackToPlayable } from './playableTrackAdapters'
import type { PlayableTrack, PlayerQueueSource } from './types'
import { usePagePlayerQueue, type UsePagePlayerQueueResult } from './usePagePlayerQueue'

export type UseSongDetailTopTracksQueueArgs = {
  inAppPlayableTracksRef: MutableRefObject<SongDetailTrack[]>
  playingUrlRef: MutableRefObject<string>
  scWidgetRef: MutableRefObject<SoundCloudWidget | null>
  lyricsId: string
  songTitle: string
  songSlug?: string
  lyricsExtract?: string
  requestSoundcloudPlayback: (url: string, opts?: { fromPlayAllStart?: boolean }) => void
}

export function useSongDetailTopTracksQueue(
  args: UseSongDetailTopTracksQueueArgs,
): UsePagePlayerQueueResult & { startPlayAllFromPage: () => void } {
  const {
    inAppPlayableTracksRef,
    playingUrlRef,
    scWidgetRef,
    lyricsId,
    songTitle,
    songSlug,
    lyricsExtract,
    requestSoundcloudPlayback,
  } = args

  const findDetailTrack = useCallback(
    (track: PlayableTrack): SongDetailTrack | undefined => {
      const byId = inAppPlayableTracksRef.current.find((t) => t.track_id === track.track_id)
      if (byId) return byId
      return findTrackByScUrl(inAppPlayableTracksRef.current, track.sc_url)
    },
    [inAppPlayableTracksRef],
  )

  const analytics: PagePlayerQueueAnalytics = useMemo(
    () => ({
      onPlayStarted: (track, intent) => {
        const row = findDetailTrack(track)
        if (row) trackSongDetailPlayStarted(row, intent)
      },
      onPlayAllStarted: (total) => trackSongDetailPlayAllStarted(total),
      onPlayAllStopped: (tracksPlayed, total, reason) => {
        trackSongDetailPlayAllStopped(tracksPlayed, total, reason)
      },
      onQueueAdvanced: (from, to, position, total) => {
        const fromRow = findDetailTrack(from)
        const toRow = findDetailTrack(to)
        if (!fromRow || !toRow) return
        trackSongDetailQueueAdvanced({ from: fromRow, to: toRow, position, total })
      },
      onQueueSkipped: (from, to, direction) => {
        const fromRow = findDetailTrack(from)
        const toRow = findDetailTrack(to)
        if (!fromRow || !toRow) return
        trackSongDetailQueueSkipped({ from: fromRow, to: toRow, direction })
      },
    }),
    [findDetailTrack],
  )

  const onPlayTrack = useCallback(
    (track: PlayableTrack, opts: { fromPlayAllStart?: boolean }) => {
      const sameUrl = track.sc_url.trim() === playingUrlRef.current.trim()
      if (opts.fromPlayAllStart && sameUrl) return
      requestSoundcloudPlayback(track.sc_url)
    },
    [playingUrlRef, requestSoundcloudPlayback],
  )

  const buildPlayAllSource = useCallback(
    (): Extract<PlayerQueueSource, { type: 'song_variants' }> => ({
      type: 'song_variants',
      song_id: lyricsId,
      song_title: songTitle,
      song_slug: songSlug,
    }),
    [lyricsId, songSlug, songTitle],
  )

  const getQueue = useCallback(
    () => inAppPlayableTracksRef.current.map((t) => songDetailTrackToPlayable(t, lyricsExtract)),
    [inAppPlayableTracksRef, lyricsExtract],
  )

  const queue = usePagePlayerQueue({
    selectionMode: 'sc_url',
    getQueue,
    getCurrentKey: () => normScUrl(playingUrlRef.current),
    widgetRef: scWidgetRef,
    analytics,
    buildPlayAllSource,
    onPlayTrack: (track, opts) => onPlayTrack(track, opts),
  })

  const startPlayAllFromPage = useCallback(() => {
    queue.actions.startPlayAll(buildPlayAllSource(), getQueue())
  }, [buildPlayAllSource, getQueue, queue.actions])

  return useMemo(
    () => ({
      ...queue,
      startPlayAllFromPage,
    }),
    [queue, startPlayAllFromPage],
  )
}
