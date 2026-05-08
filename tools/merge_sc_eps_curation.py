#!/usr/bin/env python3
"""
Merge EP curation columns from a reference SC EPs CSV into snapshot exports.

Use when a raw Airtable export omitted optional columns (ep_featured,
ep_description, ep_songbook_title) but an older backup still has them.
Join key: ep_url.

Does not overwrite non-empty target cells unless --force-curation is passed.

Typical recovery (2026-05-03 style):
  1. This script: merge backup into clean/sc_eps and raw SC EPs.
  2. Optional: run clean_airtable_snapshot on the snapshot folder.
  3. tools/sync_sutra_from_songs.py --eps-only --songbook-only --eps-csv clean/sc_eps-*.csv
     --songs-csv "SONGs (Lyrics)-*.csv"  (fills ep_songbook_title; does not change sutra)
  4. If you ran step 2, re-run step 3 — the cleaner regenerates clean from raw. Then copy
     ep_songbook_title from the clean file back into raw SC EPs (keep raw and clean consistent).
"""

from __future__ import annotations

import argparse
import csv
from pathlib import Path


CURATION_KEYS = ("ep_featured", "ep_description", "ep_songbook_title")

# Matches historical clean snapshots + catalog expectations
CANONICAL_EP_FIELDNAMES: list[str] = [
    "ep_title",
    "ep_url",
    "sutra",
    "ep_in_app",
    "ep_featured",
    "ep_description",
    "ep_songbook_title",
    "ep_volume",
    "ep_rating",
    "genres",
    "genres_full",
    "ep_total_tracks",
    "total_plays",
    "total_likes",
    "duration_total",
    "artwork_url",
    "artwork_lg_url",
    "lyrics_title",
    "lyrics_id",
    "created_at",
    "playlist_names_clean",
]


def load_by_url(path: Path) -> tuple[list[str], dict[str, dict[str, str]]]:
    with path.open(newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        fieldnames = list(reader.fieldnames or [])
        by_url: dict[str, dict[str, str]] = {}
        for row in reader:
            u = (row.get("ep_url") or "").strip()
            if u:
                by_url[u] = row
    return fieldnames, by_url


def merge_row(
    row: dict[str, str],
    ref: dict[str, str] | None,
    force: bool,
) -> None:
    if not ref:
        return
    for k in CURATION_KEYS:
        cur = (row.get(k) or "").strip()
        incoming = (ref.get(k) or "").strip()
        if not incoming:
            continue
        if force or not cur:
            row[k] = ref[k]


def write_clean(path: Path, rows: list[dict[str, str]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    extra = sorted(
        k
        for k in {key for r in rows for key in r}
        if k not in CANONICAL_EP_FIELDNAMES
    )
    fieldnames = CANONICAL_EP_FIELDNAMES + extra
    with path.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        w.writeheader()
        for row in rows:
            out = {fn: (row.get(fn) or "") for fn in fieldnames}
            w.writerow(out)


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument(
        "--reference",
        type=Path,
        required=True,
        help="CSV with ep_featured / ep_description / ep_songbook_title (e.g. backups/)",
    )
    ap.add_argument(
        "--clean-eps",
        type=Path,
        required=True,
        help="Target clean/sc_eps-YYYY-MM-DD.csv to update",
    )
    ap.add_argument(
        "--raw-eps",
        type=Path,
        default=None,
        help="Optional sibling SC EPs-YYYY-MM-DD.csv to patch so re-running "
        "clean_airtable_snapshot keeps curation columns",
    )
    ap.add_argument(
        "--force-curation",
        action="store_true",
        help="Overwrite existing non-empty curation cells with reference values",
    )
    args = ap.parse_args()

    if not args.reference.is_file():
        raise SystemExit(f"Missing reference: {args.reference}")
    if not args.clean_eps.is_file():
        raise SystemExit(f"Missing clean file: {args.clean_eps}")

    _, ref_by_url = load_by_url(args.reference)

    with args.clean_eps.open(newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        base_fields = list(reader.fieldnames or [])
        rows = list(reader)

    for row in rows:
        u = (row.get("ep_url") or "").strip()
        merge_row(row, ref_by_url.get(u), args.force_curation)
        for k in CURATION_KEYS:
            row.setdefault(k, "")

    write_clean(args.clean_eps, rows)
    print(f"Wrote {args.clean_eps} ({len(rows)} rows)")

    if args.raw_eps:
        if not args.raw_eps.is_file():
            raise SystemExit(f"Missing raw file: {args.raw_eps}")
        with args.raw_eps.open(newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            raw_fields = list(reader.fieldnames or [])
            raw_rows = list(reader)
        for row in raw_rows:
            u = (row.get("ep_url") or "").strip()
            merge_row(row, ref_by_url.get(u), args.force_curation)
            for k in CURATION_KEYS:
                row.setdefault(k, "")

        # Dedupe raw headers while preserving order
        out_fields: list[str] = []
        seen_h: set[str] = set()
        for h in raw_fields:
            if h not in seen_h:
                seen_h.add(h)
                out_fields.append(h)

        insert_at = (
            out_fields.index("ep_in_app") + 1 if "ep_in_app" in out_fields else len(out_fields)
        )
        for k in CURATION_KEYS:
            if k not in out_fields:
                out_fields.insert(insert_at, k)
                insert_at += 1

        with args.raw_eps.open("w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=out_fields, extrasaction="ignore")
            w.writeheader()
            for row in raw_rows:
                w.writerow({h: row.get(h, "") for h in out_fields})

        print(f"Wrote {args.raw_eps} ({len(raw_rows)} rows, headers merged)")


if __name__ == "__main__":
    main()
