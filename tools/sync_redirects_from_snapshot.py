#!/usr/bin/env python3
"""
Sync catalog slug redirects from Airtable snapshot → catalog-redirects.json.

Source: AIRTABLE/snapshots/<date>/clean/301_redirects-<date>.csv
Only rows with redirect_status == "final" are written. Draft/template rows are ignored.

Downstream consumers (run separately or via npm run catalog:redirects:sync):
  - apps/banana-catalog-prototype/catalog-redirects.json
  - workers/seo-worker/scripts/sync-catalog-redirects.mjs → catalogRedirects.generated.ts
  - generate-route-redirects.mjs (build time, reads catalog-redirects.json)

Usage:
    python3 tools/sync_redirects_from_snapshot.py
    python3 tools/sync_redirects_from_snapshot.py 2026-06-23
"""
from __future__ import annotations

import argparse
import csv
import json
import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
SNAPSHOTS = REPO / "AIRTABLE" / "snapshots"
CATALOG_REDIRECTS = REPO / "apps" / "banana-catalog-prototype" / "catalog-redirects.json"

DOC = (
    "Manual slug/path renames. Rows with redirect_status=final in the Airtable "
    "301 REDIRECTS table are synced here by tools/sync_redirects_from_snapshot.py. "
    "from: old path (no trailing slash). to: canonical target (trailing slash on "
    "index/detail routes). Consumed by: client SPA guard, generate-route-redirects.mjs "
    "(static HTML), seo-worker (301)."
)


def latest_snapshot_date() -> str:
    dates = sorted(
        p.name
        for p in SNAPSHOTS.iterdir()
        if p.is_dir() and re.match(r"^\d{4}-\d{2}-\d{2}$", p.name)
    )
    if not dates:
        raise SystemExit(f"ERROR: no dated snapshot folders in {SNAPSHOTS}")
    return dates[-1]


def normalize_from_path(raw: str) -> str:
    path = raw.strip()
    if not path:
        return ""
    if not path.startswith("/"):
        path = f"/{path}"
    if path != "/" and path.endswith("/"):
        path = path.rstrip("/")
    return path


def normalize_to_path(raw: str) -> str:
    path = raw.strip()
    if not path:
        return ""
    if not path.startswith("/"):
        path = f"/{path}"
    return path


def load_final_redirects(clean_csv: Path) -> list[dict[str, str]]:
    entries: list[dict[str, str]] = []
    seen_from: set[str] = set()

    with clean_csv.open(encoding="utf-8", newline="") as fp:
        for row in csv.DictReader(fp):
            status = (row.get("redirect_status") or "").strip().lower()
            if status != "final":
                continue

            from_path = normalize_from_path(row.get("redirect_from") or "")
            to_path = normalize_to_path(row.get("redirect_to") or "")
            if not from_path or not to_path:
                continue
            if from_path in seen_from:
                raise SystemExit(
                    f"ERROR: duplicate redirect_from in {clean_csv.name}: {from_path!r}"
                )
            seen_from.add(from_path)

            entry: dict[str, str] = {"from": from_path, "to": to_path}
            note = (row.get("redirect_note") or "").strip()
            if note:
                entry["reason"] = note
            entries.append(entry)

    entries.sort(key=lambda e: e["from"])
    return entries


def write_catalog_redirects(entries: list[dict[str, str]]) -> None:
    payload = {"_doc": DOC, "redirects": entries}
    CATALOG_REDIRECTS.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "date",
        nargs="?",
        help="Snapshot date (YYYY-MM-DD). Defaults to latest dated folder.",
    )
    args = parser.parse_args()

    date = args.date or latest_snapshot_date()
    clean_csv = SNAPSHOTS / date / "clean" / f"301_redirects-{date}.csv"

    if not clean_csv.exists():
        print(f"sync_redirects: skip — no {clean_csv.relative_to(REPO)}")
        return 0

    entries = load_final_redirects(clean_csv)
    write_catalog_redirects(entries)
    print(
        f"sync_redirects: {clean_csv.relative_to(REPO)} → "
        f"{CATALOG_REDIRECTS.relative_to(REPO)} ({len(entries)} final redirects)"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
