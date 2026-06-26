import chromeStatsJson from '../data/generated/catalog_chrome_stats.json'

export type CatalogChromeStats = {
  sutraCount: number
  songbookCount: number
  songCount: number
  topTrackCount: number
  videoCount: number
}

/** Build-time totals (~200 B) — instant chrome counts without waiting on browse JSON fetch. */
export const CATALOG_CHROME_STATS = chromeStatsJson as CatalogChromeStats
