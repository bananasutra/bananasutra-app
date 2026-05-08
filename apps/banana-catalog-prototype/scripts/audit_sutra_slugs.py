#!/usr/bin/env python3
"""
Build-time slug uniqueness audit for sutra_context.json.

Each family key (KNOW, BLOW, …) exposes `url_slug_sutra` for future `/sutras/:slug` routes.
Fails if two families share the same slug or if a slug is empty.

Usage:
  python3 apps/banana-catalog-prototype/scripts/audit_sutra_slugs.py
"""

from __future__ import annotations

import argparse
import json
import sys
from collections import defaultdict
from pathlib import Path

from lyrics_url_slug import lyrics_title_to_url_slug

ROOT = Path(__file__).resolve().parents[3]
DEFAULT_CONTEXT = (
    ROOT
    / "apps"
    / "banana-catalog-prototype"
    / "src"
    / "data"
    / "generated"
    / "sutra_context.json"
)


def resolved_slug(family_key: str, row: dict) -> str:
    raw = str(row.get("url_slug_sutra") or "").strip()
    if raw:
        return raw
    label = str(row.get("sutra") or "").strip()
    if label:
        return lyrics_title_to_url_slug(label)
    return lyrics_title_to_url_slug(family_key)


def main() -> int:
    parser = argparse.ArgumentParser(description="Audit sutra_context url_slug_sutra uniqueness.")
    parser.add_argument(
        "--context",
        type=Path,
        default=DEFAULT_CONTEXT,
        help="Path to sutra_context.json",
    )
    args = parser.parse_args()
    path: Path = args.context
    if not path.is_file():
        print(f"ERROR: sutra_context not found: {path}", file=sys.stderr)
        return 1

    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        print("ERROR: sutra_context.json must be a JSON object", file=sys.stderr)
        return 1

    by_slug: dict[str, list[str]] = defaultdict(list)
    empty_slug_families: list[str] = []

    for family_key, row in data.items():
        if not isinstance(row, dict):
            continue
        slug = resolved_slug(str(family_key), row).strip()
        if not slug:
            empty_slug_families.append(str(family_key))
        by_slug[slug].append(str(family_key))

    dup_slugs = {s: keys for s, keys in by_slug.items() if len(keys) > 1}

    print(f"Context: {path}")
    print(f"Families: {len(data)}")
    print(f"Distinct slugs: {len(by_slug)}")
    print(f"Empty resolved slug: {len(empty_slug_families)}")
    if empty_slug_families:
        print(f"  keys: {', '.join(empty_slug_families)}")
    print(f"Duplicate slugs (collision): {len(dup_slugs)}")
    for slug in sorted(dup_slugs.keys()):
        keys = dup_slugs[slug]
        print(f"  {slug!r}  → families: {', '.join(keys)}")

    if dup_slugs or empty_slug_families:
        print("\nStatus: FAIL (duplicate or empty sutra URL slugs)")
        return 2
    print("\nStatus: OK (sutra slugs unique and non-empty)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
