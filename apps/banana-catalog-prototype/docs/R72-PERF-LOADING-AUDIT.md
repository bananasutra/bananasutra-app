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

## R73 implementation plan (revised after second-opinion review)

**Goal (Banana, R73):** both visual consistency — *every thumb shimmers the same way* — **and** killing the worst blank-square moments. Because consistency is an explicit goal, consolidation is not optional: do it first, or you ship a fifth slightly-different shimmer and undercut the goal.

### Build order

0. **P0 — Consolidate the shimmer primitive *first*.** There are already **three** hand-rolled shimmer keyframes, all `1.25s ease-in-out`, clearly copy-pasted:
   - `catalog-skeleton-shimmer` (`CatalogApp.css`)
   - `home-lucky-shimmer` (`HomePortal.css`)
   - `catalog-lazy-sc-shimmer` (`LazySoundCloudEmbed.css`)
   - (plus a fourth skeleton style on `VideosPage.css`)

   Extract **one** shared primitive — a single `@keyframes` + CSS custom-properties for color/size, ideally wrapped as a `<ThumbShimmer>` component (the `#150` row already flagged "extract `ThumbShimmer` if reused"). Point the existing three call sites at it. **None of the three current keyframes honor `prefers-reduced-motion`** — fix that once, in the primitive (disable the animation, keep a static neutral fill). This step is what makes "every thumb shimmers the same way" true instead of aspirational.

1. **P0b — Apply the primitive to `CoverImage` (opt-in) and `SongThumbCard`.** See gotchas below — this is not a trivial wrapper. This covers home latest drops, sutra related (mostly — see scope note), songbooks corner cards, and listen-LP drops grids, since all render through `SongThumbCard`.
2. **P1 — Videos grid thumbs (separate task, NOT a free rider on P0b).** `VideosPage.tsx` renders a raw `<img src={coverImageUrl(...)}>` — it does **not** use `SongThumbCard` or `CoverImage`. The original audit claimed P0 fixes the videos grid "in one pass"; that is false. Either migrate the videos thumb to `CoverImage` or apply `<ThumbShimmer>` directly here.
3. **P1 — Tracks page grid skeleton** (large JSON, high traffic). Uses `CoverImage` directly, so it inherits P0b once opted in.
4. **P1 — Home songbooks corner** (same pattern as lucky strip; renders `SongThumbCard`, inherits P0b).
5. **P2 — Discovery search slot skeleton** (header interaction).
6. **P2 — Navigation pending affordance** (stronger than the thin bar alone on slow chunk loads).

### Scope corrections (verified against source 2026-06-28)

