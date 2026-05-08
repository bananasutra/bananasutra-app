#!/usr/bin/env python3
"""
Fill `url_slug` on a Lyrics CSV export (Plan B — no Airtable Scripting extension).

Uses the same slug rules as the catalog app (lyrics_url_slug.lyrics_title_to_url_slug).

Typical flow:
  1. In Airtable: sort Lyrics by `lyrics_id`, show columns you need + empty `url_slug`.
  2. Download CSV (UTF-8).
  3. Run this script → get `filled.csv` with suggested slugs where `url_slug` was blank.
  4. Fix duplicate slugs in a spreadsheet if the script reports any, re-run or edit by hand.
  5. Prefer **only** updating `url_slug` in Airtable (paste column, or import a **minimal** CSV —
     see `--minimal-out`). **Do not** re-import the full wide CSV if you have linked records /
     multi-select / commas inside cells; Airtable and spreadsheet tools often mangle those on round-trip.

Usage:
  python3 apps/banana-catalog-prototype/scripts/fill_lyrics_url_slugs_from_csv.py \\
    --input ~/Downloads/Lyrics-export.csv \\
    --output ~/Downloads/Lyrics-filled.csv

If your export uses different header text (e.g. Airtable labels):
  ... --title-col "Song title" --id-col "lyrics_id" --slug-col "url_slug"
"""

from __future__ import annotations

import argparse
import csv
import io
import sys
from collections import defaultdict
from pathlib import Path

from lyrics_url_slug import lyrics_title_to_url_slug


def _norm_key(name: str) -> str:
    return (name or "").replace("\ufeff", "").strip().lower().replace(" ", "_")


def _find_col(fieldnames: list[str], preferred: str, fallbacks: tuple[str, ...]) -> str:
    """Return actual CSV header matching preferred or fallbacks (case/spacing tolerant)."""
    mapping = {_norm_key(f): f for f in fieldnames}
    for cand in (preferred,) + fallbacks:
        key = _norm_key(cand)
        if key in mapping:
            return mapping[key]
    raise SystemExit(
        f"Could not find column like {preferred!r}. Headers: {fieldnames!r}"
    )


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Fill url_slug on Lyrics CSV from song title (Airtable Plan B)."
    )
    parser.add_argument("--input", type=Path, required=True, help="CSV exported from Airtable")
    parser.add_argument("--output", type=Path, required=True, help="CSV to write (filled url_slug)")
    parser.add_argument("--title-col", default="song_title", help="Header for display title")
    parser.add_argument(
        "--title-fallbacks",
        default="song title,Song Title,lyrics_title",
        help="Comma-separated alternate header names to try",
    )
    parser.add_argument("--id-col", default="lyrics_id", help="Header for lyrics_id")
    parser.add_argument("--slug-col", default="url_slug", help="Header for url_slug output")
    parser.add_argument(
        "--force",
        action="store_true",
        help="Overwrite non-empty url_slug (default: only fill blanks)",
    )
    parser.add_argument(
        "--locked-col",
        default="",
        help="If set (e.g. url_slug_locked), set to 1 when we write a new slug",
    )
    parser.add_argument(
        "--minimal-out",
        type=Path,
        default=None,
        help="Also write this 2-column CSV (lyrics_id, url_slug only) for safer Airtable import / merge",
    )
    args = parser.parse_args()
    inp: Path = args.input
    out: Path = args.output
    if not inp.is_file():
        print(f"ERROR: input not found: {inp}", file=sys.stderr)
        return 1

    # Never use str.splitlines() before csv: quoted fields (e.g. lyrics) can contain
    # newlines — splitlines breaks row boundaries and corrupts / flattens cells.
    text = inp.read_text(encoding="utf-8-sig")
    reader = csv.DictReader(io.StringIO(text))
    if not reader.fieldnames:
        print("ERROR: CSV has no header row", file=sys.stderr)
        return 1
    fieldnames = list(reader.fieldnames)
    fallbacks = tuple(x.strip() for x in args.title_fallbacks.split(",") if x.strip())
    title_h = _find_col(fieldnames, args.title_col, fallbacks)
    id_h = _find_col(fieldnames, args.id_col, ("lyrics id", "Lyrics id"))
    slug_h = _find_col(fieldnames, args.slug_col, ("URL slug", "url slug"))

    locked_h = ""
    if args.locked_col.strip():
        locked_h = _find_col(fieldnames, args.locked_col.strip(), ())

    rows: list[dict[str, str]] = []
    for raw in reader:
        # Preserve cell text exactly (multiline lyrics, intentional spaces).
        row = {k: (raw.get(k) if raw.get(k) is not None else "") for k in fieldnames}
        rows.append(row)

    filled_lids: set[str] = set()
    for row in rows:
        existing = (row.get(slug_h) or "").strip()
        title = (row.get(title_h) or "").strip()
        if existing and not args.force:
            continue
        row[slug_h] = lyrics_title_to_url_slug(title) if title else "song"
        lid = (row.get(id_h) or "").strip()
        if lid:
            filled_lids.add(lid)

    if locked_h:
        for row in rows:
            lid = (row.get(id_h) or "").strip()
            if lid in filled_lids:
                row[locked_h] = "1"

    by_slug: dict[str, list[str]] = defaultdict(list)
    for row in rows:
        slug = (row.get(slug_h) or "").strip()
        lid = (row.get(id_h) or "").strip() or "?"
        if slug:
            by_slug[slug].append(lid)

    dupes = {s: lids for s, lids in by_slug.items() if len(lids) > 1}
    blanks = sum(1 for r in rows if not (r.get(slug_h) or "").strip())

    out.parent.mkdir(parents=True, exist_ok=True)
    with out.open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        w.writeheader()
        w.writerows(rows)

    if args.minimal_out is not None:
        mini = args.minimal_out
        mini.parent.mkdir(parents=True, exist_ok=True)
        mini_cols = [id_h, slug_h]
        with mini.open("w", encoding="utf-8-sig", newline="") as f:
            mw = csv.DictWriter(f, fieldnames=mini_cols)
            mw.writeheader()
            for row in rows:
                mw.writerow({id_h: row.get(id_h, ""), slug_h: row.get(slug_h, "")})
        print(f"Minimal (safe merge): {mini}")

    print(f"Rows: {len(rows)}")
    print(f"Wrote: {out}")
    print(f"Empty url_slug after fill: {blanks}")
    if dupes:
        print(f"\nDUPLICATE url_slug values ({len(dupes)} slugs) — fix in spreadsheet before Airtable:")
        for slug in sorted(dupes.keys()):
            print(f"  {slug!r} -> lyrics_id: {', '.join(dupes[slug])}")
        print("\nExit 2: resolve duplicates (edit url_slug on all but one per group), then re-run.")
        return 2

    print("\nOK: all url_slug values unique. Next: paste column or import into Airtable.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
