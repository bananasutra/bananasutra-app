"""
build_yt_final.py  —  v1
Reconcile fresh YouTube scrape + Airtable YT VIDEOS snapshot + LYRICS into
an Airtable-import-ready CSV. Mirrors the pattern of build_sc_final_v4.py (SC side).

Inputs (auto-discovered):
  pipelines/yt/raw/yt_videos_raw.csv                 (fresh scrape from 1_extract.py)
  pipelines/yt/name_mapping.csv                      (raw playlist title → cleaned)
  AIRTABLE/snapshots/<latest>/YTvideos-<date>.csv    (current Airtable state)
  AIRTABLE/snapshots/<latest>/SONGS (Lyrics)-<date>.csv  (authoritative song meaning)

Outputs (all under pipelines/yt/outputs/):
  AT-VIDEOS-final.csv            — latest reconciled state, Airtable-import-ready
  YT-NEW-VIDEOS-QA.csv           — new videos with fuzzy-matched lyrics_id candidates
  YT-LYRICS-ID-DRIFT.csv         — existing assignments where title doesn't fuzzy-match
  YT-DROPPED-VIDEOS.csv          — videos in snapshot but not in fresh scrape
  YT-SYNC-REPORT.csv             — one-row summary
  archive/<YYYY-MM-DD>/          — dated archival copy of AT-VIDEOS-final.csv

Field-ownership contract:
  Inherited from LYRICS via lyrics_id:  lyrics_title, sutra
  Preserved from Airtable snapshot:     lyrics_id, format, rating, genre_primary,
                                        genre_secondary, instruments, has_manual_caption,
                                        manual_notes, ytvideo_in_app, status, notes,
                                        content_type, series_info, language
  Refreshed from fresh scrape:          title, yt_url, publish_date, duration,
                                        view_count, like_count, comment_count,
                                        thumbnail_url, description, yt_tags,
                                        topic_categories, playlist_names, playlist_count,
                                        has_captions, privacy_status, embeddable,
                                        license, made_for_kids

Run:
  pip install rapidfuzz
  python3 build_yt_final.py
"""
import csv
import re
import shutil
import sys
from datetime import date
from pathlib import Path

try:
    from rapidfuzz import fuzz, process
except ImportError:
    sys.exit("ERROR: pip install rapidfuzz")

# ── CONFIG ───────────────────────────────────────────────────────────────────
SCRIPT_DIR = Path(__file__).resolve().parent
REPO = SCRIPT_DIR.parent.parent
SNAPSHOTS = REPO / "AIRTABLE" / "snapshots"
RAW_FILE = SCRIPT_DIR / "raw" / "yt_videos_raw.csv"
NAME_MAP_FILE = SCRIPT_DIR / "name_mapping.csv"

OUT_DIR = SCRIPT_DIR / "outputs"
ARCHIVE_DIR = OUT_DIR / "archive"
OUT_FINAL = OUT_DIR / "AT-VIDEOS-final.csv"
OUT_NEW_QA = OUT_DIR / "YT-NEW-VIDEOS-QA.csv"
OUT_DRIFT = OUT_DIR / "YT-LYRICS-ID-DRIFT.csv"
OUT_DROPPED = OUT_DIR / "YT-DROPPED-VIDEOS.csv"
OUT_REPORT = OUT_DIR / "YT-SYNC-REPORT.csv"

HIGH_CONF = 85
MEDIUM_CONF = 70
# Drift flag: max of partial_ratio(video_title, lyrics_title) and
# partial_ratio(video_description, lyrics_title). Threshold deliberately
# conservative because many videos are skits/commentary that feature a song
# without naming it. Intentionally misses ambiguous cases so that flags that
# DO appear are worth opening; below 40 means the song title's characters are
# barely present in either the title or the description.
DRIFT_FLAG = 40
NON_SONG_TYPES = {"Commentary", "Short/Reel"}  # lyrics_id not expected

RUN_DATE = date.today().isoformat()

