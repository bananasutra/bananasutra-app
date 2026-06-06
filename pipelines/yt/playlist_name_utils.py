"""Shared playlist_name normalization for YT pipeline outputs."""
from __future__ import annotations

import csv
from pathlib import Path
from typing import Dict


def load_raw_to_clean(path: Path) -> Dict[str, str]:
    if not path.exists():
        return {}
    with open(path, encoding="utf-8-sig", newline="") as f:
        return {
            (r.get("raw_yt_title") or "").strip(): (r.get("cleaned_name") or "").strip()
            for r in csv.DictReader(f)
            if (r.get("raw_yt_title") or "").strip() and (r.get("cleaned_name") or "").strip()
        }


def load_name_aliases(path: Path) -> Dict[str, str]:
    """Legacy Airtable playlist_name → canonical cleaned name."""
    if not path.exists():
        return {}
    with open(path, encoding="utf-8-sig", newline="") as f:
        return {
            (r.get("from_name") or "").strip(): (r.get("to_name") or "").strip()
            for r in csv.DictReader(f)
            if (r.get("from_name") or "").strip() and (r.get("to_name") or "").strip()
        }


def canonical_playlist_name(
    name: str,
    raw_to_clean: Dict[str, str],
    aliases: Dict[str, str],
) -> str:
    n = (name or "").strip()
    if not n:
        return ""
    if n in raw_to_clean:
        return raw_to_clean[n]
    if n in aliases:
        return aliases[n]
    return n


def clean_playlist_names_cell(
    raw_value: str,
    raw_to_clean: Dict[str, str],
    aliases: Dict[str, str],
) -> str:
    """Replace raw/legacy playlist titles inside a comma-separated playlist_names cell."""
    if not raw_value:
        return raw_value
    cleaned = raw_value
    for raw in sorted(raw_to_clean.keys(), key=len, reverse=True):
        if raw and raw in cleaned:
            cleaned = cleaned.replace(raw, raw_to_clean[raw])
    for legacy in sorted(aliases.keys(), key=len, reverse=True):
        if legacy and legacy in cleaned:
            cleaned = cleaned.replace(legacy, aliases[legacy])
    return cleaned


def youtube_canonical_name_for_id(
    playlist_id: str,
    raw_by_title: Dict[str, Dict[str, str]],
    raw_to_clean: Dict[str, str],
) -> str:
    pid = (playlist_id or "").strip()
    if not pid:
        return ""
    for raw, meta in raw_by_title.items():
        if (meta.get("playlist_id") or "").strip() == pid:
            return canonical_playlist_name(raw, raw_to_clean, {})
    return ""
