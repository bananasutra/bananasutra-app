#!/usr/bin/env python3
"""
Validate clean Airtable snapshot integrity for catalog build trust.

Hard failures:
  - Missing required columns
  - Unexpected LIGHT/SHADOW casing values
  - Comma-joined primary genre in SC tracks

Soft warnings:
  - Unknown genre tokens
  - SC EP genres/genres_full non-empty counts (informational only)
"""

from __future__ import annotations

import argparse
import csv
import json
import re
from collections import Counter
from pathlib import Path

from allowed_track_genres import ALLOWED_TRACK_GENRE_TOKENS


ROOT = Path(__file__).resolve().parents[3]
SNAPSHOTS_DIR = ROOT / "AIRTABLE" / "snapshots"
REPORT_PATH = (
    ROOT / "apps" / "banana-catalog-prototype" / "src" / "data" / "generated" / "_snapshot_integrity.json"
)

ALLOWED_GENRES = ALLOWED_TRACK_GENRE_TOKENS


def latest_snapshot_date() -> str:
    dates = sorted(
        p.name
        for p in SNAPSHOTS_DIR.iterdir()
        if p.is_dir() and re.match(r"^\d{4}-\d{2}-\d{2}$", p.name)
    )
    if not dates:
        raise RuntimeError("No YYYY-MM-DD snapshot directories found under AIRTABLE/snapshots.")
    return dates[-1]


def read_rows(path: Path) -> tuple[list[dict[str, str]], list[str]]:
    with path.open("r", encoding="utf-8", newline="") as fp:
        reader = csv.DictReader(fp)
        rows = [dict(r) for r in reader]
        return rows, list(reader.fieldnames or [])


def split_multi(value: str | None) -> list[str]:
    if not value:
        return []
    return [token.strip() for token in str(value).replace("\n", ",").split(",") if token.strip()]


def require_columns(table: str, headers: list[str], required: set[str], errors: list[str]) -> None:
    missing = sorted(required - set(headers))
    if missing:
        errors.append(f"{table}: missing required columns: {', '.join(missing)}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--date", help="Snapshot date (YYYY-MM-DD). Defaults to latest.")
    args = parser.parse_args()

    date = args.date or latest_snapshot_date()
    clean = SNAPSHOTS_DIR / date / "clean"
    paths = {
        "lyrics": clean / f"lyrics-{date}.csv",
        "sc_tracks": clean / f"sc_tracks-{date}.csv",
        "sc_eps": clean / f"sc_eps-{date}.csv",
    }
    for name, path in paths.items():
        if not path.exists():
            raise FileNotFoundError(f"Missing {name} CSV: {path}")

    errors: list[str] = []
    warnings: list[str] = []

    lyrics_rows, lyrics_headers = read_rows(paths["lyrics"])
    sc_track_rows, sc_track_headers = read_rows(paths["sc_tracks"])
    sc_eps_rows, sc_eps_headers = read_rows(paths["sc_eps"])

    require_columns("lyrics", lyrics_headers, {"lyrics_id", "song_in_app", "light_shadow"}, errors)
    require_columns(
        "sc_tracks",
        sc_track_headers,
        {"track_id", "lyrics_id", "primary_genre", "secondary_genres"},
        errors,
    )
    require_columns(
        "sc_eps",
        sc_eps_headers,
        {
            "lyrics_id",
            "genres",
            "genres_full",
            "ep_featured",
            "ep_description",
            "ep_songbook_title",
        },
        errors,
    )

    light_shadow_counter = Counter()
    bad_light_shadow: list[str] = []
    for row in lyrics_rows:
        val = str(row.get("light_shadow") or "").strip()
        if not val:
            continue
        light_shadow_counter[val] += 1
        if val not in {"LIGHT", "SHADOW"}:
            bad_light_shadow.append(val)
    if bad_light_shadow:
        errors.append(
            "lyrics: invalid light_shadow values (expect LIGHT/SHADOW only): "
            + ", ".join(sorted(set(bad_light_shadow)))
        )

    primary_with_commas = 0
    unknown_genres = Counter()
    for row in sc_track_rows:
        primary = str(row.get("primary_genre") or "").strip()
        if "," in primary:
            primary_with_commas += 1
        for token in split_multi(primary):
            if token and token not in ALLOWED_GENRES:
                unknown_genres[token] += 1
        for token in split_multi(row.get("secondary_genres")):
            if token and token not in ALLOWED_GENRES:
                unknown_genres[token] += 1

    if primary_with_commas:
        errors.append(f"sc_tracks: {primary_with_commas} rows have comma-joined primary_genre.")
    if unknown_genres:
        warnings.append(
            "sc_tracks: unknown genre tokens seen: "
            + ", ".join(f"{k} ({v})" for k, v in unknown_genres.most_common())
        )
        warnings.append(
            "sc_tracks: to allow new tokens, add each to ALLOWED_TRACK_GENRE_TOKENS in "
            "apps/banana-catalog-prototype/scripts/allowed_track_genres.py, then re-run npm run catalog:data"
        )

    eps_with_genres = sum(1 for r in sc_eps_rows if str(r.get("genres") or "").strip())
    eps_with_genres_full = sum(1 for r in sc_eps_rows if str(r.get("genres_full") or "").strip())
    warnings.append(
        f"sc_eps: non-empty genres={eps_with_genres}, genres_full={eps_with_genres_full} (informational; app facets ignore EP genres)."
    )

    report = {
        "snapshot_date": date,
        "rows": {
            "lyrics": len(lyrics_rows),
            "sc_tracks": len(sc_track_rows),
            "sc_eps": len(sc_eps_rows),
        },
        "light_shadow_values": dict(light_shadow_counter),
        "errors": errors,
        "warnings": warnings,
    }
    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    REPORT_PATH.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(f"Wrote {REPORT_PATH.relative_to(ROOT)}")
    print(f"Snapshot: {date}")
    print(f"Rows: lyrics={len(lyrics_rows)} sc_tracks={len(sc_track_rows)} sc_eps={len(sc_eps_rows)}")
    print(f"Errors: {len(errors)} | Warnings: {len(warnings)}")
    if warnings:
        for w in warnings:
            print(f"WARNING: {w}")
    if errors:
        for e in errors:
            print(f"ERROR: {e}")
        raise SystemExit(1)


if __name__ == "__main__":
    main()
