#!/usr/bin/env python3
"""
Build-time slug uniqueness audit for songbook_catalog.json.

Uses each row's `url_slug_songbook` (resolved in build_artifacts, same as app `songbooks.ts`).
Falls back to lyrics_title_to_url_slug(songbook) if the field is missing (older JSON).

Usage:
  python3 apps/banana-catalog-prototype/scripts/audit_songbook_slugs.py
  python3 .../audit_songbook_slugs.py --out /path/to/report.csv
"""

from __future__ import annotations

import argparse
import csv
import json
import sys
from collections import defaultdict
from pathlib import Path

from lyrics_url_slug import lyrics_title_to_url_slug

ROOT = Path(__file__).resolve().parents[3]
DEFAULT_CATALOG = (
    ROOT
    / "apps"
    / "banana-catalog-prototype"
    / "src"
    / "data"
    / "generated"
    / "songbook_catalog.json"
)
DEFAULT_OUT = Path(__file__).resolve().parent / "songbook_slug_audit.csv"


def resolved_slug(row: dict) -> str:
    raw = str(row.get("url_slug_songbook") or "").strip()
    if raw:
        return raw
    name = str(row.get("songbook") or "").strip()
    return lyrics_title_to_url_slug(name)


def main() -> int:
    parser = argparse.ArgumentParser(description="Audit songbook_catalog url_slug_songbook uniqueness.")
    parser.add_argument(
        "--catalog",
        type=Path,
        default=DEFAULT_CATALOG,
        help="Path to songbook_catalog.json",
    )
    parser.add_argument(
        "--out",
        type=Path,
        default=DEFAULT_OUT,
        help=f"Write per-book CSV (default: {DEFAULT_OUT})",
    )
    parser.add_argument(
        "--no-csv",
        action="store_true",
        help="Console summary only",
    )
    args = parser.parse_args()
    catalog_path: Path = args.catalog
    if not catalog_path.is_file():
        print(f"ERROR: catalog not found: {catalog_path}", file=sys.stderr)
        return 1

    rows = json.loads(catalog_path.read_text(encoding="utf-8"))
    if not isinstance(rows, list):
        print("ERROR: songbook_catalog.json must be a JSON array", file=sys.stderr)
        return 1

    by_slug: dict[str, list[dict[str, str]]] = defaultdict(list)
    blank_names: list[str] = []
    entries: list[tuple[str, str, str, str, bool, bool]] = []

    missing_json_slug = 0
    for row in rows:
        if not isinstance(row, dict):
            continue
        name = str(row.get("songbook") or "").strip()
        bid = str(row.get("songbook_id") or "").strip()
        if not name:
            blank_names.append(bid or "?")
        raw_in_json = str(row.get("url_slug_songbook") or "").strip()
        if not raw_in_json:
            missing_json_slug += 1
        slug = resolved_slug(row)
        by_slug[slug].append({"songbook": name, "songbook_id": bid})
        locked = bool(row.get("url_songbook_locked"))
        entries.append((bid, name, slug, raw_in_json, locked, not bool(name)))

    slug_counts = {s: len(items) for s, items in by_slug.items()}
    dup_slugs = {s: items for s, items in by_slug.items() if len(items) > 1}
    fallback_song_slug = [e for e in entries if e[2] == "song"]

    print(f"Catalog: {catalog_path}")
    print(f"Songbooks: {len(rows)}")
    print(f"Distinct slugs: {len(by_slug)}")
    print(f"Blank songbook name: {len(blank_names)}")
    if blank_names:
        print(f"  songbook_id sample: {', '.join(blank_names[:15])}{' …' if len(blank_names) > 15 else ''}")
    print(f"Duplicate slugs (collision): {len(dup_slugs)}")
    for slug in sorted(dup_slugs.keys()):
        items = dup_slugs[slug]
        print(f"  {slug!r}  ({len(items)} books)")
        for it in items:
            sid = it["songbook_id"]
            sname = it["songbook"][:70] + ("…" if len(it["songbook"]) > 70 else "")
            print(f"    {sid!r}  {sname!r}")
    print(f"Rows with slug 'song' (fallback / empty name): {len(fallback_song_slug)}")
    print(f"Rows with empty url_slug_songbook in JSON (title-derived): {missing_json_slug}")

    if not args.no_csv:
        out: Path = args.out
        out.parent.mkdir(parents=True, exist_ok=True)
        with out.open("w", encoding="utf-8", newline="") as f:
            w = csv.writer(f)
            w.writerow(
                [
                    "songbook_id",
                    "songbook",
                    "url_slug_songbook",
                    "resolved_slug",
                    "url_songbook_locked",
                    "songbook_name_blank",
                    "slug_share_count",
                ]
            )
            for bid, name, slug, raw_json, locked, name_blank in entries:
                w.writerow(
                    [
                        bid,
                        name,
                        raw_json,
                        slug,
                        "1" if locked else "0",
                        "1" if name_blank else "0",
                        str(slug_counts[slug]),
                    ]
                )
        print(f"\nWrote {out}")

    if dup_slugs or blank_names:
        print("\nStatus: FAIL (duplicates or blank songbook name — fix before /songbooks/:slug is unique)")
        return 2
    print("\nStatus: OK (no duplicate slugs, no blank songbook name)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
