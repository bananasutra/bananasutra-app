# What Strangers Reach For — Meaning-First Resonance Analysis
**External playlist adds × lyrics taxonomy × track metadata**
Generated 2026-07-14 · companion to `external_playlist_signal` workbook (curator-focused analysis, 2026-07-11)

---

## 1. What was read (full transparency)

- **All 3,449 rows** of `All External Adds (Full Data).csv` — parsed in full, no truncation.
- **All 747 rows** of `SC TRACKs-2026-07-11.csv` and **all 426 rows** of `SONGS (Lyrics)-2026-07-11.csv` — parsed in full.
- **Not read:** the lyric *text* itself. This analysis uses your taxonomy fields only (sutra, songbook, light/shadow, topic, intention, genre, mood, tempo, instruments). No close reading of lyric content was performed — worth remembering when interpreting "theme" findings.
- Reproducible script: `resonance_analysis.py` (same folder).

## 2. Method

**Scope decision (per your call):** analysis runs on **deliberate picks only** — the 2,055 rows left after excluding the 3 Catalog Mirror superfans (1,146 rows, they mirrored everything, so they carry no song-preference signal) and Generic Dumps (248 rows).

**Joins:** adds → SC TRACKs by normalized track title (the Link columns flattened to "open" in the CSV export, so URL joins were impossible); SC TRACKs → SONGS by `lyrics_id` (747/747 clean).
- 1,729 of 2,055 deliberate rows joined (84.1%). The 326 unjoined are almost all `In Catalog? = No` (323/326) — tracks no longer in the Airtable snapshot. **Findings describe the joined 84%.**
- The 747 catalog tracks map to **200 distinct songs**; **168 of them (84%) received at least one deliberate external add.** Breadth, not a hit-or-nothing distribution.

**Metric:** *lift* = share of adds ÷ share of the library baseline. Lift 1.0 = people pick it exactly as often as you make it. Lift 2.0 = twice as often. This controls for the fact that you simply wrote more of some things.

**Robustness:** every headline finding below was re-run on **1,321 deduplicated curator–song pairs** (so a curator adding 6 versions of one song counts once) against a song-level baseline. Lifts held or strengthened. Key z-scores are 6σ+.

## 3. Headline findings (deduped curator–song lifts)

### Topics — what over/under-indexes
| Topic | Lift | Reading |
|---|---|---|
| **EGO** | **2.03** | The single strongest topic signal in the dataset |
| **TRUTH** | **1.53** | |
| PEACE | 1.19 | Your KNOWsutra-PEACE hunch: confirmed, but modest |
| WISDOM | 1.12 | |
| BEAUTY | 0.95 | Picked at library rate |
| RELIGION | 0.85 | |
| INJUSTICE | 0.86 | |
| **POOLITICS** | **0.64** | Under-indexes hard |
| **FOOLERY** | **0.51** | Weakest topic |

### Intentions
| Intention | Lift |
|---|---|
| **beFOOL** | **2.04** |
| seeEGO | 1.49 |
| seeHIStory | 1.45 |
| beWISE | 1.38 |
| beCURIOUS | 1.31 |
| beSILLY | 0.94 |
| beKIND | 0.81 |
| **beWOKE** | **0.59** |

