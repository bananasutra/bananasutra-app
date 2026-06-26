# R71 — Performance & Perceived-Speed Audit: Cursor Handoff

> **Scope:** Fine-grained, targeted improvement opportunities identified from a full read of the source tree post-R70.  
> **Format:** Prioritized recommendations for Cursor (code) and Banana (admin/data). Each item names the exact file and the specific change. Rationale explains _why_.  
> **Non-negotiables preserved:** image crispness, accessibility scores, existing CF-bypass logic for SoundCloud/YouTube (that saga is documented and intentional).

---

## Executive Summary

The site architecture is solid. The build pipeline (prerender → critical CSS inline → route CSS injection → immutable chunk URLs) is well-considered. The issues below are real but fine-grained — none require an architectural overhaul.

**Root causes of the 10-second loading bar and chunky image UX:**

1. **Two large JSON blobs (~655 KB raw) are statically imported into the HomePortal lazy chunk**, forcing JS-parser overhead (slower than `JSON.parse`) on every home page activation.
2. **No `<link rel="preconnect">` for third-party origins** (YouTube, SoundCloud, GTM) means cold TCP+TLS handshakes on first embed or analytics event.
3. **`_headers` has no explicit `Cache-Control` rules** for `/assets/`, `/catalog-data/`, or `/fonts/`. Cloudflare Pages defaults are fine but not optimal; browsers don't get the `immutable` signal for content-hashed assets.
4. **YouTube thumbnail images bypass Cloudflare Image Transforms and are served at 1280 px** regardless of display size (this was the right call to avoid CF cold-cache latency, but a size-appropriate fallback for small slots exists).
5. **TracksPage thumbnail `<img>` tags have no `width`/`height` attributes**, causing Cumulative Layout Shift on every row render.
6. **Image loading order feels random** because all cards default to `loading="lazy"` with no above-fold priority hint.
7. **LazySoundCloudEmbed placeholder is plain text** with zero visual affordance — nothing tells the user anything is coming.

---

## P0 — Critical (each one alone meaningfully reduces perceived load time)

### P0-A: Convert HomePortal static JSON imports to runtime fetches

**Files:** `src/catalog/HomePortal.tsx`, `src/catalog/homePortalData.ts`

**Problem:**  
`HomePortal.tsx` statically imports two large JSON files:
```ts
import songCatalogBrowseJson from '../data/generated/song_catalog_browse.json'  // 540 KB raw → 442 KB as JS chunk
import songbookCatalogJson from '../data/generated/songbook_catalog.json'        // 272 KB raw → 213 KB as JS chunk
```
And `homePortalData.ts` also imports `song_catalog_browse.json` directly.

