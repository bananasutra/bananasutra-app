# W-001 — Mobile playback spike (persistent iframe + `widget.load()`)

**Branch:** `feat/r50-spike-w001-mobile-playback` (throwaway — do **not** merge to `r50-overhaul`)  
**Work item:** W-001 in `airtable_work_items_v2.csv`  
**Gates:** R-002, D-004, D-021, P2 persistent player (W-022 / W-025)  
**Drawing-board handoff:** `_docs/planning/REDESIGN/REDESIGN-REEVALUATION-HANDOFF-2026-06-04.md` (local)

---

## A) Production baseline — current `/tracks` Play All (iframe remount)

**Observed on iPhone Safari, bananasutra.com `/tracks`, 2026-06-04:**

| Scenario | UI | Audio |
|----------|----|-------|
| Play All when nothing playing | Button → "Stop playing all" | No audio (confusing) |
| Play All when already playing | Next iframe loads | Track 2+ needs manual tap on SC embed play |

**Later confirmed:** **Desktop Play All on prod works fine** (bananasutra.com, remount code path).

**Code path (production / `r50-overhaul` / `main`):**

1. **`startPlayAll`** sets `playAllActive = true` immediately (UI claims "playing all" before SoundCloud confirms playback).
2. **`pickTrack`** sets `scAutoplay = true`, bumps **`embedReloadKey`**, updates **`selectedId`**.
3. **`SoundCloudEmbed`** remounts the iframe on every change:

```tsx
key={`${scUrl}::${reloadKey}::${autoPlay ? 'autoplay' : 'manual'}`}
src={soundcloudPlayerSrc(scUrl, mode, autoPlay, theme)}  // auto_play in URL
```

4. **`handlePlayerLoad`** re-binds `FINISH` on each new iframe after `onLoad`.
5. **`advanceToNextInQueue`** (on `FINISH`) calls **`pickTrack(next)`** → another full remount + new `auto_play=true` URL.

**Why this breaks on mobile (iOS Safari, prod):**

- Each track change **destroys and recreates** the cross-origin iframe. That breaks the **user-gesture chain** iOS requires for programmatic audio.
- `auto_play=true` in a **new** iframe `src` after `FINISH` is not treated as continuing the same gesture as the original "Play all" tap.
- UI sets **`playAllActive`** on button click, not on SC **`PLAY`** — so users see "Stop playing all" with silence.

**Conclusion (prod):** iframe remount + URL `auto_play` does **not** satisfy continuous Play All on **iOS**. Desktop remount path **does** work today.

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

**Spike limitations (why results are not architecture proof):**

- Initial iframe mounts with `auto_play=false`; relies on `widget.load({ auto_play: true })` without SC `READY` / load `callback` + `widget.play()`.
- [SoundCloud Widget API](https://developers.soundcloud.com/docs/api/html5-widget): `load()` **"reloads the iframe element"** — not a non-remount swap.
- Spike **failed on desktop too** while **prod desktop works** → spike implementation broken, not a clean A/B test.

**Not in scope on this branch:** App-root persistent player, route-change survival (test 2), `SongDetail.tsx`, mode toggle.

---

## C) Deploy / open on real devices

**Spike preview (deployment id, not git hash):** https://c366b783.bananasutra-redesign.pages.dev/tracks

**Production baseline:** https://bananasutra.com/tracks

**Staging (no spike):** https://stage.bananasutra.com/tracks

Cloudflare preview URLs use **deployment id** prefix (`c366b783`), not commit short hash.

---

## D) Device test matrix (completed 2026-06-04)

**Tester:** Banana

### Production (bananasutra.com) — authoritative for prod behavior

| # | Test | iOS Safari | Android Chrome | Desktop | Notes |
|---|------|------------|----------------|---------|-------|
| 1 | `/tracks` Play All auto-advance | ☑ FAIL | ☐ not tested | ☑ PASS | iOS prod confirmed; desktop prod confirmed |
| 7 | Songbook SC playlist | ☑ PASS | ☑ PASS | (assumed OK) | Continuous play; **survives screen off/lock** |

### Spike URL only — inconclusive for `widget.load()` architecture

| # | Test | iOS | Android | Desktop | Notes |
|---|------|-----|---------|---------|-------|
| 1 | `/tracks` Play All | ☑ FAIL | ☑ FAIL | ☑ FAIL | Broken on all platforms; likely spike bugs + `load()` reloads iframe |
| 2–6 | Route change, bfcache, lock, background, LPM | — | — | — | Not run; moot for spike merge |

**Success bar (original GO):** Test 1 PASS on iOS + Android on a **validated** persistent-player build. **Not met.**

---

## E) Go / no-go for P2 persistent player (D-021)

**Status:** ☑ **NO-GO** for merging this spike and for **D-004 as the mobile custom-queue fix**

| Verdict | When | P2 implication |
|---------|------|----------------|
| **GO** | Test 1 passes iOS + Android on validated build | Proceed with app-root persistent player (W-022) |
| **PARTIAL** | In-session only; fails route/background | Fork B + honest UX |
| **NO-GO** | Custom mobile queue not solved | Do not merge spike; reopen D-004 |

### Decision record

```
Verdict: NO-GO (spike merge + D-004 mobile custom-queue bet)
Date: 2026-06-04

Production evidence:
  Test 1 iOS (bananasutra.com, remount): FAIL
  Test 1 desktop (bananasutra.com, remount): PASS
  Test 1 Android prod: NOT TESTED
  Test 7 songbooks (iOS + Android): PASS — continuous play including screen off/lock

Spike evidence (c366b783…):
  Test 1 all platforms: FAIL — inconclusive for architecture; spike impl broken (desktop prod works)

Do not merge feat/r50-spike-w001-mobile-playback to r50-overhaul.

Strategic direction (see REDESIGN-REEVALUATION-HANDOFF-2026-06-04.md):
  → Mobile continuous listen: songbooks / SC playlist embeds (D-020), device-proven
  → /tracks Play All: desktop-first; honest mobile UX (D-021); not sound-forward backbone
  → P2 persistent player: reopen — desktop cross-route queue only if still desired
  → P6 native audio: path to custom mobile queue if non-negotiable
  → D-004, D-019: flag for explicit reopen in drawing board
```

### Honest limits (device-validated)

- **Custom `/tracks` Play All on iOS (prod remount):** broken.
- **Custom `/tracks` Play All on desktop (prod remount):** works today.
- **`widget.load()` spike:** do not treat as proof; failed everywhere including desktop.
- **Songbook SC playlist embeds:** reliable on mobile; better than spec assumed (screen off/lock).
- **Android prod `/tracks` Play All:** still worth one test on bananasutra.com.

---

## Revert / cleanup

Do not merge this branch to `r50-overhaul`. Production unchanged on `main` / `r50-overhaul`. Drawing board paused implementation per handoff doc.