# ── FIELD CONTRACTS ──────────────────────────────────────────────────────────
PRESERVED_FROM_SNAPSHOT = [
    "lyrics_id", "format", "rating",
    "genre_primary", "genre_secondary", "instruments",
    "mood", "tempo_feel", "curation_rating",
    "has_manual_caption", "manual_notes",
    "ytvideo_in_app", "status", "notes",
    "content_type", "series_info", "language",
    "video_featured", "video_featured_description", "video_songbook",
]

REFRESHED_FROM_SCRAPE = [
    "title", "yt_url", "publish_date", "duration",
    "view_count", "like_count", "comment_count",
    "thumbnail_url", "description", "yt_tags", "topic_categories",
    "playlist_names", "playlist_count",
    "has_captions", "privacy_status", "embeddable", "license", "made_for_kids",
]

# Airtable import column order.
FINAL_FIELDS = [
    "title", "lyrics_title", "lyrics_id", "format", "rating", "duration",
    "topic_categories", "yt_url", "content_type",
    "genre_primary", "genre_secondary", "instruments", "sutra",
    "mood", "tempo_feel", "curation_rating",
    "has_manual_caption", "manual_notes",
    "publish_date", "view_count", "like_count", "comment_count",
    "thumbnail_url", "description", "yt_tags", "series_info", "language",
    "playlist_names", "playlist_count", "has_captions",
    "privacy_status", "embeddable", "license", "made_for_kids",
    "status", "notes", "video_id", "ytvideo_in_app",
    "video_featured", "video_featured_description", "video_songbook",
]


# ── HELPERS ──────────────────────────────────────────────────────────────────
def normlid(v):
    """Normalize lyrics_id to L-N (no zero padding)."""
    v = (v or "").strip()
    if v.startswith("L-"):
        try:
            return f"L-{int(v[2:])}"
        except ValueError:
            return v
    return v


def load_csv(path):
    with open(path, encoding="utf-8-sig") as f:
        return [
            {k.lstrip("\ufeff"): v for k, v in r.items()}
            for r in csv.DictReader(f)
        ]


def pick_latest_snapshot():
    dated = sorted(
        p for p in SNAPSHOTS.iterdir()
        if p.is_dir() and re.match(r"^\d{4}-\d{2}-\d{2}$", p.name)
    )
    if not dated:
        sys.exit(f"ERROR: no dated snapshot folders in {SNAPSHOTS}")
    return dated[-1]


def pick_file(folder, prefix, in_clean=False):
    """Pick the first CSV in `folder` (or `folder/clean/`) matching `{prefix}*.csv`.

    `in_clean=True` looks in the canonicalized `clean/` subfolder produced by
    tools/clean_airtable_snapshot.py. Use this for Airtable-native tables
    (lyrics, yt_videos, yt_playlists, sutras, etc.) where the canonicalizer
    has normalized column headers to snake_case and stripped invisibles.
    """
    search_dir = folder / "clean" if in_clean else folder
    hits = sorted(search_dir.glob(f"{prefix}*.csv"))
    if not hits:
        where = f"{folder}/clean" if in_clean else str(folder)
        sys.exit(f"ERROR: missing {prefix}*.csv in {where}")
    return hits[0]


def confidence_bucket(score):
    if score >= HIGH_CONF:
        return "HIGH"
    if score >= MEDIUM_CONF:
        return "MEDIUM"
    return "LOW"


def sanitize_csv_cell(value):
    """Normalize cell values so downstream CSV importers stay happy."""
    text = "" if value is None else str(value)
    # Google import can fail on embedded NUL and Unicode line separators.
    text = text.replace("\x00", "")
    text = text.replace("\u2028", " ").replace("\u2029", " ")
    # Flatten hard line breaks in cell content for import robustness.
    text = text.replace("\r\n", " ").replace("\r", " ").replace("\n", " ")
    return text.strip()


