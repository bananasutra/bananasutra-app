#!/usr/bin/env python3
"""
Sync YT videos metadata from SONGs (Lyrics) using lyrics_id as source of truth.

- Sets yt_videos.sutra from lyrics.sutra
- Sets yt_videos.video_songbook from lyrics.songbook

Intended for canonicalized snapshot files in AIRTABLE/snapshots/<date>/clean/.
"""

from __future__ import annotations

import argparse
import csv
import re
from pathlib import Path


def normalize_lid(raw: str) -> str:
    v = (raw or "").strip()
    m = re.match(r"^L-(\d+)$", v, flags=re.IGNORECASE)
    if not m:
        return v
    return f"L-{int(m.group(1))}"


def load_lyrics_index(lyrics_csv: Path) -> dict[str, dict[str, str]]:
    out: dict[str, dict[str, str]] = {}
    with lyrics_csv.open(newline="", encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            lid = normalize_lid(row.get("lyrics_id", ""))
            if not lid:
                continue
            out[lid] = {
                "sutra": (row.get("sutra") or "").strip(),
                "songbook": (row.get("songbook") or "").strip(),
            }
    return out


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--yt-csv", type=Path, required=True, help="Path to yt_videos CSV")
    ap.add_argument("--lyrics-csv", type=Path, required=True, help="Path to lyrics CSV")
    args = ap.parse_args()

    if not args.yt_csv.is_file():
        raise SystemExit(f"Missing --yt-csv file: {args.yt_csv}")
    if not args.lyrics_csv.is_file():
        raise SystemExit(f"Missing --lyrics-csv file: {args.lyrics_csv}")

    lyrics_idx = load_lyrics_index(args.lyrics_csv)
    if not lyrics_idx:
        raise SystemExit(f"No lyrics_id mappings found in {args.lyrics_csv}")

    with args.yt_csv.open(newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        rows = list(reader)
        fieldnames = list(reader.fieldnames or [])

    if "lyrics_id" not in fieldnames or "sutra" not in fieldnames:
        raise SystemExit(f"Expected lyrics_id/sutra columns in {args.yt_csv}")

    if "video_songbook" not in fieldnames:
        fieldnames.append("video_songbook")
    if "video_featured" not in fieldnames:
        fieldnames.append("video_featured")
    if "video_featured_description" not in fieldnames:
        fieldnames.append("video_featured_description")

    scanned = 0
    with_lid = 0
    mapped_lid = 0
    sutra_fixed = 0
    songbook_filled = 0

    for row in rows:
        scanned += 1
        lid = normalize_lid(row.get("lyrics_id", ""))
        if not lid:
            continue
        with_lid += 1
        mapped = lyrics_idx.get(lid)
        if not mapped:
            continue
        mapped_lid += 1

        new_sutra = mapped["sutra"]
        if new_sutra and (row.get("sutra") or "").strip() != new_sutra:
            row["sutra"] = new_sutra
            sutra_fixed += 1

        new_songbook = mapped["songbook"]
        if new_songbook and (row.get("video_songbook") or "").strip() != new_songbook:
            row["video_songbook"] = new_songbook
            songbook_filled += 1

    with args.yt_csv.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)

    print(f"Updated: {args.yt_csv}")
    print(f"Rows scanned         : {scanned}")
    print(f"Rows with lyrics_id  : {with_lid}")
    print(f"Rows with mapped L-id: {mapped_lid}")
    print(f"Sutra corrected      : {sutra_fixed}")
    print(f"video_songbook set   : {songbook_filled}")


if __name__ == "__main__":
    main()
