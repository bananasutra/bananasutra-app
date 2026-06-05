/**
 * Minimal loader + types for the SoundCloud Widget API.
 *
 * Used by /tracks "Play All" to listen for FINISH on the embed iframe and advance
 * the queue. The script is loaded once on demand (not in index.html) so visitors
 * who never trigger Play All don't pay for it.
 */

export type SoundCloudWidgetLoadOptions = {
  auto_play?: boolean
}

export type SoundCloudWidget = {
  bind(event: string, cb: () => void): void
  unbind(event: string): void
  play(): void
  pause(): void
  /** Swap track on the same iframe without remounting (preserves mobile gesture chain). */
  load(scUrl: string, options?: SoundCloudWidgetLoadOptions): void
}

export type SoundCloudWidgetEvents = {
  READY: string
  FINISH: string
  PLAY: string
  PAUSE: string
  ERROR: string
}

type SoundCloudGlobal = {
  Widget: ((iframe: HTMLIFrameElement) => SoundCloudWidget) & {
    Events: SoundCloudWidgetEvents
  }
}

declare global {
  interface Window {
    SC?: SoundCloudGlobal
  }
}

const SC_WIDGET_API_SRC = 'https://w.soundcloud.com/player/api.js'

let loaderPromise: Promise<SoundCloudGlobal> | null = null

export function loadSoundCloudWidgetApi(): Promise<SoundCloudGlobal> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('SoundCloud Widget API requires a browser environment'))
  }
  if (window.SC?.Widget) return Promise.resolve(window.SC)
  if (loaderPromise) return loaderPromise

  loaderPromise = new Promise<SoundCloudGlobal>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SC_WIDGET_API_SRC}"]`)
    const onReady = () => {
      if (window.SC?.Widget) resolve(window.SC)
      else reject(new Error('SoundCloud Widget API loaded without SC.Widget'))
    }
    if (existing) {
      if (window.SC?.Widget) {
        onReady()
        return
      }
      existing.addEventListener('load', onReady, { once: true })
      existing.addEventListener('error', () => reject(new Error('Failed to load SoundCloud Widget API')), { once: true })
      return
    }
    const script = document.createElement('script')
    script.src = SC_WIDGET_API_SRC
    script.async = true
    script.addEventListener('load', onReady, { once: true })
    script.addEventListener(
      'error',
      () => {
        loaderPromise = null
        reject(new Error('Failed to load SoundCloud Widget API'))
      },
      { once: true },
    )
    document.head.appendChild(script)
  })

  return loaderPromise
}
