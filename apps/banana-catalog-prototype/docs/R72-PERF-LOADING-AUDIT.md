# R72 — Perceived performance loading audit (pipeline #152)

**Release:** R72  
**Pipeline row:** 152  
**Type:** Investigative / planning only (no code in this slice beyond #150–#151)  
**Date:** 2026-06-27

## Purpose

Identify surfaces where load time (first paint or post-interaction) can feel broken without an animated or explicit loading state. This doc feeds a future UX polish slice; it is not a build checklist for R72 itself.

## Legend

| Signal | Meaning |
|--------|---------|
| **Good** | User sees spinner, shimmer, skeleton, or clear copy while work is in flight |
| **Partial** | Text-only “Loading…” with no visual affordance on the waiting element |
| **Gap** | Empty layout, blank tiles, or silent stall likely on slow networks |

## Global / navigation

| Surface | Trigger | Current UX | Gap? | Notes / recommendation |
|---------|---------|------------|------|------------------------|
| Lazy route chunks | In-app nav to any lazy page | Spinner + “Loading…”; 4.5s “Still loading”; 12s slow + retry (R72 #151) | **Good** (post-R72) | `lazyWithRetry` reduces premature error fallback |
| Route chunk failure | CDN/network flake after retries | “Page load stalled” + retry (R72 #151) | **Good** | Copy no longer blames connection first |
| `NavigationLoadingBridge` | Link click before URL commits | Top indeterminate bar, 6s cap | **Partial** | Bar is thin; easy to miss on mobile. Consider pairing with subtle page dim on long pending |
| `DiscoverySearchLazy` | Header search mount | `aria-label="Loading search"` only | **Partial** | No visible skeleton in search slot |

## Home (`/`)

| Surface | Trigger | Current UX | Gap? | Notes / recommendation |
|---------|---------|------------|------|------------------------|
| Latest drops | `useSongCatalogBrowse` fetch | Text: “Loading latest drops…” | **Partial** | Grid area empty; no thumb skeletons. Reuse `catalog-grid--skeleton` or thumb shimmer |
| Top 5 tracks | `track_catalog.json` fetch | Text: “Loading top tracks…” | **Partial** | Player shell empty until data + embed |
| Feeling lucky strip | Reload / image fetch | Per-tile shimmer until `onLoad` (R72 #150) | **Good** (post-R72) | Pattern candidate for other thumb grids |
| Songbooks corner | Image lazy load | No per-image state | **Gap** | Same blank-square risk as pre-R72 lucky strip |
| Video teaser | YouTube metadata fetch | Text: “Loading videos…” | **Partial** | Poster area empty during fetch |
| Hero quote / sutra grid | Sync or fast JSON | Immediate | **Good** | — |

## Browse / list pages

| Surface | Trigger | Current UX | Gap? | Notes / recommendation |
|---------|---------|------------|------|------------------------|
| `/songs` initial load | Catalog JSON + filter UI | Card grid skeleton (`catalog-grid--skeleton`) | **Good** | Reference implementation |
| `/songs` sort/filter change | Re-filter in memory | Instant (no network) | **Good** | — |
| `/tracks` | `track_catalog.json` | Plain “Loading track catalog…” | **Partial** | Large page; consider grid skeleton like songs |
| `/words` | Word catalog fetch | Text loading copy | **Partial** | — |
| `/videos` featured hero | YouTube + poster | Hero skeleton blocks | **Good** | — |
| `/videos` grid thumbs | Lazy images | No per-thumb shimmer | **Gap** | High image count; lucky-strip pattern would help |
| `/songbooks` | Catalog + cards | Mixed; thumb cards lazy | **Gap** | Card art can pop in late |

## Detail pages

| Surface | Trigger | Current UX | Gap? | Notes / recommendation |
|---------|---------|------------|------|------------------------|
| `/songs/:slug` | Song detail JSON | Content shell; embed lazy | **Partial** | `LazySoundCloudEmbed` has skeleton (R71) |
| `/sutras/:slug` | Sutra + related songs | Thumb cards lazy | **Gap** | Related grid blank squares on slow 3G |
| `/songbooks/:slug` | Songbook detail | Thumb list lazy | **Gap** | Same as related songs |
| Persistent player lyrics | Tab open / track change | “Loading lyrics…” text | **Partial** | Small panel; text is probably enough |

## LP pages (`/learn`, `/listen`, `/watch`)

| Surface | Trigger | Current UX | Gap? | Notes / recommendation |
|---------|---------|------------|------|------------------------|
| Route lazy chunk | First visit | Global route fallback (R72 #151) | **Good** | `/learn` was reported site of false “gave up” |
| Section JSON (listen LP) | Deferred catalog hooks | `listen-lp__loading` text | **Partial** | Thumb grids on LP could use skeletons |
| Watch playlist embed | YouTube iframe | Facade + loader patterns vary | **Partial** | Audit per embed type in a WATCH slice |

## Bertrand (BBB)

| Surface | Trigger | Current UX | Gap? | Notes / recommendation |
|---------|---------|------------|------|------------------------|
| Chat history stream | Send message | `aria-busy` on history | **Partial** | Typing indicator exists; first open has no warm-up hint |
| Widget lazy mount | N/A (sync in bundle when enabled) | — | **Good** | — |

## Shared components (highest leverage)

| Component | Used on | Recommendation |
|-----------|---------|----------------|
| `CoverImage` / `SongThumbCard` | Home, LP, sutra, songbook, browse | Add optional shimmer wrapper (same CSS tokens as lucky strip / catalog skeleton) |
| `SongThumbDropsGrid` | Home latest drops, listen LP | Pass loading state from parent or shimmer inside card |
| `HomePortalCoverStrip` | Home only | **Done in R72 #150** — extract `ThumbShimmer` if reused |
| `CatalogApp` skeleton | `/songs` | Template for other grid pages |

## Suggested priority for a follow-up slice (not R72)

1. **P0 — Shared thumb shimmer** on `SongThumbCard` / `CoverImage` (fixes home drops, sutra related, songbooks, videos grid in one pass).
2. **P1 — Tracks page grid skeleton** (large JSON, high traffic).
3. **P1 — Home songbooks corner** (same pattern as lucky strip).
4. **P2 — Discovery search slot skeleton** (header interaction).
5. **P2 — Navigation pending affordance** (stronger than bar alone on slow chunk loads).

## Out of scope (performance, not perceived UX)

- Image byte size / CF transform widths (see `R71-PERF-AUDIT-HANDOFF.md` P0/P1 items).
- JSON deferral strategy on home (already split via `useHomeDeferredCatalog`).
- Server TTFB / CDN caching.

## R72 shipped in code (reference)

- **#150:** `HomePortalCoverStrip` per-tile shimmer + fade-in on load/reload.
- **#151:** `lazyWithRetry`, staged route fallback copy, softer error fallback after retries exhausted.