def write_csv(path, fields, rows, *, utf8_bom=False):
    encoding = "utf-8-sig" if utf8_bom else "utf-8"
    with open(path, "w", encoding=encoding, newline="") as f:
        w = csv.DictWriter(
            f, fieldnames=fields, extrasaction="ignore", lineterminator="\n")
        w.writeheader()
        w.writerows(
            {k: sanitize_csv_cell(r.get(k, "")) for k in fields}
            for r in rows
        )


def dated_copy(path):
    """Copy to outputs/archive/<RUN_DATE>/<name>-<RUN_DATE>.csv."""
    base, ext = path.stem, path.suffix
    dest_dir = ARCHIVE_DIR / RUN_DATE
    dest_dir.mkdir(parents=True, exist_ok=True)
    dated = dest_dir / f"{base}-{RUN_DATE}{ext}"
    shutil.copy2(path, dated)
    return dated


def load_playlist_name_map():
    """Return {raw_title: cleaned_name} for playlist-name cleanup."""
    if not NAME_MAP_FILE.exists():
        return {}
    with open(NAME_MAP_FILE, encoding="utf-8-sig") as f:
        return {
            r["raw_yt_title"]: r["cleaned_name"]
            for r in csv.DictReader(f)
            if r.get("raw_yt_title") and r.get("cleaned_name")
        }


def load_new_video_qa_overrides():
    """Read prior YT-NEW-VIDEOS-QA.csv so curator edits survive rebuilds.

    Returns {video_id: {"CORRECT_LYRICS_ID": L-…, "CORRECT_ytvideo_in_app": str,
            "CORRECT_format": str}} — only keys with non-empty values are set.
    """
    if not OUT_NEW_QA.exists():
        return {}
    out: dict[str, dict[str, str]] = {}
    with open(OUT_NEW_QA, encoding="utf-8-sig") as f:
        for r in csv.DictReader(f):
            vid = (r.get("video_id") or "").strip()
            if not vid:
                continue
            row: dict[str, str] = {}
            lid = normlid(r.get("CORRECT_LYRICS_ID", ""))
            if lid:
                row["CORRECT_LYRICS_ID"] = lid
            yti = (r.get("CORRECT_ytvideo_in_app") or "").strip()
            if yti:
                row["CORRECT_ytvideo_in_app"] = yti
            fmt = (r.get("CORRECT_format") or "").strip()
            if fmt:
                row["CORRECT_format"] = fmt
            if row:
                out[vid] = row
    return out


def normalize_ytvideo_in_app_cell(raw: str) -> str:
    """Airtable checkbox export style for ytvideo_in_app."""
    v = (raw or "").strip().lower()
    if v in ("1", "true", "yes", "y", "on", "checked"):
        return "checked"
    if v in ("0", "false", "no", "n", "off", "unchecked"):
        return "unchecked"
    return (raw or "").strip() or "unchecked"


def clean_playlist_names(raw_value, name_map):
    """Replace raw playlist titles inside a concatenated playlist_names string
    with their cleaned equivalents. Uses longest-first substring replacement so
    raw titles that contain commas don't get split.
    """
    if not raw_value or not name_map:
        return raw_value
    cleaned = raw_value
    for raw in sorted(name_map.keys(), key=len, reverse=True):
        if raw and raw in cleaned:
            cleaned = cleaned.replace(raw, name_map[raw])
    return cleaned


# ── 1. LOAD INPUTS ───────────────────────────────────────────────────────────
print("[Step 1] Loading inputs...")
if not RAW_FILE.exists():
    sys.exit(f"ERROR: missing {RAW_FILE}. Run 1_extract.py first.")

SNAP = pick_latest_snapshot()
print(f"  snapshot folder    : {SNAP.name}")

VIDEOS_FILE = pick_file(SNAP, "yt_videos-", in_clean=True)
LYRICS_FILE = pick_file(SNAP, "lyrics-",    in_clean=True)
print(f"  videos snapshot    : {VIDEOS_FILE.name}")
print(f"  lyrics snapshot    : {LYRICS_FILE.name}")
print(f"  raw scrape         : {RAW_FILE.name}")

