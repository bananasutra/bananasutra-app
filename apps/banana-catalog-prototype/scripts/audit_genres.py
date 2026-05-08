#!/usr/bin/env python3
"""
Quick genre-noise audit for generated app artifacts.

Checks:
  - Comma-joined tokens accidentally leaking into genre arrays.
  - Empty tokens.
  - Unknown tokens (outside allowed curated vocabulary).
"""

from __future__ import annotations

import json
from collections import Counter
from pathlib import Path

from allowed_track_genres import ALLOWED_TRACK_GENRE_TOKENS


ROOT = Path(__file__).resolve().parents[3]
CATALOG_PATH = ROOT / "apps" / "banana-catalog-prototype" / "src" / "data" / "generated" / "song_catalog.json"

ALLOWED_GENRES = ALLOWED_TRACK_GENRE_TOKENS


def main() -> None:
    if not CATALOG_PATH.exists():
        raise FileNotFoundError(f"Missing generated catalog: {CATALOG_PATH}")

    rows = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
    unknown = Counter()
    comma_joined = Counter()
    empty_values = 0
    total_primary = 0
    total_secondary = 0

    for row in rows:
        lid = str(row.get("lyrics_id") or "").strip() or "?"
        for key, bucket in (
            ("track_genres", "primary"),
            ("track_secondary_genres", "secondary"),
        ):
            values = row.get(key) or []
            if bucket == "primary":
                total_primary += len(values)
            else:
                total_secondary += len(values)

            for value in values:
                token = str(value or "").strip()
                if not token:
                    empty_values += 1
                    continue
                if "," in token:
                    comma_joined[f"{token} [{lid}]"] += 1
                if token not in ALLOWED_GENRES:
                    unknown[token] += 1

    print(f"Catalog rows: {len(rows)}")
    print(f"Primary tokens: {total_primary}")
    print(f"Secondary tokens: {total_secondary}")
    print(f"Empty tokens: {empty_values}")
    print(f"Comma-joined tokens: {sum(comma_joined.values())}")
    print(f"Unknown tokens: {sum(unknown.values())}")

    if comma_joined:
        print("\nComma-joined samples (top 20):")
        for token, count in comma_joined.most_common(20):
            print(f"  {count:>3}  {token}")

    if unknown:
        print("\nUnknown token counts:")
        for token, count in unknown.most_common():
            print(f"  {count:>3}  {token}")
        print(
            "\nTo allow new genre tokens: add each to ALLOWED_TRACK_GENRE_TOKENS in "
            "apps/banana-catalog-prototype/scripts/allowed_track_genres.py, then re-run npm run catalog:data"
        )


if __name__ == "__main__":
    main()
