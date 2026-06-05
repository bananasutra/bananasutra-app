# W-001 — Mobile playback spike (persistent iframe + `widget.load()`)

**Branch:** `feat/r50-spike-w001-mobile-playback` (throwaway — do **not** merge to `r50-overhaul` until go/no-go)  
**Work item:** W-001 in `airtable_work_items_v2.csv`  
**Gates:** R-002, D-004, D-021, P2 persistent player (W-022 / W-025)

---

## A) Production baseline — current `/tracks` Play All (iframe remount)

**Observed on iPhone Safari, bananasutra.com `/tracks`, 2026-06-04:**

| Scenario | UI | Audio |
|----------|----|-------|
| Play All when nothing playing | Button → "Stop playing all" | No audio (confusing) |
| Play All when already playing | Next iframe loads | Track 2+ needs manual tap on SC embed play |

**Code path (production / `r50-overhaul` before this spike):**

1. **`startPlayAll`** sets `playAllActive = true` immediately (UI claims "playing all" before SoundCloud confirms playback).
2. **`pickTrack`** sets `scAutoplay = true`, bumps **`embedReloadKey`**, updates **`selectedId`**.
3. **`SoundCloudEmbed`** remounts the iframe on every change:

```tsx
key={`${scUrl}::${reloadKey}::${autoPlay ? 'autoplay' : 'manual'}`}
src={soundcloudPlayerSrc(scUrl, mode, autoPlay, theme)}  // auto_play in URL
```

4. **`handlePlayerLoad`** re-binds `FINISH` on each new iframe after `onLoad`.
5. **`advanceToNextInQueue`** (on `FINISH`) calls **`pickTrack(next)`** → another full remount + new `auto_play=true` URL.

**Why this breaks on mobile (iOS Safari):**

- Each track change **destroys and recreates** the cross-origin iframe. That breaks the **user-gesture chain** iOS requires for programmatic audio.
- `auto_play=true` in a **new** iframe `src` after `FINISH` is not treated as continuing the same gesture as the original "Play all" tap.
- UI sets **`playAllActive`** on button click, not on SC **`PLAY`** — so users see "Stop playing all" with silence.

**Conclusion:** iframe remount + URL `auto_play` does **not** satisfy continuous Play All on iOS. D-004 bet must be validated with **`widget.load()` on one persistent iframe**.

---

## B) Spike implementation (this branch)

| File | Role |
|------|------|
| `PersistentSoundCloudIframe.tsx` | Single iframe; `loadTrack()` → `widget.load(url, { auto_play })` |
| `soundcloudWidgetApi.ts` | Typed `load()` on widget |
| `TracksPage.tsx` | Spike-only player + honest Play All UI |

**Behavior changes:**

- One iframe per session; queue advances call **`widget.load()`**, not `embedReloadKey` remount.
- **`playAllSession`** drives FINISH → advance; **`playAllUiActive`** only after SC **`PLAY`** (Stop button + honest state).
- **`scIsPlaying`** from widget PLAY/PAUSE (row wave animation).
- Yellow banner on `/tracks` labels the spike build.

**Not in scope on this branch:** App-root persistent player, route-change survival (test 2), `SongDetail.tsx`, mode toggle.

---

## C) Deploy / open on real devices

### Option 1 — Cloudflare Pages preview (recommended)

1. Push the spike branch:

```bash
git push -u origin feat/r50-spike-w001-mobile-playback
```

2. In Cloudflare dashboard → **bananasutra-redesign** (or your R50 Pages project) → **Deployments** → find the branch build.
3. Open the preview URL: `https://<commit-hash>.bananasutra-redesign.pages.dev/tracks`  
   (Also listed on the GitHub commit checks if Pages is connected.)

HTTPS + real network + screen lock behave like production.

### Option 2 — LAN Vite (same Wi‑Fi)

```bash
cd apps/banana-catalog-prototype
npm run dev -- --host
```

On phone: `http://<your-mac-lan-ip>:5173/tracks` (allow local network if prompted).

**Note:** Some iOS autoplay quirks differ on `http://` vs `https://`; prefer Cloudflare preview for the go/no-go call.

### Production comparison

- **Baseline:** https://bananasutra.com/tracks  
- **Spike:** preview URL above (not `stage.bananasutra.com` until merged)

---

## D) Device test matrix (fill in after testing)

**Tester:** _____________ **Date:** _____________  
**Spike URL:** _______________________________________________

| # | Test | iOS Safari (ver: ___) | Android Chrome (ver: ___) | Notes |
|---|------|------------------------|---------------------------|-------|
| 1 | Play All 5+ tracks on `/tracks` — track 2→3→4 auto-advance without extra tap? (screen ON, tab focused) | ☐ PASS ☐ FAIL | ☐ PASS ☐ FAIL | |
| 2 | Mid-queue navigate to `/songs/:slug` — audio continues? | ☐ PASS ☐ FAIL ☐ N/A | ☐ PASS ☐ FAIL ☐ N/A | Spike: **not implemented** — expect FAIL; document for P2 |
| 3 | Browser Back after #2 — bfcache behavior | | | |
| 4 | Lock screen 30s | | | Expect pause (platform limit) |
| 5 | Switch app 30s, return | | | |
| 6 | iOS Low Power Mode — repeat #1 | ☐ PASS ☐ FAIL | ☐ N/A | |
| 7 | Songbook SC playlist `/songbooks/:slug` vs custom Play All | | | SC-native baseline |

**Success bar (GO):** Test **1** PASS on both iOS Safari and Android Chrome (screen on, tab active). Test **2** PASS or documented workaround for P2.

---

## E) Go / no-go for P2 persistent player (D-021)

**Status:** ☐ **PENDING** (fill after matrix above)

| Verdict | When | P2 implication |
|---------|------|----------------|
| **GO** | Test 1 passes iOS + Android; test 2 passes or has clear P2 workaround | Proceed with App-root persistent player + `widget.load()` (W-022) |
| **PARTIAL** | Auto-advance in-session only; fails on route change / background | Ship with honest UX (D-021); fork B — session-bounded queue, not full R50 listen fork |
| **NO-GO** | `widget.load()` does not auto-advance on iOS without extra tap | Document hard limit; fork C or accelerate P6 native audio |

### Decision record (complete after device tests)

```
Verdict: GO | PARTIAL | NO-GO
Date:
Devices:
Test 1 iOS:
Test 1 Android:
Test 2:
Limits observed (lock screen, background, LPM):
Recommendation for fork A/B/C:
```

### Honest limits (always true per `CROSS-SONG-LISTENING-SPEC.md`)

- Lock screen and background tab **pause** iframe audio on iOS; persistent widget does not fix that.
- Low Power Mode may block autoplay more aggressively.
- Songbook **SC playlist embeds** remain the most reliable in-iframe continuity baseline (test 7).

---

## Revert / cleanup

Do not merge this branch to `r50-overhaul` without an explicit **GO**. To abandon: delete branch locally/remotely. Production `/tracks` unchanged on `main` / pre-spike `r50-overhaul`.
