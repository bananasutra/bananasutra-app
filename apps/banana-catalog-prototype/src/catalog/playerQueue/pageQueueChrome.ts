/** Persistent bar owns transport/stop when desktop Play All session is active (R65). */
export function persistentBarOwnsQueueChrome(
  playAllDesktopAvailable: boolean,
  playAllActive: boolean,
): boolean {
  return playAllDesktopAvailable && playAllActive
}
