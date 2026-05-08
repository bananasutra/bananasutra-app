# SoundCloud → Airtable Pipeline

Scrapes the full `soundcloud.com/bananasutra` catalog, reconciles against
the Airtable snapshot, and produces import-ready CSVs for TRACKs, EPs, and
PLAYLISTs.

Full workflow (dos / don'ts, what-if scenarios, two-pass QA):
see `_docs/SC-PIPELINE-WORKFLOW.md`.

## Folder layout

```
pipelines/sc/
├── README.md                     (this file)
├── bananasutra_sc_export.py      CORE step 1 — scrape SoundCloud
├── build_sc_final_v4.py          CORE step 2 — reconcile + publish
├── raw/                          scraper outputs (inputs to build script)
├── outputs/                      final Airtable-import CSVs + QA reports
│   └── archive/<YYYY-MM-DD>/     dated historical copies
└── _legacy/                      retired one-off scripts (do not run)
```

## Setup

```bash
pip install requests rapidfuzz python-dateutil
```

The OAuth token is hardcoded near the top of `bananasutra_sc_export.py`.
SoundCloud invalidates it every few weeks. When the scraper returns 401s,
refresh the token following the comments in that file.

## Run

**Step 1 — Scrape (roughly every week, or when new uploads exist):**

```bash
python3 bananasutra_sc_export.py
```

Writes `raw/bananasutra_sc_export.csv` plus a dated backup. The scraper
writes a checkpoint to `raw/sc_checkpoint.json` so interrupted runs resume.
Takes about ten minutes for the full catalog.

**Step 2 — Build (every time a fresh scrape or Airtable snapshot lands):**

```bash
python3 build_sc_final_v4.py
```

Merges the fresh scrape with the latest canonicalized Airtable snapshot
(LYRICS, SC TRACKs, SC EPs, SC Playlists all read from
`AIRTABLE/snapshots/<latest>/clean/`) into three import CSVs in `outputs/`:

- `AT-TRACKS-v4.csv`
- `AT-EPS-v4.csv`
- `AT-PLAYLISTS-v4.csv`

Writes QA + diagnostic files alongside:

- `SC-NEW-TRACKS-QA.csv` — new tracks with fuzzy-matched lyrics_id candidates
- `SC-SYNC-REPORT.csv` — one-row build summary + drift flags
- `LYRICS-BELOW-FILTER.csv` — lyrics with no filter-passing SC track

Every file also gets written to `outputs/archive/<YYYY-MM-DD>/` as a dated copy.

If `SC-NEW-TRACKS-QA.csv` has rows in `LOW` or `MEDIUM` confidence, fill in
the `CORRECT_LYRICS_ID` column and re-run the builder. Iterate until every
new track sits in `HIGH` or `CORRECTED`.

## Import into Airtable

Import the three `outputs/AT-*-v4.csv` files into their respective Airtable
tables, upsert-matching on `track_id`, `ep_url`, and `playlist_url`.
Existing rows update in place, new rows insert.

## Field ownership

| Field family | Where it comes from |
|---|---|
| `lyrics_title`, `sutra` | **Inherited from LYRICS** via `lyrics_id` (authoritative) |
| `lyrics_id` | **Preserved from Airtable snapshot** for confirmed tracks; fuzzy-resolved for new tracks, with human confirmation via the QA file |
| `track_title`, `sc_url`, `duration`, `play_count`, `like_count`, `repost_count`, `comment_count`, `created_at`, `bpm`, `artwork_url`, `waveform_url`, `soundcloud_genre`, `tags`, `description`, `license`, `track_type`, `purchase_url`, `download_url` | **Refreshed from scrape** every build |
| `ep_title`, `ep_url`, `ep_track_number`, `ep_total_tracks`, `playlist_names_clean`, `playlist_count` | **Derived** from the scrape + playlist reconciliation pass |
| `genres`, `instruments` | **Preserved from Airtable snapshot** (curator-owned) |

See `_docs/SC-PIPELINE-WORKFLOW.md` §3 for the hardcoded contracts and §5
for the dos and don'ts.

## Differences from the YT pipeline

SoundCloud has three tiers (tracks live inside EPs, which live inside
playlists). YouTube has two (videos, playlists). The SC build therefore
produces three Airtable CSVs instead of two, and the EP table carries its
own `lyrics_id` link because EPs are treated as first-class curated objects.

The SC scraper uses OAuth instead of an API key and is rate-limit-friendly
by default. There is no `.env` file to populate.