raw = load_csv(RAW_FILE)
snap_videos = load_csv(VIDEOS_FILE)
lyrics = load_csv(LYRICS_FILE)
playlist_name_map = load_playlist_name_map()
new_video_qa = load_new_video_qa_overrides()

print(f"    raw videos       : {len(raw)}")
print(f"    snapshot videos  : {len(snap_videos)}")
print(f"    lyrics entries   : {len(lyrics)}")
print(f"    name_mapping.csv : {len(playlist_name_map)} entries "
      f"(raw → cleaned playlist names)")
print(f"    QA overrides      : {len(new_video_qa)} video(s) with prior "
      f"{OUT_NEW_QA.name} edits")

# Pre-clean playlist_names in both raw and snapshot so downstream merges use
# the canonical (cleaned) form. No-op if the value is already cleaned.
for r in raw:
    r["playlist_names"] = clean_playlist_names(
        r.get("playlist_names", ""), playlist_name_map)
for r in snap_videos:
    r["playlist_names"] = clean_playlist_names(
        r.get("playlist_names", ""), playlist_name_map)

# ── 2. INDEX ─────────────────────────────────────────────────────────────────
print("\n[Step 2] Building indexes...")
raw_by_id = {r["video_id"]: r for r in raw}
snap_by_id = {r["video_id"]: r for r in snap_videos}

# lyrics index: normalized L-N → {title, sutra, songbook}
lyrics_idx = {}
for r in lyrics:
    lid = normlid(r.get("lyrics_id", ""))
    if lid:
        lyrics_idx[lid] = {
            "title": (r.get("song_title") or "").strip(),
            "sutra": (r.get("sutra") or "").strip(),
            "songbook": (r.get("songbook") or "").strip(),
        }
# For fuzzy matching new videos: list of (title, lid) pairs
lyrics_choices = [(v["title"], lid) for lid, v in lyrics_idx.items() if v["title"]]
lyrics_titles = [c[0] for c in lyrics_choices]
lid_by_title_idx = {c[0]: c[1] for c in lyrics_choices}

print(f"  lyrics with title  : {len(lyrics_choices)}")

# ── 3. RECONCILE ─────────────────────────────────────────────────────────────
print("\n[Step 3] Reconciling (scrape + snapshot + LYRICS)...")
final_rows = []
new_qa_rows = []
drift_rows = []
dropped_rows = []

stats = {
    "existing": 0,
    "new": 0,
    "dropped": 0,
    "sutra_fixed": 0,
    "title_fixed": 0,
    "no_lyrics_id": 0,
    "orphan_lyrics_id": 0,
    "drift_flagged": 0,
}


def build_row(scrape, snap, resolved_lid):
    """Merge one video row. scrape may be None (dropped), snap may be None (new)."""
    out = {f: "" for f in FINAL_FIELDS}

    # Preserve curator-owned fields from snapshot (if present)
    if snap:
        for f in PRESERVED_FROM_SNAPSHOT:
            if f in snap:
                out[f] = (snap.get(f) or "").strip()

    # Refresh platform fields from scrape
    if scrape:
        for f in REFRESHED_FROM_SCRAPE:
            if f in scrape:
                out[f] = (scrape.get(f) or "").strip()
        out["video_id"] = scrape["video_id"]
    elif snap:
        # Dropped: keep last-known data from snapshot
        for f in REFRESHED_FROM_SCRAPE:
            if f in snap:
                out[f] = (snap.get(f) or "").strip()
        out["video_id"] = snap["video_id"]

    # Resolved lyrics_id (already normalized if possible)
    if resolved_lid:
        out["lyrics_id"] = resolved_lid

    # Inherit from LYRICS
    normalized = normlid(out["lyrics_id"])
    if normalized and normalized in lyrics_idx:
        out["lyrics_title"] = lyrics_idx[normalized]["title"]
        out["sutra"] = lyrics_idx[normalized]["sutra"]
        out["video_songbook"] = lyrics_idx[normalized]["songbook"]
    else:
        # No valid lyrics_id: leave lyrics_title blank, fall back to scrape sutra pre-fill
        if scrape and not out.get("sutra"):
            out["sutra"] = (scrape.get("sutra") or "").strip()

    # Defaults for new videos
    if not snap:
        if not out["status"]:
            out["status"] = "New"
        if not out["ytvideo_in_app"]:
            out["ytvideo_in_app"] = "FALSE"
        # Pull scrape pre-fills into curator slots if curator value is missing
        if scrape:
            for f in ["content_type", "series_info", "language"]:
                if not out.get(f):
                    out[f] = (scrape.get(f) or "").strip()

    return out


