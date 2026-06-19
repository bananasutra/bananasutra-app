import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

/** D-034: items per manual "Load more" click (pseudo-infinite, not scroll-auto). */
export const CATALOG_INFINITE_SCROLL_BATCH = 24

/** Max items restored on back navigation — avoids remounting a full catalog from sessionStorage. */
export const CATALOG_INFINITE_SCROLL_MAX_RESTORE = 72

export function catalogInfiniteScrollStorageKey(route: string, resetKey: string): string {
  return `catalog-infinite-scroll:${route}:${resetKey}`
}

export function clampCatalogInfiniteScrollRestoreCount(count: number, total: number): number {
  if (total <= 0 || count <= 0) return 0
  return Math.min(total, count, CATALOG_INFINITE_SCROLL_MAX_RESTORE)
}

export function computeCatalogInfiniteScrollInitialCount(
  total: number,
  batchSize: number,
  options: { legacyPage?: number; storageKey?: string },
): number {
  if (total <= 0) return 0

  if (options.storageKey && typeof sessionStorage !== 'undefined') {
    try {
      const raw = sessionStorage.getItem(options.storageKey)
      if (raw) {
        const parsed = parseInt(raw, 10)
        if (Number.isFinite(parsed) && parsed > 0) {
          return clampCatalogInfiniteScrollRestoreCount(parsed, total)
        }
      }
    } catch {
      /* sessionStorage blocked */
    }
  }

  if (options.legacyPage && options.legacyPage > 1) {
    const fromLegacy = options.legacyPage * batchSize
    return clampCatalogInfiniteScrollRestoreCount(fromLegacy, total)
  }

  return Math.min(total, batchSize)
}

export type UseCatalogInfiniteScrollOptions<T> = {
  items: T[]
  batchSize?: number
  /** Changes when filters/sort change — resets visible window (except session restore on mount). */
  resetKey: string
  /** sessionStorage key for back-navigation restore; omit to skip persistence. */
  storageKey?: string
  /** Legacy ?page=N deep links: seed initial visible count before URL strip. */
  legacyPage?: number
}

/** Pseudo-infinite catalog browse: initial batch + explicit "Load more" (no scroll-auto append). */
export function useCatalogInfiniteScroll<T>({
  items,
  batchSize = CATALOG_INFINITE_SCROLL_BATCH,
  resetKey,
  storageKey,
  legacyPage = 1,
}: UseCatalogInfiniteScrollOptions<T>) {
  const totalCount = items.length

  const readInitialCount = useCallback(
    (total: number, ignoreLegacy = false) =>
      computeCatalogInfiniteScrollInitialCount(total, batchSize, {
        legacyPage: ignoreLegacy ? 1 : legacyPage,
        storageKey,
      }),
    [batchSize, legacyPage, storageKey],
  )

  const [visibleCount, setVisibleCount] = useState(() => readInitialCount(totalCount))
  const prevResetKeyRef = useRef(resetKey)

  useEffect(() => {
    if (prevResetKeyRef.current === resetKey) return
    prevResetKeyRef.current = resetKey
    setVisibleCount(readInitialCount(totalCount, true))
  }, [resetKey, totalCount, readInitialCount])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async catalog data arrives after first paint
    setVisibleCount((prev) => {
      if (totalCount <= 0) return 0
      if (prev > totalCount) return Math.min(totalCount, batchSize)
      if (prev === 0) return readInitialCount(totalCount)
      return prev
    })
  }, [totalCount, batchSize, readInitialCount])

  useEffect(() => {
    if (!storageKey || visibleCount <= batchSize) return
    try {
      sessionStorage.setItem(
        storageKey,
        String(clampCatalogInfiniteScrollRestoreCount(visibleCount, totalCount)),
      )
    } catch {
      /* sessionStorage blocked */
    }
  }, [storageKey, visibleCount, batchSize, totalCount])

  const hasMore = visibleCount < totalCount
  const visibleItems = useMemo(() => items.slice(0, visibleCount), [items, visibleCount])

  const loadMore = useCallback(() => {
    setVisibleCount((prev) => Math.min(totalCount, prev + batchSize))
  }, [totalCount, batchSize])

  const ensureVisibleThroughIndex = useCallback(
    (index: number) => {
      if (index < 0 || totalCount <= 0) return
      const needed = Math.min(totalCount, index + 1)
      setVisibleCount((prev) => (prev >= needed ? prev : needed))
    },
    [totalCount],
  )

  const resetVisible = useCallback(() => {
    setVisibleCount(Math.min(totalCount, batchSize))
  }, [totalCount, batchSize])

  return {
    visibleItems,
    visibleCount,
    totalCount,
    hasMore,
    loadMore,
    ensureVisibleThroughIndex,
    resetVisible,
  }
}
