import { useCallback, useMemo, type MutableRefObject } from 'react'
import {
  findTrackByScUrl,
  trackSongDetailPlayAllStarted,
  trackSongDetailPlayAllStopped,
  trackSongDetailPlayCompleted,
  trackSongDetailPlayStarted,
  trackSongDetailQueueAdvanced,
  trackSongDetailQueueSkipped,
} from '../catalogAnalytics'
import type { SongDetailTrack } from '../types'
import type { PagePlayerQueueAnalytics } from './pagePlayerQueueAnalytics'
import { normScUrl, songDetailTrackToPlayable } from './playableTrackAdapters'
import type { PlayableTrack, PlayerQueueSource } from './types'
import { usePlayerQueue } from './usePlayerQueue'
import { usePlayerQueueRegistrar, type PagePlayerQueueRegistration } from './playerQueueRegistrarContext'

export type UseSongDetailTopTracksQueueArgs = {
  inAppPlayableTracksRef: MutableRefObject<SongDetailTrack[]>
  playingUrlRef: MutableRefObject<string>
  lyricsId: string
  songTitle: string
  songSlug?: string
  lyricsExtract?: string
  songUrlSlug?: string
  requestSoundcloudPlayback: (url: string, opts?: { fromPlayAllStart?: boolean }) => void
  syncPlayingUrl: (url: string) => void
}

export function useSongDetailTopTracksQueue(
  args: UseSongDetailTopTracksQueueArgs,
): {
  registration: PagePlayerQueueRegistration
  startPlayAllFromPage: () => void
} {
  const {
    inAppPlayableTracksRef,
    playingUrlRef,
    lyricsId,
    songTitle,
    songSlug,
    lyricsExtract,
    songUrlSlug,
    requestSoundcloudPlayback,
    syncPlayingUrl,
  } = args

  const { actions } = usePlayerQueue()
  const { usePersistentPlayback, persistentApiRef } = usePlayerQueueRegistrar()

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
      onTrackCompleted: (track) => {
        const row = findDetailTrack(track)
        if (row) trackSongDetailPlayCompleted(row)
      },
    }),
    [findDetailTrack],
  )

  const onPlayTrack = useCallback(
    (
      track: PlayableTrack,
      opts: { intent?: string; keepPlayAll?: boolean; fromPlayAllStart?: boolean },
    ) => {
      void opts.intent
      void opts.keepPlayAll
      const url = track.sc_url.trim()
      if (!url) return

      if (usePersistentPlayback) {
        if (opts.fromPlayAllStart) {
          syncPlayingUrl(url)
          return
        }
        persistentApiRef.current?.loadTrack(url, { autoPlay: true })
        syncPlayingUrl(url)
        return
      }

      const sameUrl = url === playingUrlRef.current.trim()
      if (opts.fromPlayAllStart && sameUrl) return
      requestSoundcloudPlayback(url, { fromPlayAllStart: opts.fromPlayAllStart })
    },
    [persistentApiRef, playingUrlRef, requestSoundcloudPlayback, syncPlayingUrl, usePersistentPlayback],
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
    () =>
      inAppPlayableTracksRef.current.map((t) =>
        songDetailTrackToPlayable(t, lyricsExtract, songUrlSlug),
      ),
    [inAppPlayableTracksRef, lyricsExtract, songUrlSlug],
  )

  const registration = useMemo(
    (): PagePlayerQueueRegistration => ({
      selectionMode: 'track_id',
      getQueue,
      getCurrentKey: () => {
        const url = normScUrl(playingUrlRef.current)
        const match = inAppPlayableTracksRef.current.find((t) => t.sc_url.trim() === url)
        return match?.track_id ?? null
      },
      analytics,
      buildPlayAllSource,
      onPlayTrack: (track, opts) => onPlayTrack(track, opts),
    }),
    [analytics, buildPlayAllSource, getQueue, onPlayTrack, playingUrlRef],
  )

  const startPlayAllFromPage = useCallback(() => {
    actions.startPlayAll(buildPlayAllSource(), getQueue())
  }, [actions, buildPlayAllSource, getQueue])

  return { registration, startPlayAllFromPage }
}
