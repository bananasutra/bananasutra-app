/** Playful page-wait lines — sentence case in source; CSS renders Archivo caps. */
export const CATALOG_PAGE_LOADING_LINES = ['Peeling your banana', 'Almost ripe'] as const

export function pickCatalogPageLoadingLine(
  lines: readonly string[] = CATALOG_PAGE_LOADING_LINES,
): string {
  const i = Math.floor(Math.random() * lines.length)
  return (lines[i] ?? lines[0] ?? 'Loading').replace(/\u2026|\.{2,}$/u, '').trimEnd()
}