# 3a. Existing + dropped (iterate snapshot)
for vid, snap_row in snap_by_id.items():
    if vid in raw_by_id:
        stats["existing"] += 1
        scrape_row = raw_by_id[vid]
        snap_lid = normlid(snap_row.get("lyrics_id", ""))
        row = build_row(scrape_row, snap_row, snap_lid)

        # Track whether LYRICS inheritance changed anything
        old_sutra = (snap_row.get("sutra") or "").strip()
        new_sutra = row["sutra"]
        if old_sutra and new_sutra and old_sutra != new_sutra:
            stats["sutra_fixed"] += 1

        old_title = (snap_row.get("lyrics_title") or "").strip()
        new_title = row["lyrics_title"]
        if old_title and new_title and old_title != new_title:
            stats["title_fixed"] += 1

        if not snap_lid:
            stats["no_lyrics_id"] += 1
        elif snap_lid not in lyrics_idx:
            stats["orphan_lyrics_id"] += 1

        # Drift check: if lyrics_id is set and content is a song, does the
        # LYRICS title fuzzy-appear anywhere in the video's title OR description?
        if snap_lid and snap_lid in lyrics_idx:
            ct = (snap_row.get("content_type") or "").strip()
            if ct not in NON_SONG_TYPES:
                lyr_title = lyrics_idx[snap_lid]["title"]
                vid_title = (scrape_row.get("title") or "").strip()
                vid_desc = (scrape_row.get("description") or "").strip()
                if lyr_title and (vid_title or vid_desc):
                    t_score = fuzz.partial_ratio(lyr_title.lower(), vid_title.lower()) if vid_title else 0
                    d_score = fuzz.partial_ratio(lyr_title.lower(), vid_desc.lower()) if vid_desc else 0
                    best = max(t_score, d_score)
                    if best < DRIFT_FLAG:
                        drift_rows.append({
                            "video_id": vid,
                            "lyrics_id": snap_row.get("lyrics_id", "").strip(),
                            "lyrics_title": lyr_title,
                            "video_title": vid_title,
                            "best_score": round(best, 1),
                            "title_score": round(t_score, 1),
                            "desc_score": round(d_score, 1),
                            "content_type": ct,
                            "yt_url": (scrape_row.get("yt_url") or "").strip(),
                        })
                        stats["drift_flagged"] += 1

        final_rows.append(row)
    else:
        # In snapshot, not in scrape → dropped
        stats["dropped"] += 1
        snap_lid = normlid(snap_row.get("lyrics_id", ""))
        row = build_row(None, snap_row, snap_lid)
        row["status"] = "Out"  # auto-mark
        dropped_rows.append({
            "video_id": vid,
            "title": (snap_row.get("title") or "").strip(),
            "lyrics_id": snap_row.get("lyrics_id", "").strip(),
            "lyrics_title": row["lyrics_title"],
            "last_status": (snap_row.get("status") or "").strip(),
            "note": "in snapshot but not in fresh scrape",
        })
        final_rows.append(row)

