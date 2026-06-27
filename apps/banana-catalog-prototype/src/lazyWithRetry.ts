import { lazy, type ComponentType, type LazyExoticComponent } from 'react'

type ModuleDefault<T extends ComponentType<unknown>> = { default: T }

/**
 * Lazy import with bounded retries for flaky chunk loads (slow networks, CDN hiccups).
 * Keeps Suspense on the loading fallback instead of surfacing RouteLoadErrorFallback immediately.
 */
export function lazyWithRetry<T extends ComponentType<unknown>>(
  factory: () => Promise<ModuleDefault<T>>,
  retries = 2,
): LazyExoticComponent<T> {
  return lazy(async () => {
    let lastError: unknown
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      try {
        return await factory()
      } catch (error) {
        lastError = error
        if (attempt < retries) {
          await new Promise((resolve) => window.setTimeout(resolve, 700 * (attempt + 1)))
        }
      }
    }
    throw lastError
  })
}