- **Videos grid is not covered by the shared-component change.** Tracked as its own item (#2 above).
- **Sutra related grid is only *mostly* covered.** `SutraDetailPage.tsx` renders related songs via `SongThumbCard` (≈ line 502) **but also has a raw `<img>` (≈ line 684)** outside the component. Migrate that stray `<img>` to `CoverImage`/`<ThumbShimmer>` or the page will still pop blank squares.
- **Direct `CoverImage` consumers** (inherit P0b automatically once shimmer is opt-in and enabled): `TracksPage.tsx`, `SongDetailAlsoPartOfCard.tsx`, `playerQueue/playableTrackAdapters.ts`. Audit each — you may not *want* shimmer in the player-queue adapter.

### `CoverImage` gotchas — do not treat as a plain wrapper

`CoverImage` is harder to shim than `HomePortalCoverStrip`'s `LuckyCoverThumb`. Two traps:

1. **It has an `onError` fallback chain that swaps `src`** (maxres → fallback). The lucky strip just sets `loaded = true` on error and stops. If you copy that, the shimmer disappears the instant the primary 404s — *before* the fallback finishes loading — leaving a blank on exactly the slow/broken case you're targeting. The load-state must **persist the shimmer across the fallback swap** and only clear on the *successful* `onLoad`, or on terminal failure (no further fallback) where you should show the existing `♪` fallback tile, not an infinite shimmer.
2. **It returns a bare `<img>` with no wrapper element.** A shimmer overlay needs a positioned parent, so wrapping changes the DOM for every consumer and can shift layout/CSS (`TracksPage`, `SongDetailAlsoPartOfCard`, the player-queue adapter). Make shimmer **strictly opt-in** via a prop (e.g. `showShimmer`, default `false`) so currently-fine surfaces don't regress. Mirror the lucky strip's cached-image handling: check `img.complete && img.naturalWidth > 0` on mount so already-cached covers never flash a shimmer.

### Definition of Done (replaces the CSV's "TBD, by visual QA on live")

- One shimmer keyframe + token in the codebase; the three former keyframes deleted or aliased to it (`grep -c "@keyframes.*shimmer"` → 1).
- Shimmer disabled under `prefers-reduced-motion: reduce` (static fill, no pulse).
- No blank squares on first paint at Slow 3G across: home latest drops, home songbooks corner, sutra related, songbook detail, tracks grid, videos grid.
- Cached covers (second visit) show **no** shimmer flash.
- Broken/404 cover ends on the `♪` fallback tile, never an endless shimmer.

## Manual / visual QA recommendation (Banana)

Run after Cursor finishes, before merging staging → main. ~15 min.

### Setup
- Chrome DevTools → **Network** tab → throttle to **Slow 3G** (this is the whole point — at full speed you'll see nothing). Tick **Disable cache** for the first pass.
- DevTools → **⋮ → More tools → Rendering → Emulate `prefers-reduced-motion`** so you can toggle it without changing OS settings.
- Have the live/preview URL on a phone too — the thin nav bar and blank squares read worst on mobile.

### Consistency pass (the "every thumb shimmers the same way" goal)
Load each surface and watch the thumbs appear. They should all show the **same** shimmer — same speed, same direction, same color — not a mix:

- Home → latest drops, Feeling lucky strip, songbooks corner
- `/sutras/:slug` → related songs grid (watch for the stray `<img>` — if one square stays blank while siblings shimmer, the line-684 migration was missed)
- `/songbooks/:slug` → thumb list
- `/tracks` → cover grid
- `/videos` → thumb grid (separate task — verify it shimmers like the rest, not a leftover blank)
- `/listen` → drops grids

A good fast check: shimmer one screen, screenshot, shimmer another, compare side by side. Any difference in pulse speed/color = consolidation didn't fully land.

### Blank-square pass (the "kill the worst moments" goal)
Same Slow 3G, watch the *gap* between layout and image:
- Every thumb should show a shimmer in the empty square — **never** an empty/white box that then snaps to an image.
- Let one fully load, then reload the page (cache now warm): cached covers should appear **instantly with no shimmer flash**. A flash on cached load = the `img.complete` check is missing.
- Find a known-broken cover (or block a thumbnail URL in DevTools): it should end on the `♪` fallback tile, **not** shimmer forever.

### Reduced-motion pass (a11y — new in R73)
Toggle `prefers-reduced-motion: reduce` on, reload a heavy grid (`/tracks` or `/videos`): squares should show a **static** neutral fill while loading — no pulsing. If they still pulse, the primitive didn't gate the animation.

### Quick code sanity check (optional, 30 sec)
```
grep -rc "@keyframes.*shimmer" apps/banana-catalog-prototype/src   # expect total = 1
```
More than one keyframe means a copy-paste survived consolidation.

### What to log
For anything off, note surface + network speed + screenshot in the R73 row. "Looks fine on my laptop" isn't a pass — the throttle is doing the testing, not your eyes at full speed.

## Out of scope (performance, not perceived UX)

- Image byte size / CF transform widths (see `R71-PERF-AUDIT-HANDOFF.md` P0/P1 items).
- JSON deferral strategy on home (already split via `useHomeDeferredCatalog`).
- Server TTFB / CDN caching.

## R72 shipped in code (reference)

- **#150:** `HomePortalCoverStrip` per-tile shimmer + fade-in on load/reload.
- **#151:** `lazyWithRetry`, staged route fallback copy, softer error fallback after retries exhausted.