# 3b. New videos (in raw, not in snapshot)
for vid, scrape_row in raw_by_id.items():
    if vid in snap_by_id:
        continue
    stats["new"] += 1
    vid_title = (scrape_row.get("title") or "").strip()
    ct = (scrape_row.get("content_type") or "").strip()

    best_lid = ""
    best_score = 0
    best_title = ""
    bucket = "NONE"

    if ct not in NON_SONG_TYPES and lyrics_titles:
        match = process.extractOne(
            vid_title, lyrics_titles,
            scorer=fuzz.partial_ratio
        )
        if match:
            best_title, best_score, _ = match
            best_lid = lid_by_title_idx[best_title]
            bucket = confidence_bucket(best_score)

    # Curator overrides from prior YT-NEW-VIDEOS-QA.csv
    vid_qa = new_video_qa.get(vid, {})
    curator_lid = normlid(vid_qa.get("CORRECT_LYRICS_ID", ""))
    if curator_lid:
        resolved_lid = curator_lid
        auto_applied = "CURATOR"
    else:
        resolved_lid = best_lid if bucket == "HIGH" else ""
        auto_applied = "YES" if bucket == "HIGH" else "NO"
    row = build_row(scrape_row, None, resolved_lid)
    if vid_qa.get("CORRECT_ytvideo_in_app"):
        row["ytvideo_in_app"] = normalize_ytvideo_in_app_cell(vid_qa["CORRECT_ytvideo_in_app"])
    if vid_qa.get("CORRECT_format"):
        row["format"] = vid_qa["CORRECT_format"].strip()
    final_rows.append(row)

    new_qa_rows.append({
        "video_id": vid,
        "video_title": vid_title,
        "content_type": ct,
        "best_lyrics_id": best_lid,
        "best_match_title": best_title,
        "match_score": best_score,
        "confidence": bucket,
        "auto_applied": auto_applied,
        "yt_url": (scrape_row.get("yt_url") or "").strip(),
        "CORRECT_LYRICS_ID": curator_lid,
        "ytvideo_in_app": (row.get("ytvideo_in_app") or "").strip(),
        "CORRECT_ytvideo_in_app": (vid_qa.get("CORRECT_ytvideo_in_app") or "").strip(),
        "format": (row.get("format") or "").strip(),
        "CORRECT_format": (vid_qa.get("CORRECT_format") or "").strip(),
    })

# ── 4. WRITE OUTPUTS ─────────────────────────────────────────────────────────
print("\n[Step 4] Writing outputs...")
OUT_DIR.mkdir(parents=True, exist_ok=True)

write_csv(OUT_FINAL, FINAL_FIELDS, final_rows)
dated_final = dated_copy(OUT_FINAL)
print(f"  {OUT_FINAL.name} ({len(final_rows)} rows)")
print(f"  {dated_final.name}")

write_csv(OUT_NEW_QA, [
    "video_id", "video_title", "content_type",
    "best_lyrics_id", "best_match_title", "match_score", "confidence",
    "auto_applied", "yt_url", "CORRECT_LYRICS_ID",
    "ytvideo_in_app", "CORRECT_ytvideo_in_app",
    "format", "CORRECT_format",
], new_qa_rows, utf8_bom=True)
print(f"  {OUT_NEW_QA.name} ({len(new_qa_rows)} rows)")

write_csv(OUT_DRIFT, [
    "video_id", "lyrics_id", "lyrics_title", "video_title",
    "best_score", "title_score", "desc_score", "content_type", "yt_url",
], drift_rows)
print(f"  {OUT_DRIFT.name} ({len(drift_rows)} rows)")

write_csv(OUT_DROPPED, [
    "video_id", "title", "lyrics_id", "lyrics_title", "last_status", "note",
], dropped_rows)
print(f"  {OUT_DROPPED.name} ({len(dropped_rows)} rows)")

# Sync report: one-row summary
write_csv(OUT_REPORT, list(stats.keys()) + ["run_date", "snapshot"], [
    {**stats, "run_date": RUN_DATE, "snapshot": SNAP.name}
])
print(f"  {OUT_REPORT.name}")

