import { flushSync } from 'react-dom'

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

/** Stable catalog track — hidden iframe warm-up on desktop (Safari needs widget bound before Play All gesture). */
export const PERSISTENT_SC_PRIMER_URL =
  'https://soundcloud.com/bananasutra/08-tell-the-truth-knowsutra-true-blues-cover-8'

export function persistentScIframeIsWarm(): boolean {
  return bootstrapState.url != null
}

/** True while the hidden warm-up iframe still points at the catalog primer track. */
export function persistentScBootstrapIsPrimer(): boolean {
  return bootstrapState.url === PERSISTENT_SC_PRIMER_URL
}

/** First user track after primer warm-up must remount the iframe (R56 #116). */
export function shouldRemountPersistentScFromPrimer(scUrl: string): boolean {
  const trimmed = scUrl.trim()
  if (!trimmed || trimmed === PERSISTENT_SC_PRIMER_URL) return false
  return persistentScBootstrapIsPrimer()
}

/** True when the persistent iframe must load `scUrl` (primer warm-up or URL drift). R64 #129. */
export function persistentScNeedsExplicitLoad(scUrl: string): boolean {
  const trimmed = scUrl.trim()
  if (!trimmed) return false
  if (persistentScBootstrapIsPrimer()) return true
  return getPersistentScBootstrapSnapshot().url !== trimmed
}

/** Mount hidden SC iframe early so Play All can widget.load + play inside the click handler. */
export function primePersistentScIframe(): void {
  if (bootstrapState.url != null) return
  setPersistentScBootstrap(PERSISTENT_SC_PRIMER_URL, false, false)
}

export function resetPersistentScBootstrap(): void {
  bootstrapState.url = null
  bootstrapState.autoPlay = false
  bootstrapState.generation = 0
  emitBootstrapChange()
}

/** Stop/teardown then immediately re-warm iframe for the next Play All (Safari). */
export function resetAndPrimePersistentSc(): void {
  resetPersistentScBootstrap()
  primePersistentScIframe()
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
  let remount = opts.remount ?? false
  const coldStart = bootstrapState.url == null

  if (shouldRemountPersistentScFromPrimer(trimmed)) {
    remount = true
  }

  if (remount && !coldStart) {
    setPersistentScBootstrap(trimmed, autoPlay, true)
    return
  }

  setPersistentScBootstrap(trimmed, autoPlay, coldStart && remount)
}

/**
 * Safari Play All: mount persistent iframe synchronously inside the user-gesture stack.
 * Without flushSync, React commits the iframe after the gesture ends and autoplay is blocked.
 */
export function requestPersistentScLoadSync(scUrl: string, opts: PersistentScLoadRequest = {}): void {
  flushSync(() => {
    requestPersistentScLoad(scUrl, opts)
  })
}

syncBootstrapSnapshot()
