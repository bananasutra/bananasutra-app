#!/usr/bin/env python3
"""
List lyrics_ids that have ≥1 YouTube row in youtube_by_lyrics_id.json but are NOT in
song_catalog.json (i.e. lyrics song_in_app is false in Airtable / excluded at build).

Reads:
  apps/banana-catalog-prototype/src/data/generated/song_catalog.json
  apps/banana-catalog-prototype/src/data/generated/youtube_by_lyrics_id.json
  AIRTABLE/snapshots/<latest>/clean/lyrics-*.csv

Writes:
  _docs/exports/lyrics_with_youtube_not_in_app_catalog.csv

Run from repo root:
  python3 tools/export_youtube_not_in_app_catalog.py
"""
from __future__ import annotations

import csv
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CATALOG = ROOT / "apps" / "banana-catalog-prototype" / "src" / "data" / "generated" / "song_catalog.json"
YT_JSON = ROOT / "apps" / "banana-catalog-prototype" / "src" / "data" / "generated" / "youtube_by_lyrics_id.json"
SNAPSHOTS = ROOT / "AIRTABLE" / "snapshots"
OUT_DIR = ROOT / "_docs" / "exports"
OUT_CSV = OUT_DIR / "lyrics_with_youtube_not_in_app_catalog.csv"


def latest_snapshot_date() -> str:
    dated = sorted(
        p.name for p in SNAPSHOTS.iterdir()
        if p.is_dir() and re.match(r"^\d{4}-\d{2}-\d{2}$", p.name)
    )
    if not dated:
        sys.exit(f"No dated snapshot folders in {SNAPSHOTS}")
    return dated[-1]


def norm_lid(v: str) -> str:
    v = (v or "").strip()
    if v.startswith("L-"):
        try:
            return f"L-{int(v[2:])}"
        except ValueError:
            return v
    return v


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8", newline="") as fp:
        return [dict(r) for r in csv.DictReader(fp)]


def parse_bool(v: str | None) -> bool:
    if v is None or str(v).strip() == "":
        return False
    return str(v).strip().lower() in {"1", "true", "yes", "y", "on", "checked"}


def main() -> None:
    if not CATALOG.exists():
        sys.exit(f"Missing {CATALOG} — run: cd apps/banana-catalog-prototype && python3 scripts/build_artifacts.py")
    if not YT_JSON.exists():
        sys.exit(f"Missing {YT_JSON} — run build_artifacts.py")

    in_app = {norm_lid(str(r.get("lyrics_id", ""))) for r in json.loads(CATALOG.read_text(encoding="utf-8"))}
    in_app.discard("")

    yt_by_lid: dict[str, list[dict]] = json.loads(YT_JSON.read_text(encoding="utf-8"))
    yt_ids = sorted({norm_lid(k) for k in yt_by_lid if k and yt_by_lid[k]}, key=lambda x: (int(x[2:]) if x.startswith("L-") else 0, x))

    gap = [lid for lid in yt_ids if lid not in in_app]

    snap = latest_snapshot_date()
    clean = SNAPSHOTS / snap / "clean"
    lyrics_files = sorted(clean.glob("lyrics-*.csv"))
    if not lyrics_files:
        sys.exit(f"No lyrics-*.csv in {clean}")
    lyrics_path = lyrics_files[0]
    lyrics_rows = read_csv(lyrics_path)
    lyrics_by_lid: dict[str, dict[str, str]] = {}
    for row in lyrics_rows:
        lid = norm_lid(row.get("lyrics_id", ""))
        if lid:
            lyrics_by_lid[lid] = row

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    fields = [
        "lyrics_id",
        "video_count",
        "song_in_app_lyrics_csv",
        "song_title_lyrics_csv",
        "sutra_lyrics_csv",
        "lyrics_title_first_video",
        "video_ids_sample",
    ]
    rows_out: list[dict[str, str]] = []
    for lid in gap:
        vids = yt_by_lid.get(lid, [])
        lyric = lyrics_by_lid.get(lid, {})
        first_title = (vids[0].get("lyrics_title") or "").strip() if vids else ""
        sample_ids = ",".join((v.get("video_id") or "").strip() for v in vids[:5])
        rows_out.append({
            "lyrics_id": lid,
            "video_count": str(len(vids)),
            "song_in_app_lyrics_csv": str(
                parse_bool(lyric.get("song_in_app"))
            ).upper(),
            "song_title_lyrics_csv": (lyric.get("song_title") or "").strip(),
            "sutra_lyrics_csv": (lyric.get("sutra") or "").strip(),
            "lyrics_title_first_video": first_title,
            "video_ids_sample": sample_ids,
        })

    with OUT_CSV.open("w", encoding="utf-8", newline="") as fp:
        w = csv.DictWriter(fp, fieldnames=fields)
        w.writeheader()
        w.writerows(rows_out)

    print(f"Snapshot lyrics: {lyrics_path.name} ({snap})")
    print(f"In-app songs (song_catalog): {len(in_app)}")
    print(f"Lyrics_ids with YouTube data: {len(yt_ids)}")
    print(f"Gap (YouTube but not in app catalog): {len(gap)}")
    print(f"Wrote {OUT_CSV}")


if __name__ == "__main__":
    main()
