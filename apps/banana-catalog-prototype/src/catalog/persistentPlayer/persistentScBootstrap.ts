/** Module scope — survives React Strict Mode remount; iframe mounts from snapshot + generation bump. */
export type PersistentScBootstrap = {
  url: string | null
  autoPlay: boolean
  /** Bumps when iframe `src` must remount (same URL, fresh Play All on song page). */
  generation: number
}

const bootstrapState: PersistentScBootstrap = {
  url: null,
  autoPlay: false,
  generation: 0,
}

/** Immutable snapshot for useSyncExternalStore — new reference only when bootstrap changes. */
let bootstrapSnapshot: PersistentScBootstrap = {
  url: null,
  autoPlay: false,
  generation: 0,
}

const bootstrapListeners = new Set<() => void>()

function syncBootstrapSnapshot(): void {
  bootstrapSnapshot = {
    url: bootstrapState.url,
    autoPlay: bootstrapState.autoPlay,
    generation: bootstrapState.generation,
  }
}

function emitBootstrapChange(): void {
  syncBootstrapSnapshot()
  bootstrapListeners.forEach((listener) => listener())
}

export function subscribePersistentScBootstrap(listener: () => void): () => void {
  bootstrapListeners.add(listener)
  return () => bootstrapListeners.delete(listener)
}

export function getPersistentScBootstrapSnapshot(): PersistentScBootstrap {
  return bootstrapSnapshot
}

/** @deprecated Read via getPersistentScBootstrapSnapshot in React; kept for non-React callers. */
export const persistentScBootstrap = bootstrapState

export function resetPersistentScBootstrap(): void {
  bootstrapState.url = null
  bootstrapState.autoPlay = false
  bootstrapState.generation = 0
  emitBootstrapChange()
}

export function setPersistentScBootstrap(url: string, autoPlay: boolean, remount = false): void {
  bootstrapState.url = url
  bootstrapState.autoPlay = autoPlay
  if (remount) bootstrapState.generation += 1
  emitBootstrapChange()
}

export type PersistentScLoadRequest = {
  autoPlay?: boolean
  remount?: boolean
}

/** Queue / song page entry — works before the iframe component has painted. */
export function requestPersistentScLoad(scUrl: string, opts: PersistentScLoadRequest = {}): void {
  const trimmed = scUrl.trim()
  if (!trimmed) return
  const autoPlay = opts.autoPlay ?? false
  const remount = opts.remount ?? false
  const coldStart = bootstrapState.url == null

  if (remount && !coldStart) {
    setPersistentScBootstrap(trimmed, autoPlay, true)
    return
  }

  setPersistentScBootstrap(trimmed, autoPlay, coldStart && remount)
}

syncBootstrapSnapshot()