Because these are static ES module imports, Vite splits them into separate chunks (`song_catalog_browse-*.js` and `songbook_catalog-*.js`), but they still **must be downloaded and JS-parsed** (not `JSON.parse`'d — JS is slower) before HomePortal can render. Combined that's ~655 KB raw / ~123 KB gzip, all blocking home page first paint.

These same files already exist at `/catalog-data/` as plain JSON, served through the `fetchCatalogData` mechanism used by every other page. Home page is the odd one out.

**Fix:**  
Replace the static imports with the existing `useSongCatalogBrowse()` and a new `useSongbookCatalog()` hook (pattern already exists in `generatedData.ts` for every other data type). Pass loading state down to the sections that need it.

Concretely:
- In `homePortalData.ts`: remove the static `import songCatalogBrowseJson` line. Replace `const HOME_BROWSE = songCatalogBrowseJson as SongCatalogItem[]` with a parameter passed in from the hook.
- In `HomePortal.tsx`: replace the two static imports with `useSongCatalogBrowse()` and `useSongbookCatalog()` (add the latter to `generatedData.ts` — identical pattern to `useMusesCatalog()`).
- Sections that previously used the sync data (`latestSongs`, `sutraSongCounts`, `songbookCornerCards`) show `null`/skeleton state until the fetch resolves. The fetches are fast (540 KB gzip ~80 KB), cached after first load, and the fallback loader in `catalogDataUrl.ts` ensures resilience.

**Expected gain:** Home page first-paint loses ~123 KB of required JS-parse weight. The loading bar on initial visit should drop noticeably. On repeat visits (warm cache), effectively zero cost.

**Scalability note:** This is the right long-term architecture too — as the catalog grows these files will only get larger. Fetching JSON at runtime and caching in the module-level promise means the app stays fast regardless of catalog size.

---

### P0-B: Add `<link rel="preconnect">` for all third-party origins

**File:** `index.html` (in `<head>`, before the font preloads)

**Problem:**  
YouTube embeds, SoundCloud embeds, and Google Analytics all require connections to external origins. Without preconnect hints, the browser has to do DNS lookup + TCP + TLS from scratch the first time any of these loads. That's 300–800 ms of cold latency per origin on a typical connection. The "black rectangle" between clicking a YouTube facade and seeing the player start is largely this cold-connection cost.

**Fix:** Add these four lines immediately before the font `<link rel="preload">` lines in `index.html`:

```html
<link rel="preconnect" href="https://www.youtube-nocookie.com">
<link rel="preconnect" href="https://i.ytimg.com">
<link rel="preconnect" href="https://w.soundcloud.com">
<link rel="preconnect" href="https://www.googletagmanager.com">
```

`dns-prefetch` as fallback for older browsers (optional, add if you want belt-and-suspenders):
```html
<link rel="dns-prefetch" href="https://www.youtube-nocookie.com">
<link rel="dns-prefetch" href="https://i.ytimg.com">
<link rel="dns-prefetch" href="https://w.soundcloud.com">
```

These hints fire immediately on page load. By the time any user clicks a YouTube facade or the SoundCloud player tries to load, the TCP connection is already warm. This typically saves 300–600 ms per embed on the first interaction.

**Note:** Preconnect hints are safe — they don't load any third-party JS, they just warm the connection.

---

### P0-C: Add `Cache-Control` headers in `public/_headers` for hashed assets and catalog data

**File:** `public/_headers`

**Problem:**  
The current `_headers` file has only `X-Robots-Tag` rules. Cloudflare Pages does apply default caching, but without an explicit `Cache-Control: public, max-age=31536000, immutable` on content-hashed assets (`/assets/*`), browsers may revalidate on every navigation rather than serving from memory cache. Without explicit long-term headers on `/catalog-data/*.json`, browsers make conditional requests on repeat visits even when nothing changed.

**Fix:** Replace `public/_headers` content with:

```
/*
  X-Robots-Tag: noindex, nofollow

/feed.xml
  Content-Type: application/atom+xml; charset=utf-8

/llms.txt
  Content-Type: text/plain; charset=utf-8

/assets/*
  Cache-Control: public, max-age=31536000, immutable

/fonts/*
  Cache-Control: public, max-age=31536000, immutable

/catalog-data/*.json
  Cache-Control: public, max-age=3600, stale-while-revalidate=86400

/*.html
  Cache-Control: public, max-age=0, must-revalidate

/catalog-data/song_detail.json
  Cache-Control: public, max-age=86400, stale-while-revalidate=604800
```

**Rationale for each rule:**
- `/assets/*` and `/fonts/*` get `immutable` because Vite content-hashes every filename. The file literally cannot change without a new URL. Browsers can skip revalidation entirely.
- `/catalog-data/*.json` gets 1-hour fresh + 24-hour stale-while-revalidate so repeat visitors see data immediately while Cloudflare revalidates in the background.
- `song_detail.json` (3.1 MB, rarely changes) gets a longer 1-day fresh cache — it's the biggest single fetch in the app and pays the highest dividend from caching.
- `/*.html` stays `must-revalidate` so the prerendered HTML always reflects the latest deploy.

**Admin note for Banana:** These rules deploy automatically with the next build push to Cloudflare Pages. No manual Cloudflare dashboard action needed — `public/_headers` is how Cloudflare Pages applies per-path headers.

---

## P1 — High Impact (each worth doing in the same sprint)

### P1-A: Fix TracksPage thumbnail CLS (missing width/height/decoding)

**File:** `src/catalog/TracksPage.tsx`, line ~885

**Problem:**  
```tsx
<img className="tracks-page__thumb" src={cover} alt="" loading="lazy" />
```
No `width`, `height`, or `decoding="async"`. The browser can't reserve space before the image loads → every image that loads causes a layout shift (CLS). Lighthouse flags this on both `/tracks` (desktop + mobile).

**Fix:**
```tsx
<img
  className="tracks-page__thumb"
  src={cover}
  alt=""
  width={200}
  height={200}
  loading="lazy"
  decoding="async"
/>
```

The `thumbSrc()` function already requests `t200x200` SoundCloud images. Match the HTML dimensions to the image size. The CSS can still constrain the display size, but the browser needs explicit dimensions to prevent layout shift.

---

### P1-B: Add `loading="eager"` / `fetchPriority="high"` for above-fold image grids

**Files:** `src/catalog/HomeLatestDropsSection` (via `HomeNowPlayingSection.tsx`), `src/catalog/HomeSongbooksCorner.tsx`, wherever `SongThumbCard` is used for the first 4 grid items

**Problem:**  
All `SongThumbCard` components default to `loading="lazy"`. Cards in the initial viewport (above the fold) still load lazily, which means the browser starts fetching them late — after it's already parsed the full DOM. This is why the "feeling lucky" strip and the latest drops grid images load in a seemingly random order: they're all competing at the same lazy-load priority.

**Fix pattern:**  
`SongThumbCard` already accepts a `loading` prop. Pass `loading="eager"` to the first N cards in every grid that renders above the fold:

```tsx
// HomeLatestDropsSection — first 2 cards are always above fold
{songs.map((song, i) => (
  <SongThumbCard
    key={song.url_slug}
    loading={i < 2 ? 'eager' : 'lazy'}
    fetchPriority={i === 0 ? 'high' : undefined}  // add fetchPriority prop to SongThumbCard
    {...rest}
  />
))}
```

Add `fetchPriority?: 'high' | 'low' | 'auto'` to `SongThumbCardProps` and thread it through to the `CoverImage` component's `<img>` tag.

Also: in `HomePortalCoverStrip.tsx`, the first 3–4 tiles of the "Feeling lucky" strip are above the fold on most devices. Change the first 4 to `loading="eager"`:
```tsx
<img
  ...
  loading={index < 4 ? 'eager' : 'lazy'}
  fetchPriority={index === 0 ? 'high' : undefined}
/>
```

This tells the browser to prioritize these images in the network queue and prevents the "random order" loading effect — the browser loads visible images first, deferred images later.

---

### P1-C: Add visual skeleton / loading state for LazySoundCloudEmbed

**File:** `src/catalog/LazySoundCloudEmbed.tsx`, `src/catalog/LazySoundCloudEmbed.css`

**Problem:**  
When `activation === 'near_viewport_or_idle'` and the embed hasn't fired yet, the placeholder renders as plain text: `"SoundCloud playlist (loads when in view)"`. There's no visual indication anything is actually there. For `interaction_or_autoplay` mode, it says `"SoundCloud playlist (tap to load player)"` — equally bare.

This is the same UX you already solved for the persistent player (loading indicators). Apply the same logic here.

**Fix:**  
Replace the plain-text div with a styled skeleton:

```tsx
// In LazySoundCloudEmbed.tsx placeholder branch:
<div
  className="catalog-lazy-sc-embed__placeholder"
  style={{ minHeight: height }}
  aria-hidden
>
  <div className="catalog-lazy-sc-embed__skeleton">
    <div className="catalog-lazy-sc-embed__skeleton-art" />
    <div className="catalog-lazy-sc-embed__skeleton-lines">
      <div className="catalog-lazy-sc-embed__skeleton-line catalog-lazy-sc-embed__skeleton-line--title" />
      <div className="catalog-lazy-sc-embed__skeleton-line catalog-lazy-sc-embed__skeleton-line--meta" />
    </div>
  </div>
  {activation === 'interaction_or_autoplay' && (
    <div className="catalog-lazy-sc-embed__tap-hint" aria-hidden>
      Tap to load player
    </div>
  )}
</div>
```

Add CSS shimmer animation (same pattern as the persistent player loading ring). Use `--color-bg-panel` and `--color-border` tokens so it respects theme. This addresses the "nothing happening vs. something happening" perception gap directly.

---

### P1-D: Prefetch `/catalog-data/track_catalog.json` and `/catalog-data/youtube_by_lyrics_id.json` on home page idle

**File:** `src/catalog/HomePortal.tsx` or a new `useHomeCatalogPrefetch.ts`

**Problem:**  
The home page already uses `useHomeDeferredCatalog()` which starts fetching `track_catalog.json` (1.1 MB) and `youtube_by_lyrics_id.json` (524 KB) when the home component mounts. These fetches fund the "Top Tracks" and "Video Teaser" sections. But they're also the exact files that `/listen`, `/watch`, and `/tracks` pages need. If the user navigates from home to `/tracks`, the fetch initiated on home may already be complete (cache hit) — but only if the home page had enough time to finish the fetch.

More importantly, `/songs/` page fetches `song_catalog.json` (1.4 MB) — a big one that nothing on home prefetches. On first visit to any song page, users wait for a 1.4 MB download.

**Fix — two-part:**

1. The home page deferred catalog fetch (`useHomeDeferredCatalog`) already calls `fetchCatalogData`. These responses go into the browser cache. For `/tracks` navigation, this is already helping. No change needed here — confirm the behavior is working by checking cache hits in DevTools.

2. **Add an idle prefetch for `song_catalog_browse.json` on home.** After initial render settles (`requestIdleCallback`), kick off the `loadSongCatalogBrowse()` import (from `generatedData.ts`). Since browse is used by `/songs`, `/listen`, `/sutras`, etc., warming it on home idle means subsequent navigation to those pages finds the cache warm.

```ts
// In HomePortal.tsx, add to the component:
useEffect(() => {
  if ('requestIdleCallback' in window) {
    const id = window.requestIdleCallback(() => {
      void loadSongCatalogBrowse().catch(() => {/* silent */})
    }, { timeout: 3000 })
    return () => window.cancelIdleCallback(id)
  }
  const t = window.setTimeout(() => {
    void loadSongCatalogBrowse().catch(() => {/* silent */})
  }, 2000)
  return () => window.clearTimeout(t)
}, [])
```

This fires after first paint, doesn't compete with above-fold rendering, and means the `/songs` page first paint is instant for users who start at home.

---

### P1-E: Fix YouTube iframe `loading` attribute after facade release

**File:** `src/catalog/YouTubeEmbed.tsx`, line ~185

**Problem:**  
```tsx
<iframe
  ...
  loading={loading}  // inherits from prop, defaults to 'lazy'
  ...
/>
```
When a user clicks the facade to release the embed, the iframe mounts. But if `loading="lazy"` is still set at that point, some browsers may still defer the actual network request. The iframe is definitely in viewport when the user clicks the play button — lazy loading it makes no sense here.

**Fix:** After `facadeReleased === true`, always use `loading="eager"` regardless of the original prop:

```tsx
<iframe
  ...
  loading={facadeReleased ? 'eager' : loading}
  ...
/>
```

This ensures the YouTube player starts loading immediately on user click, not after a lazy-load decision the browser makes on its own.

---

### P1-F: YouTube poster image sizing for small display slots

**File:** `src/seo/imageUrl.ts`, `src/catalog/HomePortalCoverStrip.tsx`

**Problem:**  
`shouldBypassCfTransform()` returns `true` for all YouTube `maxresdefault` URLs, meaning every YouTube thumbnail is served at 1280 px regardless of the display slot. This was the right decision for embed facades (640 px posters, CF cold-cache latency was worse), but it's wrong for the "Feeling lucky" strip where thumbnails display at 80×80 px. The browser downloads 1280 px JPEGs and scales them down to 80 px — pure waste.

**Fix:** Add a `maxWidth` guard to the bypass logic so very small display sizes still get a CF-transformed or appropriately sized image:

In `imageUrl.ts`:
```ts
function shouldBypassCfTransform(source: string, requestedWidth?: number): boolean {
  const nativeMax = nativeImageMaxWidth(source)
  if (nativeMax == null) return false
  // Only bypass if the requested display size is close to the native size.
  // Below 200px requested, serve via CF transform or use a smaller YT tier.
  if (requestedWidth != null && requestedWidth < 200) return false
  return true
}
```

Then in `coverImageUrl`, thread `opts.width` into the bypass check:
```ts
if (shouldBypassCfTransform(normalized, opts.width)) return normalized
```

For 80 px thumbnails this would route through CF transforms instead of serving 1280 px images. If CF latency is still a concern for small sizes, use the YouTube `mqdefault` tier (320×180) as the source URL instead of upgrading to `maxresdefault` — `normalizeRemoteImageSource` could be made opt-in rather than always upgrading.

---

## P2 — Medium Impact (polish, CLS fixes, UX improvements)

### P2-A: Add `content-visibility: auto` to below-fold sections on heavy pages

**Files:** `src/catalog/WatchLpPage.css`, `src/catalog/TracksPage.css`, `src/catalog/HomePortal.css`

For long list/grid pages, `content-visibility: auto` on below-fold sections tells the browser to skip layout and paint calculation until the section scrolls near the viewport. This directly reduces the "forced reflow" Lighthouse flag on `/tracks` mobile.

```css
/* WatchLpPage.css — playlists grid is below fold */
.watch-lp__playlist-grid {
  content-visibility: auto;
  contain-intrinsic-size: auto 400px; /* estimate to prevent scroll jump */
}

/* TracksPage.css — track list items below first screen */
.tracks-page__list {
  content-visibility: auto;
  contain-intrinsic-size: auto 2000px;
}
```

Use with care — test that scroll position doesn't jump. `contain-intrinsic-size` is the estimated height to reserve before render.

---

### P2-B: WatchLpPage — show spotlight section while playlists load

**File:** `src/catalog/WatchLpPage.tsx`, around line 289–425

**Problem:**  
The page currently shows TWO separate "Loading videos…" / "Loading playlists…" text strings — one while videos load, one while playlists load. Both come from the same `Promise.all()` in `useEffect`. Users see a near-empty page for the full fetch duration.

**Fix:** Split the fetch so videos and playlists resolve independently:

```ts
// Instead of:
const [videosResult, playlistsResult] = await Promise.all([...])

// Do them independently:
flattenYoutubeCatalogVideos().then(result => {
  if (!cancelled) setYoutubeVideos(...)
})
fetchCatalogData(...youtube_playlists_catalog...).then(result => {
  if (!cancelled) setPlaylists(...)
})
```

The spotlight hero (videos) renders as soon as `youtubeVideos` resolves (~524 KB). The playlist grid renders slightly later (~21 KB). User sees content faster, in two waves rather than one all-or-nothing reveal.

---

### P2-C: Video facade poster should always use a `<picture>` element with explicit dimensions

**File:** `src/catalog/YouTubeEmbed.tsx` (facade branch), `src/catalog/WatchLpPlaylistEmbed.tsx`

**Problem:**  
The facade `<img>` for YouTube posters has no `width`/`height` attributes. The aspect-ratio wrapper prevents CLS for the player shell, but the poster image inside can shift if it loads slower than expected.

**Fix:** Add explicit dimensions to all facade poster images:

```tsx
// In YouTubeEmbed.tsx facade branch:
<img
  src={poster}
  alt=""
  className="yt-embed-facade__poster"
  decoding="async"
  loading={facadePosterEager ? 'eager' : 'lazy'}
  fetchPriority={facadePosterEager ? 'high' : undefined}
  width={posterWidth}
  height={Math.round(posterWidth * 9 / 16)}  // 16:9 aspect
/>
```

Same fix in `WatchLpPlaylistEmbed.tsx` playlist poster. The aspect ratio is always 16:9 for YouTube content.

---

### P2-D: NavigationLoadingBridge — shorten safety timeout from 12s to 6s

**File:** `src/NavigationLoadingBridge.tsx`, line 24

**Problem:**  
```ts
const id = window.setTimeout(() => setRoutePending(false), 12_000)
```
If a route chunk load stalls or fails, the loading bar stays for 12 full seconds before clearing. Users experience a "frozen" state. The 12-second value is generous but contributes to the perception that the bar is "stuck."

**Fix:** Reduce to 6 seconds, which is still more than enough for any chunk to load on a reasonable connection:
```ts
const id = window.setTimeout(() => setRoutePending(false), 6_000)
```

This doesn't make anything faster, but it makes "stuck" states recover twice as fast visually.

---

### P2-E: Add a loading spinner inside YouTube facade ring while iframe is loading

**File:** `src/catalog/YouTubeEmbed.tsx`, `src/catalog/CatalogVideoSpotlight.css` (or relevant CSS file)

**Problem:**  
After user clicks the facade, there's a gap: `facadeReleased=true`, but the iframe is loading and `iframeReady` is still false. During this window the poster is shown (`yt-embed-frame-host__poster`), but there's no indication that the user's click registered and loading is in progress. The "black rectangle" feeling lives here.

**Fix:** Show the existing `yt-embed-facade__ring` spinner overlay during `!iframeReady && facadeReleased`:

```tsx
// In the iframe host section (after facade release, before iframe ready):
<div className="yt-embed-frame-host">
  {!iframeReady && poster ? (
    <>
      <img src={poster} alt="" className="yt-embed-frame-host__poster" decoding="async" aria-hidden />
      <div className="yt-embed-frame-host__loading-ring" aria-label="Loading video…" role="status">
        <span className="yt-embed-facade__glyph yt-embed-facade__glyph--loading">⏳</span>
      </div>
    </>
  ) : null}
  <iframe ... />
</div>
```

Or reuse the existing ring CSS with a CSS animation class swap. The key is: user clicks → they see the poster stays + a spinner appears → iframe loads → spinner gone. Zero "did my click work?" anxiety.

---

### P2-F: `song_detail.json` (3.1 MB) — implement per-song data splitting (medium-term)

**This is a data architecture change — flag for a future release, not R71.**

**Problem:**  
`loadSongDetail()` in `generatedData.ts` fetches a single 3.1 MB JSON containing lyrics, detail blobs, and metadata for every song in the catalog. First visit to any song detail page downloads the full 3.1 MB. This will only grow.

**Recommended approach (Cursor + Banana):**

1. In `scripts/build_artifacts.py` (or a new script), split `song_detail.json` into per-song files: `dist/catalog-data/songs/{slug}.json`.
2. Update `loadSongDetail()` to accept a slug and fetch `/catalog-data/songs/{slug}.json` instead of the monolith.
3. The existing fallback mechanism in `catalogDataUrl.ts` handles the JS-bundled fallback already — extend it for the new pattern.

**Scalability win:** Each song detail page fetches ~4–8 KB instead of 3.1 MB. The overall catalog-data directory grows, but individual page loads become dramatically lighter.

**Migration note:** This is a breaking change to the data URL contract — needs coordinated build script + app code change in one release.

---

## P3 — Polish / Low Effort

### P3-A: Accessibility — GlobalHeader drawer `inert` attribute browser support note

**File:** `src/catalog/GlobalHeader.tsx`, line ~243

The current fix `{...(!menuOpen ? { inert: true as const } : {})}` is the right approach for hiding focusable descendants in the closed drawer. The `inert` attribute has good browser support (Chrome 102+, Firefox 112+, Safari 15.5+). However, Lighthouse may still flag `[aria-hidden="true"] elements contain focusable descendants` if any ancestor has `aria-hidden` without `inert`.

**Check:** Verify that the closed drawer's parent does NOT have `aria-hidden` set. If the `<nav>` itself uses `inert` (not `aria-hidden`), this should be clean. If Lighthouse is still flagging it, it may be the experience nav (`<nav className="global-header-experience">`) — ensure no `aria-hidden` is applied to it.

---

### P3-B: Add `decoding="async"` to any `<img>` still missing it

**Files:** Various — quick grep task

```bash
grep -rn "<img" src/catalog/ | grep -v 'decoding=' | grep -v '\.css'
```

Every `<img>` that doesn't have `decoding="async"` blocks the main thread for image decode. Any image not in the above-fold LCP path should have this attribute. Takes 5 minutes to add across the board.

---

### P3-C: TracksPage — add `srcSet` and `sizes` to track thumbnail images

**File:** `src/catalog/TracksPage.tsx`, line ~885

Currently uses `coverImageUrl(thumbSrc(t.list_cover_url), { width: 200 })` for a single src. SoundCloud images come in multiple sizes (`t200x200`, `t500x500`). Use `buildSrcset()` (already imported in `SongThumbCard.tsx`) to serve the right size per device:

```tsx
const cover = coverImageUrl(thumbSrc(t.list_cover_url), { width: 200 })
const coverSrcSet = buildSrcset(thumbSrc(t.list_cover_url, 'toriginal'), [100, 200])

<img
  className="tracks-page__thumb"
  src={cover}
  srcSet={coverSrcSet || undefined}
  sizes="48px"  // actual display size of the thumb in the row
  alt=""
  width={48}
  height={48}
  loading="lazy"
  decoding="async"
/>
```

---

### P3-D: `home_quotes.json` (34 KB) — convert to runtime fetch

**File:** `src/catalog/learnLpData.ts`, line 1

```ts
import homeQuotesJson from '../data/generated/home_quotes.json'
```

This is a static import into `learnLpData.ts` which is part of the `catalog-listen-lp-data` chunk (36 KB). The chunk is preloaded in `index.html`'s `<link rel="modulepreload">`, so it loads on every page whether the user visits `/learn` or not.

`home_quotes.json` is 34 KB. Since it's only needed on `/learn`, move it to a runtime fetch pattern consistent with everything else in `generatedData.ts`. Minor saving but eliminates dead weight from the global preload chain.

---

## Admin Tasks (Banana to execute — no code changes needed)

### Admin-1: Cloudflare — verify Image Transforms are enabled for `bananasutra.com`

The `coverImageUrl()` function generates `/cdn-cgi/image/...` URLs that rely on Cloudflare Image Transforms being active. If this feature isn't enabled on the Cloudflare plan, those URLs 404 silently and the app falls back to the original URL (via the `onError` handler in `CoverImage.tsx`). Verify in the Cloudflare dashboard under **Images → Transformations** that the feature is active.

### Admin-2: Cloudflare — check if `/catalog-data/*.json` files are being served with GZIP / Brotli

Cloudflare automatically compresses most file types, but verify JSON files are included. In the Cloudflare dashboard, **Speed → Optimization → Compression** — confirm Brotli is enabled. The `song_catalog.json` is 1.4 MB raw but ~275 KB gzip / ~200 KB Brotli. Brotli compression on the edge cuts transfer time by ~25% vs gzip at no code cost.

### Admin-3: GA4 — confirm `send_page_view: false` is intentional for all events

The GA4 config in `index.html` disables automatic page views (`send_page_view: false`). Verify that the manual `page_view` calls in `useAnalyticsPageView.ts` are firing correctly for all routes. If any routes are missed, the analytics picture is incomplete. This is not a performance issue but worth confirming since the deferred GTM load was already an optimization.

### Admin-4: Cloudflare Pages — confirm `_headers` rules deploy after next push

After implementing P0-C, verify the new cache rules are active by checking response headers for `/assets/index-*.js` in DevTools Network tab. You should see `cache-control: public, max-age=31536000, immutable`. If you see `max-age=0`, the Cloudflare Pages default is overriding — check for conflicting rules in the Cloudflare dashboard.

---

## Things NOT to Change (Anti-Patterns to Preserve)

These were deliberate decisions that look wrong at first glance but are correct:

**1. The `shouldBypassCfTransform()` logic for SoundCloud images.** SoundCloud CDN (`*.sndcdn.com`) already serves correctly-sized images. Running them through Cloudflare Image Transforms adds cold-cache latency with no quality benefit. The bypass is intentional.

**2. `<link rel="preload">` for fonts with NO media queries.** All four fonts are used on every page. Preloading them unconditionally is correct — don't move them behind media queries.

**3. The `NavigationLoadingBridge` using `click` not `pointerdown`.** This was deliberately chosen to avoid false triggers during scroll on mobile (pointerdown fires on scroll start). Don't change to pointerdown.

**4. `CATALOG_FETCH_CACHE: 'no-store'` in dev mode.** This prevents stale cached JSON from corrupting local dev sessions after port swaps. It only applies in dev. Leave it.

**5. The fallback loader chain in `catalogDataUrl.ts`.** The `fallbackCatalogLoaders` JS-bundle fallbacks exist for resilience when the static file server misbehaves. They are not supposed to be the primary path in production — but don't remove them.

**6. `loading="lazy"` on iframes as a baseline.** Even with the facade pattern, keeping `loading="lazy"` on `<SoundCloudEmbed>` iframes is correct for pages that render multiple embeds below fold (like songbook pages). Only change to `eager` after facade release (P1-E above).

**7. The prerender + inline-critical-CSS pipeline.** Beasties inlines critical CSS into every prerendered HTML page. The large `<style>` block in each HTML file is intentional — it prevents FOUC on first paint. Don't move this to an external stylesheet.

---

## Priority Order for Cursor Execution

If these are done one at a time, this is the recommended order by impact-to-effort ratio:

1. **P0-B** (preconnect hints) — 5 minutes, immediate perceived gain on video and audio
2. **P0-C** (`_headers` cache rules) — 10 minutes, benefits all repeat visitors
3. **P1-E** (YouTube iframe eager after release) — 5 minutes, reduces "black rectangle"
4. **P1-A** (TracksPage img dimensions) — 10 minutes, eliminates CLS
5. **P1-C** (LazySoundCloudEmbed skeleton) — 30 minutes, visual loading feedback
6. **P0-A** (HomePortal JSON static imports → fetch) — 1–2 hours, biggest first-paint win
7. **P1-B** (above-fold image priority) — 30 minutes, ordering fix
8. **P1-D** (idle prefetch on home) — 30 minutes, warm cache for navigation
9. **P2-B** (WatchLpPage split fetch) — 30 minutes, earlier content reveal
10. **P2-E** (YouTube loading spinner after click) — 30 minutes, removes click-anxiety
11. **P1-F** (YouTube poster sizing for small slots) — 45 minutes, bandwidth saving
12. **P2-C** (facade poster dimensions) — 15 minutes, CLS fix
13. **P2-D** (nav bar timeout 12s→6s) — 2 minutes
14. **P3-A through P3-D** — polish pass, batch together

---

_Audit completed 2026-06-26. Codebase state: post-R70. Next release: R71._
