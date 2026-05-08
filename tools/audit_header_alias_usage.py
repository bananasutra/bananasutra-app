#!/usr/bin/env python3
"""
Audit HEADER_MAP alias usage for Airtable snapshot exports.

This reports, per table:
  - headers present in the raw CSV
  - total mapping keys configured in tools/clean_airtable_snapshot.py
  - how many keys are used vs currently unused
  - a short preview of unused keys

Usage:
  python3 tools/audit_header_alias_usage.py
      # latest dated snapshot under AIRTABLE/snapshots/

  python3 tools/audit_header_alias_usage.py 2026-04-21
      # specific snapshot folder name
"""
from __future__ import annotations

import csv
import importlib.util
import re
import sys
from pathlib import Path


REPO = Path(__file__).resolve().parent.parent
SNAPSHOTS = REPO / "AIRTABLE" / "snapshots"
CLEANER = REPO / "tools" / "clean_airtable_snapshot.py"


def load_cleaner_module():
    spec = importlib.util.spec_from_file_location("clean_airtable_snapshot", CLEANER)
    if spec is None or spec.loader is None:
        raise RuntimeError("Could not load clean_airtable_snapshot module.")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def resolve_snapshot(arg: str | None) -> Path:
    if arg:
        p = SNAPSHOTS / arg
        if not p.exists():
            raise SystemExit(f"ERROR: snapshot folder not found: {p}")
        return p
    dated = sorted(
        p
        for p in SNAPSHOTS.iterdir()
        if p.is_dir() and re.match(r"^\d{4}-\d{2}-\d{2}$", p.name)
    )
    if not dated:
        raise SystemExit(f"ERROR: no dated snapshot folders in {SNAPSHOTS}")
    return dated[-1]


def main() -> int:
    mod = load_cleaner_module()
    snap = resolve_snapshot(sys.argv[1] if len(sys.argv) > 1 else None)
    date_stamp = snap.name

    print(f"Snapshot: {date_stamp}")

    for raw_prefix, map_key, _clean_prefix in mod.FILE_PATTERNS:
        raw_file = snap / f"{raw_prefix}-{date_stamp}.csv"
        if not raw_file.exists():
            continue

        with raw_file.open("r", encoding="utf-8") as f:
            reader = csv.reader(f)
            raw_headers = next(reader)

        normalized_headers = [mod.strip_bom_and_ws(h) for h in raw_headers]
        map_keys = set(mod.HEADER_MAP[map_key].keys())
        used_keys = set(h for h in normalized_headers if h in map_keys)
        unused_keys = sorted(map_keys - used_keys)

        print(f"\n[{raw_prefix}]")
        print(f"  headers in raw      : {len(normalized_headers)}")
        print(f"  mapping keys total  : {len(map_keys)}")
        print(f"  mapping keys used   : {len(used_keys)}")
        print(f"  mapping keys unused : {len(unused_keys)}")
        if unused_keys:
            preview = ", ".join(unused_keys[:12])
            suffix = " ..." if len(unused_keys) > 12 else ""
            print(f"  unused preview      : {preview}{suffix}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
