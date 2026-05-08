# YouTube → Airtable Pipeline

Scrapes your full YouTube channel via API, reconciles against Airtable, and
produces import-ready CSVs for both VIDEOS and PLAYLISTS.

Full workflow (dos / don'ts, what-if scenarios, Airtable column renames):
see `_docs/runbooks/YT-PIPELINE-WORKFLOW.md`.

## Folder layout

```
pipelines/yt/
├── README.md                     (this file)
├── 1_extract.py                  CORE step 1 — scrape YouTube API
├── build_yt_final.py             CORE step 2 — reconcile videos
├── build_playlists_final.py      CORE step 3 — publish playlists
├── name_mapping.csv              raw YouTube title → cleaned playlist name
├── raw/                          scraper outputs (inputs to build scripts)
├── outputs/                      final Airtable-import CSVs + QA reports
│   └── archive/<YYYY-MM-DD>/     dated historical copies
└── _legacy/                      retired one-off scripts (do not run)
```

## Setup

```bash
pip install requests python-dotenv rapidfuzz
cp .env.example .env
# Fill in YOUTUBE_API_KEY and YOUTUBE_CHANNEL_ID in .env
```

## Run

**Step 1 — Extract (only when you want a fresh scrape):**
```bash
python3 1_extract.py
```
Writes `raw/yt_videos_raw.csv`, `raw/yt_playlists_raw.csv`, `raw/yt_raw_backup.json`.
Playlist names are auto-cleaned via `name_mapping.csv`.

**Step 2 — Reconcile videos (every build):**
```bash
python3 build_yt_final.py
```
Merges fresh scrape + latest Airtable snapshot + LYRICS into
`outputs/AT-VIDEOS-final.csv` (import-ready).

Writes QA files alongside:
- `YT-NEW-VIDEOS-QA.csv` — new videos + fuzzy-matched lyrics_id candidates
- `YT-LYRICS-ID-DRIFT.csv` — existing assignments whose title fuzz-fails
- `YT-DROPPED-VIDEOS.csv` — videos in snapshot but missing from scrape
- `YT-SYNC-REPORT.csv` — one-row build summary

**Step 3 — Publish playlists (every build):**
```bash
python3 build_playlists_final.py
```
Reads latest Airtable YTplaylists snapshot, renames `linked_sutra` → `sutra`,
writes `outputs/AT-PLAYLISTS-final.csv`.

## Import into Airtable

One-time before first import (if needed): in Airtable, rename
`linked_sutra` → `sutra` (PLAYLISTS). Then import the two
`outputs/AT-*-final.csv` files, matching on `video_id` and `playlist_id`
respectively.

## Field ownership

| Field family | Where it comes from |
|---|---|
| `lyrics_title`, `sutra` | **Inherited from LYRICS** via `lyrics_id` (authoritative) |
| `lyrics_id`, `format`, `rating`, `genre_*`, `instruments`, `content_type`, `series_info`, `language`, `has_manual_caption`, `manual_notes`, `ytvideo_in_app`, `status`, `notes` | **Preserved from Airtable snapshot** (curator-owned) |
| `title`, `yt_url`, `publish_date`, `duration`, counts, `thumbnail_url`, `description`, `yt_tags`, `topic_categories`, `playlist_names`, `playlist_count`, `has_captions`, `privacy_status`, `embeddable`, `license`, `made_for_kids` | **Refreshed from scrape** every build |

See `_docs/runbooks/YT-PIPELINE-WORKFLOW.md` § 3 for the full contract and § 5 for
why LYRICS is source of truth for `sutra`.