**The Fool paradox:** intention *beFOOL* lifts 2.04 while topic *FOOLERY* sinks to 0.51. People reach for the fool-as-truth-teller (the one who tells the king he's naked) and skip the clowning. Consistent with "The Great Naked King" (topic EGO) at #3 overall.

**The woke/curious split:** *beWOKE* (0.59) and *POOLITICS* (0.64) under-index while *beCURIOUS*, *beWISE*, *seeEGO*, *seeHIStory* all over-index. Pattern: people don't reach for songs that tell them what to think; they reach for songs that ask.

### Sutras
KNOWsutra 1.34 (the asking sutra — your PEACE observation sits inside this), BOWsutra 1.30 (mortality over-indexes!), GLOWsutra & SHOWsutra ~1.1, GROW/BLOW/FLOW ~0.9–1.0, **QUACKsutra 0.50** (pure satire is the weakest sutra by far).

### Songbooks (top lifts, ≥30 adds)
Ask: (Naked) TRUTH **2.05** · Bow: Cosmic Bananas **2.00** · Play: (Be) The Fool 1.54 · Speak: EGO (gone loco) 1.31 · Bless: RAINBOWS 1.27 · Ask: BERTRAND 1.25 · Ask: PEACE (not war) 1.21. Weakest: Play: FANANA (party) 0.77.

### Light / Shadow
**Near-perfect parity** — LIGHT 1.02, SHADOW 0.97. Strangers take the dark with the light at exactly the rate you offer it. No toxic-positivity filter, no doom bias.

### Sound (track level, adds baseline)
- Genres: **BLUES 1.38 · DUB 1.26 · LOFI 1.17** up; INDIE 0.78, BURLESQUE 0.82, ROCK 0.70, **FOLK 0.52, MANTRA 0.43** down.
- Moods: **KINDLY 1.24 · CHEEKY 1.23** up; TRIPPY 0.68, PUNKY 0.72, RAINY 0.77 down. Warmth-with-a-wink wins.
- Tempo: LOWBEAT is 76% of adds — but that mirrors the library (77%). No tempo preference; you're a slow-music artist and your audience is a slow-music audience.
- Instruments: flat (bass 1.08, guitar 1.12, cello 0.77 the only notable dip).

### Top 10 songs by distinct curators (deliberate picks)
| Song | Curators | Adds | Versions | Sutra · L/S · Topic |
|---|---|---|---|---|
| Tell The Truth | 57 | 89 | 5 | KNOW · LIGHT · TRUTH |
| Ego Ain't Your Amigo | 56 | 76 | 14 | BLOW · SHADOW · EGO |
| The Great Naked King | 49 | 80 | 14 | SHOW · SHADOW · EGO |
| Kiss A Pulse | 43 | 57 | 9 | GLOW · LIGHT · BEAUTY |
| It's An Ethical Paradox | 42 | 55 | 9 | KNOW · LIGHT · WISDOM |
| Zero Sum (Zero Sean) | 36 | 57 | 11 | GROW · SHADOW · INJUSTICE |
| A Letter To My Friend (Never Again) | 31 | 46 | 15 | KNOW · LIGHT · PEACE |
| So, What Is Racism? | 28 | 38 | 12 | KNOW · SHADOW · INJUSTICE |
| Spit Back the Lies | 28 | 34 | 8 | BLOW · SHADOW · INJUSTICE |
| Rainbows in the Clouds | 26 | 34 | 8 | GLOW · LIGHT · BEAUTY |

"Tell The Truth" is a monster outlier: 17.8 adds per version vs ~2.3 dataset average. Four of the top ten are KNOWsutra. Top three = Truth, Ego, Ego.

## 4. Honest caveats (use these in the essay, don't hide them)

1. **Exposure ↔ preference loop.** Distinct curators per song correlates 0.84 (log-log) with SoundCloud play counts. Playlist adds drive plays and plays drive adds; this data can't fully separate "what people love" from "what people found." Lift-vs-library mitigates but doesn't eliminate this.
2. **One artist, one platform.** This is a sample of *your* listeners on SoundCloud, not humanity. The claim "what people long for" is a lantern, not a telescope — frame it as such.
3. **Taxonomy is yours.** Topics/intentions are your own labels, applied by you. The analysis is internally consistent, but a skeptic would note the labeler and the songwriter are the same person.
4. **Curator clustering.** Repeat curators contribute multiple rows; the deduped curator-song check controls for the worst of it, but 1,171 curators are not 1,171 independent coin flips.

## 5. Pass 2 additions (2026-07-14): lyrics + EP engagement

**What was read in pass 2:** all 426 `lyrics_extract` and `lyrics_summary` fields in full (≈64K chars); full lyrics (complete text) for the top 15 songs by distinct curators: Tell The Truth, Ego Ain't Your Amigo, The Great Naked King, Kiss A Pulse, It's An Ethical Paradox, Zero Sum (Zero Sean), A Letter To My Friend, So What Is Racism?, Camus Dit Oui, Everybody Knows, The Atheist Tango, Broken Whole, We're Tiny Specks Right?, Win-Win After Midnight, Peace Matters More. Full lyrics of the remaining ~411 songs were NOT read (747K chars total) — extracts/summaries only.

**EP engagement ratings** now in `EP-engagement-ratings.csv` (all 251 EPs). Formula mirrors your track metric: `ep_engagement_rate = total_likes/total_plays × 100`, plus `plays_per_track` and `likes_per_track` to normalize for EP length. Independent triangulation: "Tell The Truth" is top-10 on BOTH plays-per-track (1,285) and engagement rate (1.64%) — the playlist finding isn't a playlist artifact. "It's An Ethical Paradox" (1,511 plays/track) and "Ego Ain't Your Amigo" (1,453) also confirm.

**Voice observations from the full read:**
- The catalog's thesis appears verbatim in its most-picked corner: *"Could the meaning we seek be in how we ask why?"* (Broken Whole, 21 curators).
- The top songs are structurally interrogative — So What Is Racism? and Everybody Knows are built almost entirely of questions; We're Tiny Specks Right? ends every line with "right?" until the questions dissolve into a care mantra. The lift data (beCURIOUS up, beWOKE down) matches the syntax: what over-performs literally asks, what under-performs asserts.
- "We're Tiny Specks, Right?" is a four-loop argument: wonder → cosmic indifference → agency ("So we can care… right?") → mantra ("Care… that's all"). Songwriting-as-meditation, exhibit A.
- The Fool paradox has its anthem line: *"Let's laugh out loud and break the ring, / And be the fool worth being"* (Naked King outro).
- Songwriting-as-practice is already self-documented in the catalog: *"Each song's a little atheist prayer"* / "Some people meditate. Some pray. I make songs. Same thing, different noise." (Making Songs Like...)

## 6. The one-line story

> Given a 200-song library where satire, politics and party tracks were on equal offer, ~1,100 strangers systematically over-selected songs about **truth-telling, ego-deflation, mortality, and asking better questions** — delivered slow, dubby, kindly and cheeky — and under-selected **partisan politics, preaching, and pure clowning**. And they took the shadow with the light, 43/57, exactly as offered.
