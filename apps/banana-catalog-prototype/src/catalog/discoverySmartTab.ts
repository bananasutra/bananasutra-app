import type { SongCatalogItem, YouTubeCatalogVideo } from './types'
import { countTitleTokenMatches, searchTokens, songLedByTrackLayerNotFullMeaning } from './searchMatch'

export type DiscoveryKeywordTab = 'songbooks' | 'songs' | 'tracks' | 'videos'

type SongbookGroup = { songbook: string; matchCount: number }

/**
 * ## Smart-default keyword tab (IA §3.10 — v1, 2026-04-28)
 *
 * When the debounced query changes, pick the **initial** tab among Songbooks / Top Songs / Top Tracks / Videos.
 * User overrides by clicking a tab; this only runs when derived inputs change (new query / new result sets).
 *
 * ### 1. Exact-tier (per tab)
 * If true, the tab joins **tier 1** (beats any tab that only has raw hit volume).
 *
 * - **Songbooks:** some group has `songbook` equal to the full query (trim, ASCII case-fold) and `matchCount > 0`.
 * - **Top Songs:** among the first **12** hits, some song has **all** query tokens matching in `lyrics_title`
 *   (`countTitleTokenMatches === token count`, same boundaries as search).
 * - **Top Tracks:** among the first **12** hits, `songLedByTrackLayerNotFullMeaning` — every token hits SC
 *   title/genre blob but **not** every token hits the meaning card alone (“sound-led”).
 * - **Videos:** some filtered row has `lyrics_title` or `title` equal to the full query (trim, case-fold).
 *
 * ### 2. Tier-1 selection
 * Among tier-1 tabs with **count > 0**, pick the **largest** hit count
 * (`songbook groups`, `songs.length`, `tracks.length`, `video group count`).
 *
 * ### 3. Ties (tier-1 or not)
 * Same count → prefer **tracks > videos > songs > songbooks** (genre/media-heavy ties lean audio / YT).
 *
 * ### 4. No tier-1 tab
 * Choose by **max count** only (same tie order). Tabs with **zero** hits are ignored unless every tab is zero.
 *
 * ### 5. All zeros
 * Return **`songbooks`** (empty-state UX for that tab).
 */
const TIE: Record<DiscoveryKeywordTab, number> = {
  tracks: 4,
  videos: 3,
  songs: 2,
  songbooks: 1,
}

function tabScore(exact: boolean, count: number, tab: DiscoveryKeywordTab): number {
  const tier = exact ? 1_000_000 : 0
  const capped = Math.min(Math.max(count, 0), 99_999)
  return tier + capped * 10 + TIE[tab]
}

function scanHead<T>(arr: T[], n: number, pred: (row: T) => boolean): boolean {
  const lim = Math.min(n, arr.length)
  for (let i = 0; i < lim; i++) {
    if (pred(arr[i]!)) return true
  }
  return false
}

export function pickSmartDiscoveryTab(
  debounced: string,
  songbookGroups: SongbookGroup[],
  songsTabSongs: SongCatalogItem[],
  tracksTabSongs: SongCatalogItem[],
  videosTabFiltered: YouTubeCatalogVideo[],
  videoGroupCount: number,
): DiscoveryKeywordTab {
  const q = debounced.trim()
  if (!q) return 'songbooks'

  const tokens = searchTokens(debounced)
  const qn = q.toLowerCase()

  const nb = songbookGroups.length
  const ns = songsTabSongs.length
  const nt = tracksTabSongs.length
  const nv = videoGroupCount

  const exactSongbook =
    nb > 0 && songbookGroups.some((g) => g.matchCount > 0 && g.songbook.trim().toLowerCase() === qn)

  const exactSongs =
    tokens.length > 0 &&
    ns > 0 &&
    scanHead(songsTabSongs, 12, (s) => countTitleTokenMatches(s, tokens) === tokens.length)

  const exactTracks =
    tokens.length > 0 && nt > 0 && scanHead(tracksTabSongs, 12, (s) => songLedByTrackLayerNotFullMeaning(s, tokens))

  const exactVideos =
    nv > 0 &&
    videosTabFiltered.some((v) => {
      const lt = (v.lyrics_title || '').trim().toLowerCase()
      const tt = (v.title || '').trim().toLowerCase()
      return lt === qn || tt === qn
    })

  const candidates: { tab: DiscoveryKeywordTab; exact: boolean; count: number }[] = [
    { tab: 'songbooks', exact: exactSongbook, count: nb },
    { tab: 'songs', exact: exactSongs, count: ns },
    { tab: 'tracks', exact: exactTracks, count: nt },
    { tab: 'videos', exact: exactVideos, count: nv },
  ]

  const anyHits = candidates.some((c) => c.count > 0)
  if (!anyHits) return 'songbooks'

  const tier1 = candidates.filter((c) => c.exact && c.count > 0)
  const pool = tier1.length ? tier1 : candidates.filter((c) => c.count > 0)

  let best = pool[0]!
  let bestScore = tabScore(best.exact, best.count, best.tab)
  for (let i = 1; i < pool.length; i++) {
    const c = pool[i]!
    const sc = tabScore(c.exact, c.count, c.tab)
    if (sc > bestScore) {
      best = c
      bestScore = sc
    }
  }
  return best.tab
}