# ── 5. SUMMARY ───────────────────────────────────────────────────────────────
print("\n" + "=" * 60)
print(f"BUILD SUMMARY — run_date {RUN_DATE}, snapshot {SNAP.name}")
print("=" * 60)
print(f"  Total videos in final output : {len(final_rows)}")
print(f"    existing (in both)         : {stats['existing']}")
print(f"    new (scrape only)          : {stats['new']}")
print(f"    dropped (snapshot only)    : {stats['dropped']}  → status=Out")
print()
print(f"  Sutra values fixed           : {stats['sutra_fixed']}   (inherited from LYRICS)")
print(f"  Lyrics_title values fixed    : {stats['title_fixed']}   (inherited from LYRICS)")
print(f"  Videos with no lyrics_id     : {stats['no_lyrics_id']}")
print(f"  Orphan lyrics_ids            : {stats['orphan_lyrics_id']}  (point to non-existent L-N)")
print(f"  Drift flags (existing songs) : {stats['drift_flagged']}")
print(f"      → meaning: LYRICS song_title fuzzy-match vs this video's YT title OR")
print(f"        description scored <{DRIFT_FLAG}/100 (partial_ratio); "
      f"{', '.join(sorted(NON_SONG_TYPES))} excluded.")
print(f"        Often OK (skit, alt title, lyrics only in audio). Not 'wrong L-id' by itself.")
print()
if stats["new"]:
    high = sum(1 for r in new_qa_rows if r["confidence"] == "HIGH")
    med = sum(1 for r in new_qa_rows if r["confidence"] == "MEDIUM")
    low = sum(1 for r in new_qa_rows if r["confidence"] == "LOW")
    none = sum(1 for r in new_qa_rows if r["confidence"] == "NONE")
    print(f"  New-video QA buckets: HIGH={high} MEDIUM={med} LOW={low} NONE={none}")
print()
def _new_video_row_needs_curation(r: dict) -> bool:
    """True until lyrics_id is resolved AND ytvideo_in_app is checked AND format set (songs)."""
    lyrics_ok = bool(normlid((r.get("CORRECT_LYRICS_ID") or "").strip())) or r.get("auto_applied") != "NO"
    yt_ok = normalize_ytvideo_in_app_cell(r.get("ytvideo_in_app") or "") == "checked"
    ct = (r.get("content_type") or "").strip()
    fmt_needed = ct not in NON_SONG_TYPES
    fmt_ok = bool((r.get("format") or "").strip()) if fmt_needed else True
    return not lyrics_ok or not yt_ok or not fmt_ok


needs_new_video_curation = any(_new_video_row_needs_curation(r) for r in new_qa_rows)
print("Next steps:")
if new_qa_rows and needs_new_video_curation:
    print(f"  1. Open outputs/{OUT_NEW_QA.name} — complete each new row:")
    print(f"     • CORRECT_LYRICS_ID if LOW/MEDIUM/NONE (or confirm auto HIGH)")
    print(f"     • CORRECT_ytvideo_in_app = checked  (in-app /videos + song tab)")
    print(f"     • CORRECT_format = 9:16 | 16:9 | …  (layout on /videos)")
    print(f"     Then re-run this script.")
elif new_qa_rows:
    print(f"  1. New videos: QA columns complete — "
          f"{OUT_NEW_QA.name} kept for audit.")
else:
    print(f"  1. No new-only videos — {OUT_NEW_QA.name} is empty.")
if drift_rows:
    print(f"  2. Drift: {len(drift_rows)} standing row(s) in {OUT_DRIFT.name} (informational;")
    print(f"     stable until YT title/description or LYRICS title / lyrics_id edits change).")
    print(f"     Optional spot-check — not a blocker if you accept those links.")
else:
    print(f"  2. No drift flags — {OUT_DRIFT.name} is empty.")
print(f"  3. When ready, import outputs/{OUT_FINAL.name} into Airtable (match on video_id).")
