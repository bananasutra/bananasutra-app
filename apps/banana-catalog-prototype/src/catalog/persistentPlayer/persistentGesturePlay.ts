/** Safari: iframe load + widget.bind often finishes after the click stack; allow play() briefly. */
const GESTURE_PLAY_WINDOW_MS = 1200

let gesturePlayUntilMs = 0

export function markPersistentGesturePlayWindow(): void {
  gesturePlayUntilMs = performance.now() + GESTURE_PLAY_WINDOW_MS
}

export function persistentGesturePlayWindowActive(): boolean {
  return performance.now() < gesturePlayUntilMs
}

export function clearPersistentGesturePlayWindow(): void {
  gesturePlayUntilMs = 0
}
