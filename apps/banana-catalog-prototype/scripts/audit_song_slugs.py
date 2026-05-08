#!/usr/bin/env python3
"""
Build-time slug uniqueness audit for song_catalog.json.

Uses each row's `url_slug` when non-empty (Airtable / build_artifacts); otherwise the same
rules as src/catalog/slugify.ts (lyricsTitleToUrlSlug on `lyrics_title`).

Usage:
  python3 apps/banana-catalog-prototype/scripts/audit_song_slugs.py
  python3 .../audit_song_slugs.py --out /path/to/report.csv
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
    / "song_catalog.json"
)
DEFAULT_OUT = Path(__file__).resolve().parent / "song_slug_audit.csv"


def main() -> int:
    parser = argparse.ArgumentParser(description="Audit song_catalog url_slug uniqueness.")
    parser.add_argument(
        "--catalog",
        type=Path,
        default=DEFAULT_CATALOG,
        help="Path to song_catalog.json",
    )
    parser.add_argument(
        "--out",
        type=Path,
        default=DEFAULT_OUT,
        help=f"Write per-song CSV (default: {DEFAULT_OUT})",
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
        print("ERROR: song_catalog.json must be a JSON array", file=sys.stderr)
        return 1

    by_slug: dict[str, list[dict[str, str]]] = defaultdict(list)
    blank_titles: list[str] = []
    entries: list[tuple[str, str, str, bool]] = []

    missing_airtable_slug = 0
    for row in rows:
        lid = str(row.get("lyrics_id") or "").strip()
        raw_title = row.get("lyrics_title")
        title = raw_title if isinstance(raw_title, str) else ("" if raw_title is None else str(raw_title))
        title_blank = not title.strip()
        if title_blank:
            blank_titles.append(lid or "?")
        raw_slug = str(row.get("url_slug") or "").strip()
        if not raw_slug:
            missing_airtable_slug += 1
        slug = raw_slug if raw_slug else lyrics_title_to_url_slug(title)
        by_slug[slug].append({"lyrics_id": lid, "lyrics_title": title})
        entries.append((lid, title, slug, title_blank))

    slug_counts = {s: len(items) for s, items in by_slug.items()}
    dup_slugs = {s: items for s, items in by_slug.items() if len(items) > 1}
    fallback_song_slug = [e for e in entries if e[2] == "song"]

    print(f"Catalog: {catalog_path}")
    print(f"Songs: {len(rows)}")
    print(f"Distinct slugs: {len(by_slug)}")
    print(f"Blank / whitespace-only lyrics_title: {len(blank_titles)}")
    if blank_titles:
        print(f"  lyrics_id sample: {', '.join(blank_titles[:15])}{' …' if len(blank_titles) > 15 else ''}")
    print(f"Duplicate slugs (collision): {len(dup_slugs)}")
    for slug in sorted(dup_slugs.keys()):
        items = dup_slugs[slug]
        print(f"  {slug!r}  ({len(items)} songs)")
        for it in items:
            tid = it["lyrics_id"]
            tshort = it["lyrics_title"][:60] + ("…" if len(it["lyrics_title"]) > 60 else "")
            print(f"    {tid}  {tshort!r}")
    print(f"Rows with slug 'song' (fallback / empty-ish title): {len(fallback_song_slug)}")
    print(f"Rows with empty url_slug in JSON (using title-derived slug): {missing_airtable_slug}")

    if not args.no_csv:
        out: Path = args.out
        out.parent.mkdir(parents=True, exist_ok=True)
        with out.open("w", encoding="utf-8", newline="") as f:
            w = csv.writer(f)
            w.writerow(
                [
                    "lyrics_id",
                    "lyrics_title",
                    "url_slug",
                    "lyrics_title_blank",
                    "slug_share_count",
                ]
            )
            for lid, title, slug, title_blank in entries:
                w.writerow(
                    [
                        lid,
                        title,
                        slug,
                        "1" if title_blank else "0",
                        str(slug_counts[slug]),
                    ]
                )
        print(f"\nWrote {out}")

    if dup_slugs or blank_titles:
        print("\nStatus: FAIL (duplicates or blank titles — fix before /songs/:slug is unique)")
        return 2
    print("\nStatus: OK (no duplicate slugs, no blank lyrics_title)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
