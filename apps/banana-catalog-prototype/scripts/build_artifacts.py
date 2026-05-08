#!/usr/bin/env python3
"""
Build app artifacts for the BANANASUTRA song-first prototype.

Inputs:
  AIRTABLE/snapshots/<date>/clean/{lyrics,sc_tracks,sc_eps,songbooks,sc_playlists,sutras,muses,quotes,yt_videos}-<date>.csv

Outputs:
  src/data/generated/  song_catalog.json — one row per lyrics row with **song_in_app** (featured set);
    includes `has_in_app_playback`, `has_sc_catalog_listen` / `sc_catalog_listen_url` (when no primary SC EP:
    optional **human overrides** CSV, then ``AT-TRACKS-FULL-v4.csv`` **re-bucketed by ``lyrics_id`` from the
    same snapshot's ``sc_tracks``** (so Airtable link fixes apply without re-running the SC pipeline),
    then title-match on ``pipelines/sc/raw/bananasutra_sc_export.csv``), search-only blobs (songbook, muse, SC titles when present,
    capped lyrics head / muse quote — not full lyrics search)
  src/data/generated/song_catalog_browse.json — slimmer `/songs` browse payload (cards + filters + sorting fields;
    includes `track_count_published` for header “Browse all tracks” totals)
  src/data/generated/song_search_deep.json — deep meaning index (`lyrics_id` -> capped lyric text head)
  src/data/generated/song_detail.json — same featured set (tracks may be empty)
  src/data/generated/facets.json (includes SC `track_genre`, `track_instrument`, `track_mood`)
  src/data/generated/songbook_catalog.json — SONGBOOK rows with **songbook_in_app** + member featured songs; **playlist_artwork_url**
    prefers SoundCloud oEmbed thumbnail for the SC playlist URL (set cover), CSV ``artwork_url`` fallback
  src/data/generated/sutra_context.json — sutra context (question/practice/themes/mental_health_pivot,
    sutra_when/sutra_card_essence/sutra_essence, optional featured_ep from sc_eps when ep_featured)
  src/data/generated/home_quotes.json — quote pool from QUOTEs where **quote_in_app** is enabled
  src/data/generated/youtube_by_lyrics_id.json — YT rows from **clean ``yt_videos-<date>.csv``** (same pattern as
    SoundCloud: Airtable snapshot is source of truth for the catalog). Grouped by lyrics_id (plus a "" bucket when
    lyrics_id is blank). ``pipelines/yt/build_yt_final.py`` / ``AT-VIDEOS-final.csv`` remain for scrape metrics,
    drift QA, and Airtable import — not part of this build.
  src/data/generated/catalog_chrome_stats.json — tiny header strip counts (avoids loading full catalogs in GlobalHeader).
  src/data/generated/song_slug_index.json — slug → lyrics_id map for `/songs/:slug` routing (avoids loading full song_detail.json in songPaths).
  src/data/generated/track_catalog.json — flat list of in-app SoundCloud tracks (Phase 3 `/tracks`); sorted popularity then newest `created_at`.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import os
import re
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any

import sys

_TOOLS_DIR = str(Path(__file__).resolve().parents[3] / "tools")
if _TOOLS_DIR not in sys.path:
    sys.path.insert(0, _TOOLS_DIR)
from airtable_cell_newlines import collapse_airtable_separator_newlines

from lyrics_url_slug import lyrics_title_to_url_slug


ROOT = Path(__file__).resolve().parents[3]
SNAPSHOTS_DIR = ROOT / "AIRTABLE" / "snapshots"
OUTPUT_DIR = ROOT / "apps" / "banana-catalog-prototype" / "src" / "data" / "generated"
# Post-pipeline merge: scraped tracks joined to lyrics_id (best pick per lid + URL index).
SC_TRACKS_FULL_V4 = ROOT / "pipelines" / "sc" / "outputs" / "AT-TRACKS-FULL-v4.csv"
# Latest SoundCloud scrape (title / ep_title / artwork for export_title listen + cover title-match).
SC_RAW_EXPORT_CSV = ROOT / "pipelines" / "sc" / "raw" / "bananasutra_sc_export.csv"
# Optional human overrides — wins over automatic listen resolution (see file header).
SC_CATALOG_LISTEN_OVERRIDES = (
    ROOT / "apps" / "banana-catalog-prototype" / "data" / "sc_catalog_listen_overrides.csv"
)
# Optional human cover overrides — wins over SC EP/track-derived artwork.
SC_COVER_ART_OVERRIDES = (
    ROOT / "apps" / "banana-catalog-prototype" / "data" / "sc_cover_art_overrides.csv"
)

DEFAULT_TOP_TRACKS = 4
LIKE_WEIGHT = 40


@dataclass
class Config:
    snapshot_date: str
    top_tracks: int
    like_weight: int


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open("r", encoding="utf-8", newline="") as fp:
        reader = csv.DictReader(fp)
        return [dict(row) for row in reader]


def file_sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fp:
        for chunk in iter(lambda: fp.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def sutra_family_chrome(value: str) -> str:
    """Mirror `sutraFamily` in GlobalHeader.tsx — unique SUTRA facet buckets for the header stats line."""
    upper = (value or "").strip().upper()
    if upper.startswith("QUACK"):
        return "BLOW"
    if upper.startswith("KNOW"):
        return "KNOW"
    if upper.startswith("BLOW"):
        return "BLOW"
    if upper.startswith("SHOW"):
        return "SHOW"
    if upper.startswith("GROW"):
        return "GROW"
    if upper.startswith("FLOW"):
        return "FLOW"
    if upper.startswith("GLOW"):
        return "GLOW"
    if upper.startswith("BOW"):
        return "BOW"
    return upper


def build_catalog_chrome_stats(
    facets: dict[str, Any],
    song_catalog: list[dict[str, Any]],
    songbook_catalog: list[dict[str, Any]],
) -> dict[str, int]:
    sutra_entries = facets.get("sutra") or []
    sutra_families = {sutra_family_chrome(str(e.get("value") or "")) for e in sutra_entries}
    sutra_count = len(sutra_families)

    return {
        "sutraCount": sutra_count,
        "songbookCount": len(songbook_catalog),
        "songCount": len(song_catalog),
    }


def build_song_slug_index(song_detail: dict[str, dict[str, Any]]) -> dict[str, dict[str, str]]:
    """Slug → lyrics_id for client routing without loading full `song_detail.json` into songPaths."""
    by_slug: dict[str, str] = {}
    for lyrics_id in sorted(song_detail.keys()):
        rec = song_detail[lyrics_id]
        title = str(rec.get("lyrics_title") or "").strip()
        primary = catalog_url_slug(rec, title)
        by_slug[primary] = lyrics_id
        title_slug = lyrics_title_to_url_slug(title)
        if title_slug != primary:
            by_slug[title_slug] = lyrics_id
    return {"bySlug": by_slug}


def parse_int(value: str | None, default: int = 0) -> int:
    if not value:
        return default
    try:
        return int(str(value).strip())
    except ValueError:
        return default


def parse_bool(value: str | None) -> bool:
    if value is None:
        return False
    normalized = str(value).strip().lower()
    return normalized in {"1", "true", "yes", "y", "on", "checked"}


def parse_track_in_app(value: str | None) -> bool:
    """Default True when column missing or blank (new tracks should publish by default)."""
    if value is None or str(value).strip() == "":
        return True
    normalized = str(value).strip().lower()
    if normalized == "unchecked":
        return False
    return parse_bool(value)


def lyric_row_in_app(row: dict[str, str]) -> bool:
    return parse_bool(row.get("song_in_app"))


def catalog_url_slug(lyric: dict[str, str], display_title: str) -> str:
    """Public `/songs/:slug` segment: Airtable `url_slug` when set, else slugify(display_title)."""
    raw = str(lyric.get("url_slug") or "").strip()
    if raw:
        return raw
    return lyrics_title_to_url_slug(display_title)


def catalog_sutra_url_slug(row: dict[str, str], display_sutra: str) -> str:
    """Public `/sutras/:slug` segment (when wired): Airtable `url_slug_sutra` when set, else slugify(display_sutra)."""
    raw = str(row.get("url_slug_sutra") or "").strip()
    if raw:
        return raw
    return lyrics_title_to_url_slug(display_sutra)


def catalog_songbook_url_slug(meta: dict[str, str] | None, book_name: str) -> str:
    """Public `/songbooks/:slug` segment: Airtable `url_slug_songbook` when set, else slugify(book_name)."""
    raw = str((meta or {}).get("url_slug_songbook") or "").strip()
    if raw:
        return raw
    return lyrics_title_to_url_slug(book_name)


def parse_duration_to_seconds(value: str | None) -> int:
    if not value:
        return 0
    text = str(value).strip()
    if not text:
        return 0
    parts = text.split(":")
    try:
        numbers = [int(part) for part in parts]
    except ValueError:
        return 0
    if len(numbers) == 2:
        return numbers[0] * 60 + numbers[1]
    if len(numbers) == 3:
        return numbers[0] * 3600 + numbers[1] * 60 + numbers[2]
    return 0


def split_multi(value: str | None) -> list[str]:
    if not value:
        return []
    raw = str(value).replace("\n", ",")
    out: list[str] = []
    for token in raw.split(","):
        cleaned = token.strip()
        if cleaned:
            out.append(cleaned)
    return out


def parse_linked_record_titles(value: str | None) -> list[str]:
    """
    Parse Airtable linked-record CSV cell values where individual titles may include commas
    and are quoted (example: Creeps,"Hey, You (Creepers)").
    """
    raw = str(value or "").strip()
    if not raw:
        return []
    try:
        row = next(csv.reader([raw], skipinitialspace=True), [])
    except csv.Error:
        return split_multi(raw)
    out: list[str] = []
    for token in row:
        s = str(token or "").strip()
        if s:
            out.append(s)
    return dedupe_preserve_order(out)


def dedupe_preserve_order(values: list[str]) -> list[str]:
    out: list[str] = []
    seen: set[str] = set()
    for value in values:
        token = str(value or "").strip()
        if not token:
            continue
        key = token.lower()
        if key in seen:
            continue
        seen.add(key)
        out.append(token)
    return out


def normalize_text_key(value: str | None) -> str:
    """Loose key for cross-table name matching (songbook / playlist labels)."""
    text = str(value or "").strip().lower()
    if not text:
        return ""
    chunks: list[str] = []
    current: list[str] = []
    for ch in text:
        if ch.isalnum():
            current.append(ch)
            continue
        if current:
            chunks.append("".join(current))
            current = []
    if current:
        chunks.append("".join(current))
    return " ".join(chunks)


def resolve_related_lyrics_ids(
    *,
    current_lyrics_id: str,
    related_titles: list[str],
    title_exact_map: dict[str, list[str]],
    title_norm_map: dict[str, list[str]],
) -> list[str]:
    out: list[str] = []
    seen: set[str] = set()
    for title in related_titles:
        raw = str(title or "").strip()
        if not raw:
            continue
        exact_hits = title_exact_map.get(raw.lower(), [])
        norm_hits = title_norm_map.get(normalize_text_key(raw), [])
        candidates = exact_hits if exact_hits else norm_hits
        picked = ""
        for lid in candidates:
            if lid and lid != current_lyrics_id:
                picked = lid
                break
        if not picked:
            continue
        if picked in seen:
            continue
        seen.add(picked)
        out.append(picked)
    return out


def parse_datetime(value: str | None) -> str:
    if not value:
        return ""
    text = str(value).strip()
    if not text:
        return ""
    # Keep as ISO-like string when parseable, else return original.
    for fmt in (
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%dT%H:%M",
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d %H:%M",
        "%Y-%m-%d",
    ):
        try:
            dt = datetime.strptime(text, fmt)
            return dt.isoformat()
        except ValueError:
            continue
    return text


def latest_track_created_at(tracks: list[dict[str, Any]], *, published_only: bool) -> str:
    """Latest `created_at` among tracks (SoundCloud row time). Empty if none parseable."""
    best = ""
    for t in tracks:
        if published_only and not t["track_in_app"]:
            continue
        raw = str(t.get("created_at") or "").strip()
        if not raw:
            continue
        normalized = parse_datetime(raw)
        candidate = normalized or raw
        if candidate > best:
            best = candidate
    return best


def soundcloud_catalog_sort_at(ep_created_at: str, tracks: list[dict[str, Any]]) -> str:
    """
    Single timestamp for catalog "newest" ordering.

    Uses only SoundCloud EP and track `created_at`: max(EP, latest **published** track).
    If both are missing, falls back to latest track including unpublished rows.

    LYRICS fields are not read here (see `lyrics_fallback_catalog_at` when there are no
    SC rows). Lyrics `year_created` is never used for this key — writing era, not publish.
    """
    ep = (ep_created_at or "").strip()
    pub = latest_track_created_at(tracks, published_only=True)
    primary = max([s for s in (ep, pub) if s], default="")
    if primary:
        return primary
    return latest_track_created_at(tracks, published_only=False)


def lyrics_fallback_catalog_at(lyric: dict[str, str]) -> str:
    """When there are no SC track rows, use LYRICS `date_created` only for catalog ordering.

    Do not use `last_modified`: it reflects edits, not when the song entered the corpus,
    and would reorder rows incorrectly for \"newest\" vs first publication.
    """
    raw = str(lyric.get("date_created") or "").strip()
    if raw:
        normalized = parse_datetime(raw)
        return normalized or raw
    return ""


def score_track(track: dict[str, Any], like_weight: int) -> int:
    return int(track["play_count"]) + like_weight * int(track["like_count"])


def build_track_catalog_flat(
    song_detail: dict[str, dict[str, Any]],
    cards_by_lyrics_id: dict[str, dict[str, Any]],
    like_weight: int,
) -> list[dict[str, Any]]:
    """One JSON object per `track_in_app` row with `sc_url`, for `/tracks`. Parent song join fields added."""
    rows: list[dict[str, Any]] = []
    for lyrics_id, detail in song_detail.items():
        card = cards_by_lyrics_id.get(lyrics_id) or {}
        pub_at = str(card.get("published_at") or "")
        cover = str(detail.get("cover_image_url") or "")
        slug = str(detail.get("url_slug") or "").strip()
        for t in detail.get("tracks") or []:
            if not t.get("track_in_app"):
                continue
            sc = str(t.get("sc_url") or "").strip()
            if not sc:
                continue
            score = score_track(t, like_weight)
            art = str(t.get("artwork_url") or "").strip()
            row = dict(t)
            row["url_slug"] = slug
            row["list_cover_url"] = art or cover
            row["song_published_at"] = pub_at
            row["popularity_score"] = score
            rows.append(row)
    # Stable: lowest keys first for ties; then reverse sorts apply last-wins for primaries.
    rows.sort(key=lambda r: str(r.get("track_id") or ""))
    rows.sort(key=lambda r: str(r.get("created_at") or ""), reverse=True)
    rows.sort(key=lambda r: int(r.get("popularity_score") or 0), reverse=True)
    return rows


def select_best_tracks(
    tracks: list[dict[str, Any]],
    top_tracks: int,
    like_weight: int,
) -> list[dict[str, Any]]:
    """Preview picks: only `track_in_app` rows; fav picks first, then popularity."""
    pool = [t for t in tracks if t["track_in_app"]]
    if not pool:
        return []

    favs = [t for t in pool if t["fav_track"]]
    favs.sort(
        key=lambda t: (score_track(t, like_weight), t["play_count"], t["like_count"]),
        reverse=True,
    )

    rest = [t for t in pool if not t["fav_track"]]
    rest.sort(
        key=lambda t: (score_track(t, like_weight), t["play_count"], t["like_count"]),
        reverse=True,
    )

    ordered = favs + rest
    return ordered[:top_tracks]


def sort_tracks_for_detail(tracks: list[dict[str, Any]], like_weight: int) -> list[dict[str, Any]]:
    """Full track list: published tracks first (fav, then score), then hidden-from-app last."""

    def rank_key(t: dict[str, Any]) -> tuple[int, int, int]:
        return (score_track(t, like_weight), int(t["play_count"]), int(t["like_count"]))

    published = [t for t in tracks if t["track_in_app"]]
    fav_pub = [t for t in published if t["fav_track"]]
    fav_pub.sort(key=rank_key, reverse=True)
    rest_pub = [t for t in published if not t["fav_track"]]
    rest_pub.sort(key=rank_key, reverse=True)

    unpublished = [t for t in tracks if not t["track_in_app"]]
    unpublished.sort(key=rank_key, reverse=True)

    return fav_pub + rest_pub + unpublished


def collect_track_genres(tracks: list[dict[str, Any]], *, published_only: bool) -> list[str]:
    """Primary genres for filtering/facets (one per track)."""
    genres: set[str] = set()
    for track in tracks:
        if published_only and not track["track_in_app"]:
            continue
        primary = str(track.get("primary_genre") or "").strip()
        if primary:
            genres.add(primary)
    return sorted(genres)


def collect_secondary_genres(tracks: list[dict[str, Any]], *, published_only: bool) -> list[str]:
    out: set[str] = set()
    for track in tracks:
        if published_only and not track["track_in_app"]:
            continue
        for value in track.get("secondary_genres", []):
            token = str(value or "").strip()
            if token:
                out.add(token)
    return sorted(out)


def collect_track_instruments(tracks: list[dict[str, Any]], *, published_only: bool) -> list[str]:
    out: set[str] = set()
    for track in tracks:
        if published_only and not track["track_in_app"]:
            continue
        for value in track.get("instruments", []):
            token = str(value or "").strip()
            if token:
                out.add(token)
    return sorted(out)


def collect_track_moods(tracks: list[dict[str, Any]], *, published_only: bool) -> list[str]:
    out: set[str] = set()
    for track in tracks:
        if published_only and not track["track_in_app"]:
            continue
        token = str(track.get("mood") or "").strip()
        if token:
            out.add(token)
    return sorted(out)


def discovery_top_track_genres_line(detail_tracks: list[dict[str, Any]]) -> str:
    """Single-line genre label for the lead in-app track (same order as song detail / default player)."""
    for track in detail_tracks:
        if not track.get("track_in_app"):
            continue
        tokens: list[str] = []
        tokens.extend(split_multi(str(track.get("primary_genre") or "")))
        for value in track.get("secondary_genres") or []:
            s = str(value or "").strip()
            if s:
                tokens.append(s)
        # Omit raw `genres` list — it duplicates primary_genre when Airtable stores a CSV blob there.
        seen_lower: set[str] = set()
        ordered: list[str] = []
        for raw in tokens:
            piece = raw.strip()
            if not piece:
                continue
            low = piece.lower()
            if low in seen_lower:
                continue
            seen_lower.add(low)
            ordered.append(piece)
        return ", ".join(ordered)
    return ""


# Search-only blobs (not shown in UI): shallow lyrics window + optional muse quote.
SEARCH_LYRICS_HEAD_MAX = 1200
SEARCH_MUSE_QUOTE_MAX = 8000

SONGBOOK_ALIASES: dict[str, str] = {
    "LANG: FRENCH": "World: FRENCHsutra",
    "LANG: SPANISH": "World: SPANISHsutra",
    "LANG: RUSSIAN": "World: RUSSIANsutra",
}
SONGBOOK_ALIAS_KEYS_UPPER = {k.upper() for k in SONGBOOK_ALIASES}
TRACK_OPTIONAL_FIELD_ALIASES: dict[str, list[str]] = {
    "mood": ["mood", "track_mood"],
    "tempo_feel": ["tempo_feel", "upbeat_downbeat", "energy", "speed_feel"],
    "curation_rating": ["curation_rating", "track_rating", "rating_track"],
}


def songbook_alias_target(label: str) -> str:
    key = str(label or "").strip().upper()
    for old, new in SONGBOOK_ALIASES.items():
        if old.upper() == key:
            return new
    return ""


def trim_for_search_blob(value: str | None, max_len: int) -> str:
    raw = str(value or "").strip()
    if not raw:
        return ""
    if len(raw) <= max_len:
        return raw
    return raw[:max_len]


def first_non_empty(row: dict[str, Any], keys: list[str]) -> str:
    for key in keys:
        value = str(row.get(key) or "").strip()
        if value:
            return value
    return ""


def collect_soundcloud_title_blob(tracks: list[dict[str, Any]], *, published_only: bool) -> str:
    """Deduped track + EP titles from published SC rows (songbook-style names often appear here)."""
    parts: list[str] = []
    seen: set[str] = set()
    for t in tracks:
        if published_only and not t["track_in_app"]:
            continue
        for key in ("track_title", "ep_title"):
            s = str(t.get(key) or "").strip()
            if not s:
                continue
            low = s.lower()
            if low in seen:
                continue
            seen.add(low)
            parts.append(s)
    return " ".join(parts)


def latest_snapshot_date() -> str:
    candidates = [
        p.name
        for p in SNAPSHOTS_DIR.iterdir()
        if p.is_dir() and re.match(r"^\d{4}-\d{2}-\d{2}$", p.name)
    ]
    if not candidates:
        raise RuntimeError("No YYYY-MM-DD snapshot directories found.")
    return sorted(candidates)[-1]


def build_paths(snapshot_date: str) -> dict[str, Path]:
    clean = SNAPSHOTS_DIR / snapshot_date / "clean"
    return {
        "lyrics": clean / f"lyrics-{snapshot_date}.csv",
        "sc_tracks": clean / f"sc_tracks-{snapshot_date}.csv",
        "sc_eps": clean / f"sc_eps-{snapshot_date}.csv",
        "songbooks": clean / f"songbooks-{snapshot_date}.csv",
        "sc_playlists": clean / f"sc_playlists-{snapshot_date}.csv",
        "sutras": clean / f"sutras-{snapshot_date}.csv",
        "muses": clean / f"muses-{snapshot_date}.csv",
        "quotes": clean / f"quotes-{snapshot_date}.csv",
        "yt_videos": clean / f"yt_videos-{snapshot_date}.csv",
    }


def build_muse_visibility_index(muse_rows: list[dict[str, str]]) -> dict[str, bool]:
    out: dict[str, bool] = {}
    for row in muse_rows:
        muse_name = str(row.get("muse") or "").strip()
        if not muse_name:
            continue
        out[muse_name.lower()] = parse_bool(row.get("muse_in_app"))
    return out


def filter_song_detail_muse(raw_muse: str, muse_visibility: dict[str, bool]) -> str:
    tokens = split_multi(raw_muse)
    if not tokens:
        return ""
    visible: list[str] = []
    for token in tokens:
        normalized = token.strip()
        if not normalized:
            continue
        if normalized.lower() == "anonymous anonymous":
            continue
        visibility = muse_visibility.get(normalized.lower())
        if visibility is False:
            continue
        visible.append(normalized)
    return ",".join(dedupe_preserve_order(visible))


def sutra_family_key_from_field(raw_sutra: str) -> str:
    upper = str(raw_sutra or "").strip().upper()
    for prefix in ("KNOW", "BLOW", "QUACK", "SHOW", "GROW", "FLOW", "GLOW", "BOW"):
        if upper.startswith(prefix):
            return prefix
    return ""


def build_sutra_context(sutra_rows: list[dict[str, str]]) -> dict[str, dict[str, Any]]:
    out: dict[str, dict[str, Any]] = {}
    for row in sutra_rows:
        raw_sutra = str(row.get("sutra") or "").strip()
        key = sutra_family_key_from_field(raw_sutra)
        if not key:
            continue
        out[key] = {
            "sutra": raw_sutra,
            "sutra_id": str(row.get("sutra_id") or "").strip(),
            "question": str(row.get("question") or "").strip(),
            "practice": str(row.get("practice") or "").strip(),
            "themes": str(row.get("themes") or "").strip(),
            "mental_health_pivot": str(row.get("mental_health_pivot") or "").strip(),
            "sutra_when": str(row.get("sutra_when") or "").strip(),
            "sutra_card_essence": str(row.get("sutra_card_essence") or "").strip(),
            "sutra_essence": str(row.get("sutra_essence") or "").strip(),
            "url_slug_sutra": catalog_sutra_url_slug(row, raw_sutra),
            "url_sutra_locked": parse_bool(row.get("url_sutra_locked")),
        }
    return out


def merge_featured_eps_into_sutra_context(
    ctx: dict[str, dict[str, Any]],
    sc_eps_rows: list[dict[str, str]],
) -> None:
    """Attach at most one featured EP per sutra family (`ep_featured`); tie-break: highest total_plays."""
    best: dict[str, tuple[int, dict[str, Any]]] = {}
    for row in sc_eps_rows:
        if not parse_bool(row.get("ep_featured")):
            continue
        fam = sutra_family_key_from_field(str(row.get("sutra") or ""))
        if not fam or fam not in ctx:
            continue
        plays = parse_int(row.get("total_plays"))
        payload = {
            "ep_url": str(row.get("ep_url") or "").strip(),
            "ep_title": str(row.get("ep_title") or "").strip(),
            "ep_description": str(row.get("ep_description") or "").strip(),
            "ep_songbook_title": str(row.get("ep_songbook_title") or "").strip(),
            "total_plays": plays,
            "total_likes": parse_int(row.get("total_likes")),
            "ep_total_tracks": parse_int(row.get("ep_total_tracks")),
            "created_at": str(row.get("created_at") or "").strip(),
            "artwork_url": str(row.get("artwork_url") or "").strip(),
            "artwork_lg_url": str(row.get("artwork_lg_url") or "").strip(),
        }
        prev = best.get(fam)
        if not prev or plays > prev[0]:
            best[fam] = (plays, payload)
    for fam, (_, payload) in best.items():
        ctx[fam]["featured_ep"] = payload


def build_home_quotes(quotes_rows: list[dict[str, str]]) -> list[dict[str, str]]:
    out: list[dict[str, str]] = []
    for row in quotes_rows:
        if not parse_bool(row.get("quote_in_app")):
            continue
        quote = str(row.get("quote") or "").strip()
        if not quote:
            continue
        out.append(
            {
                "quote": quote,
                "muse": str(row.get("muse") or "").strip(),
                "primary_sutra": str(row.get("primary_sutra") or "").strip(),
                "secondary_sutras": str(row.get("secondary_sutras") or "").strip(),
                "core_topic": str(row.get("core_topic") or "").strip(),
                "quote_id": str(row.get("quote_id") or "").strip(),
            }
        )
    out.sort(
        key=lambda row: (
            parse_int(str(row.get("quote_id") or "").replace("Q-", "")),
            str(row.get("quote") or "").lower(),
        )
    )
    return out


def normalize_track_row(row: dict[str, str]) -> dict[str, Any]:
    legacy_genres = split_multi(row.get("genres"))
    primary_tokens = split_multi(
        row.get("genre_primary") or row.get("primary_genre")
    )
    explicit_primary = primary_tokens[0] if primary_tokens else ""
    explicit_secondary = split_multi(
        row.get("secondary_genres") or row.get("genre_secondary") or row.get("secondary_genre")
    )
    # Preferred source is curated primary + secondary. Fall back to legacy `genres`
    # only when explicit fields are empty (older snapshots).
    if explicit_primary or explicit_secondary:
        raw_genres = dedupe_preserve_order(
            ([explicit_primary] if explicit_primary else []) + explicit_secondary
        )
    else:
        raw_genres = legacy_genres
    primary_genre = explicit_primary or (raw_genres[0] if raw_genres else "")
    inferred_secondary = [
        g for g in raw_genres if g.strip().lower() != primary_genre.strip().lower()
    ]
    secondary_genres = dedupe_preserve_order(explicit_secondary + inferred_secondary)
    track_in_app = parse_track_in_app(row.get("track_in_app"))
    return {
        "track_id": row.get("track_id", "").strip(),
        "lyrics_id": row.get("lyrics_id", "").strip(),
        "track_title": row.get("track_title", "").strip(),
        "lyrics_title": row.get("lyrics_title", "").strip(),
        "sc_url": row.get("sc_url", "").strip(),
        "play_count": parse_int(row.get("play_count")),
        "like_count": parse_int(row.get("like_count")),
        "duration_sec": parse_duration_to_seconds(row.get("duration")),
        "duration_raw": row.get("duration", "").strip(),
        "genres": raw_genres,
        "primary_genre": primary_genre,
        "secondary_genres": secondary_genres,
        "soundcloud_genre": row.get("soundcloud_genre", "").strip(),
        "secondary_genre": secondary_genres[0] if secondary_genres else "",
        "instruments": split_multi(row.get("instruments")),
        "ep_title": row.get("ep_title", "").strip(),
        "ep_url": row.get("ep_url", "").strip(),
        "ep_track_number": parse_int(row.get("ep_track_number")),
        "ep_total_tracks": parse_int(row.get("ep_total_tracks")),
        "created_at": parse_datetime(row.get("created_at")),
        "artwork_url": row.get("artwork_url", "").strip(),
        "waveform_url": row.get("waveform_url", "").strip(),
        "bpm": parse_int(row.get("bpm")),
        "track_status": row.get("track_status", "").strip(),
        "track_in_app": track_in_app,
        "fav_track": parse_bool(row.get("fav_track")),
        "mood": first_non_empty(row, TRACK_OPTIONAL_FIELD_ALIASES["mood"]),
        "tempo_feel": first_non_empty(row, TRACK_OPTIONAL_FIELD_ALIASES["tempo_feel"]),
        "curation_rating": first_non_empty(row, TRACK_OPTIONAL_FIELD_ALIASES["curation_rating"]),
        "sutra": str(row.get("sutra") or "").strip(),
    }


def choose_artwork(
    lyrics_id: str,
    all_tracks: list[dict[str, Any]],
    ordered_tracks: list[dict[str, Any]],
    ep_index: dict[str, dict[str, Any]],
) -> str:
    ep = ep_index.get(lyrics_id)
    has_ep_backed_track = any(str(t.get("ep_url") or "").strip() for t in all_tracks)
    # When tracks link to an EP, prefer EP artwork (single vs EP cover mismatch).
    if ep and ep.get("artwork_url") and has_ep_backed_track:
        return str(ep["artwork_url"])
    for track in ordered_tracks:
        if track.get("artwork_url"):
            return str(track["artwork_url"])
    # No usable track art: still use SC EP row art when linked (e.g. lyrics featured but
    # no rows in filtered SC TRACKs export — cover still exists on the EP).
    if ep and ep.get("artwork_url"):
        return str(ep["artwork_url"])
    return ""


def _norm_soundcloud_url(url: str) -> str:
    u = str(url or "").strip().rstrip("/").lower()
    if not u:
        return ""
    if "?" in u:
        u = u.split("?", 1)[0]
    return u


def normalize_title_for_match(value: str | None) -> str:
    text = str(value or "").strip().lower()
    if not text:
        return ""
    chars: list[str] = []
    prev_space = False
    for ch in text:
        if ch.isalnum():
            chars.append(ch)
            prev_space = False
            continue
        if not prev_space:
            chars.append(" ")
            prev_space = True
    return "".join(chars).strip()


def title_match_score(target: str, candidate: str) -> int:
    if not target or not candidate:
        return 0
    if candidate == target:
        return 100
    padded = f" {candidate} "
    phrase = f" {target} "
    if phrase in padded:
        return 90
    if candidate.startswith(target + " ") or candidate.endswith(" " + target):
        return 85
    return 0


def title_lead_bonus(target: str, track_title_norm: str) -> int:
    if not target or not track_title_norm:
        return 0
    if track_title_norm.startswith(target + " ") or track_title_norm.startswith(target + "("):
        return 8
    return 0


def load_soundcloud_raw_export_listen_rows(path: Path) -> list[dict[str, Any]]:
    """Track-level rows from ``bananasutra_sc_export.csv`` (no ``/sets/`` URLs) for listen + cover fallbacks."""
    if not path.is_file():
        return []
    with path.open("r", encoding="utf-8-sig", newline="") as fp:
        reader = csv.DictReader(fp)
        raw_rows = [dict(row) for row in reader]
    out: list[dict[str, Any]] = []
    for row in raw_rows:
        url = str(row.get("sc_url") or "").strip()
        if not url or "/sets/" in url:
            continue
        tit = str(row.get("title") or "").strip()
        out.append(
            {
                "raw_url": url,
                "raw_title": tit,
                "norm_url": _norm_soundcloud_url(url),
                "title_norm": normalize_title_for_match(tit),
                "ep_title_norm": normalize_title_for_match(row.get("ep_title")),
                "play_count": parse_int(row.get("play_count")),
            }
        )
    return out


def pick_listen_url_from_soundcloud_export_rows(
    rows: list[dict[str, Any]],
    lyrics_title_raw: str | None,
    fallback_sc_url: str,
) -> tuple[str, str]:
    """
    Return (sc_url, track_title) using title heuristics on the raw scrape export.
    Prefer ``fallback_sc_url`` exact match when set.
    """
    fb = _norm_soundcloud_url(fallback_sc_url)
    if fb:
        for r in rows:
            if r["norm_url"] == fb:
                return str(r["raw_url"] or "").strip(), str(r["raw_title"] or "").strip()
    target = normalize_title_for_match(lyrics_title_raw)
    if not target:
        return "", ""
    best: tuple[int, int, int, str, str] | None = None
    for r in rows:
        tn = str(r.get("title_norm") or "")
        en = str(r.get("ep_title_norm") or "")
        st_title = title_match_score(target, tn)
        st_ep = title_match_score(target, en)
        title_eff = min(100, st_title + title_lead_bonus(target, tn))
        score = max(title_eff, st_ep)
        if score == 0:
            continue
        plays = int(r.get("play_count") or 0)
        title_len = len(tn) if title_eff >= st_ep else len(en)
        cand = (score, -title_len, plays, str(r["raw_url"]), str(r["raw_title"]))
        if best is None or cand > best:
            best = cand
    if best is None:
        return "", ""
    return best[3].strip(), best[4].strip()


def track_title_from_export_rows_by_norm_url(rows: list[dict[str, Any]], norm: str) -> str:
    if not norm:
        return ""
    for r in rows:
        if r["norm_url"] == norm:
            return str(r["raw_title"] or "").strip()
    return ""


def fill_catalog_covers_from_soundcloud_raw_export(
    song_catalog: list[dict[str, Any]],
    *,
    export_csv: Path | None,
    skip_lyrics_ids: set[str] | None = None,
) -> int:
    """
    Remaining blank covers: title / EP substring match on ``bananasutra_sc_export.csv`` (same
    heuristics as listen). Never replaces a non-empty cover.
    """
    if not export_csv or not export_csv.is_file():
        return 0
    with export_csv.open("r", encoding="utf-8-sig", newline="") as fp:
        reader = csv.DictReader(fp)
        rows = [dict(row) for row in reader]
    prepared: list[dict[str, Any]] = []
    for row in rows:
        artwork = str(row.get("artwork_url") or "").strip()
        if not artwork:
            continue
        prepared.append(
            {
                "artwork_url": artwork,
                "sc_url": _norm_soundcloud_url(str(row.get("sc_url") or "")),
                "play_count": parse_int(row.get("play_count")),
                "title_norm": normalize_title_for_match(row.get("title")),
                "ep_title_norm": normalize_title_for_match(row.get("ep_title")),
            }
        )

    filled = 0
    for song in song_catalog:
        lid = str(song.get("lyrics_id") or "").strip()
        if skip_lyrics_ids and lid in skip_lyrics_ids:
            continue
        if str(song.get("cover_image_url") or "").strip():
            continue
        fb = _norm_soundcloud_url(str(song.get("fallback_sc_url") or ""))
        if fb:
            for row in prepared:
                if row.get("sc_url") == fb:
                    song["cover_image_url"] = str(row.get("artwork_url") or "")
                    filled += 1
                    break
            if str(song.get("cover_image_url") or "").strip():
                continue
        target = normalize_title_for_match(song.get("lyrics_title"))
        if not target:
            continue
        best: tuple[int, int, int, str] | None = None
        for row in prepared:
            tn = str(row.get("title_norm") or "")
            en = str(row.get("ep_title_norm") or "")
            st_title = title_match_score(target, tn)
            st_ep = title_match_score(target, en)
            title_eff = min(100, st_title + title_lead_bonus(target, tn))
            score = max(title_eff, st_ep)
            if score == 0:
                continue
            plays = int(row.get("play_count") or 0)
            artwork = str(row.get("artwork_url") or "")
            title_len = len(tn) if title_eff >= st_ep else len(en)
            candidate = (score, -title_len, plays, artwork)
            if best is None or candidate > best:
                best = candidate
        if best is None:
            continue
        song["cover_image_url"] = best[3]
        filled += 1
    return filled


def fill_catalog_covers_from_sc_tracks_full_v4(
    song_catalog: list[dict[str, Any]],
    *,
    by_lyrics_id: dict[str, dict[str, str]],
    by_norm_url: dict[str, dict[str, str]],
    skip_lyrics_ids: set[str] | None = None,
) -> int:
    """
    For songs still missing cover art: use ``AT-TRACKS-FULL-v4`` only — exact ``fallback_sc_url``
    match to any row, else best track's ``artwork_url`` for that ``lyrics_id``. Never replaces a
    non-empty cover.
    """
    filled = 0
    for song in song_catalog:
        lid = str(song.get("lyrics_id") or "").strip()
        if skip_lyrics_ids and lid in skip_lyrics_ids:
            continue
        if str(song.get("cover_image_url") or "").strip():
            continue
        fb = _norm_soundcloud_url(str(song.get("fallback_sc_url") or ""))
        if fb and fb in by_norm_url:
            art = str(by_norm_url[fb].get("artwork_url") or "").strip()
            if art:
                song["cover_image_url"] = art
                filled += 1
                continue
        hit = by_lyrics_id.get(lid)
        if hit:
            art = str(hit.get("artwork_url") or "").strip()
            if art:
                song["cover_image_url"] = art
                filled += 1
    return filled


def create_facets(cards: list[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
    # Key order is preserved in Python 3.7+ and drives default UI facet order.
    counters: dict[str, Counter[str]] = {
        "sutra": Counter(),
        "light_shadow": Counter(),
        "topic": Counter(),
        "intention": Counter(),
        "written_year": Counter(),
        "track_genre": Counter(),
        "track_secondary_genre": Counter(),
        "track_instrument": Counter(),
        "track_mood": Counter(),
        "lang": Counter(),
    }
    for card in cards:
        if card["sutra"]:
            counters["sutra"][card["sutra"]] += 1
        if card["light_shadow"]:
            counters["light_shadow"][card["light_shadow"]] += 1
        if card["topic"]:
            counters["topic"][card["topic"]] += 1
        if card["intention"]:
            counters["intention"][card["intention"]] += 1
        wy = str(card.get("written_year") or "").strip()
        if wy:
            counters["written_year"][wy] += 1
        if card["lang"]:
            counters["lang"][card["lang"]] += 1
        for genre in card["track_genres"]:
            counters["track_genre"][genre] += 1
        for genre in card["track_secondary_genres"]:
            counters["track_secondary_genre"][genre] += 1
        for instrument in card.get("track_instruments", []):
            counters["track_instrument"][instrument] += 1
        for mood in card.get("track_moods", []):
            if mood:
                counters["track_mood"][mood] += 1

    facets: dict[str, list[dict[str, Any]]] = {}
    for key, counter in counters.items():
        facets[key] = [
            {"value": value, "count": count}
            for value, count in sorted(counter.items(), key=lambda item: (-item[1], item[0].lower()))
        ]
    return facets


def build_song_catalog_browse(song_catalog: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Fields needed for `/songs` browse/filter/sort/search without heavy long-text blobs."""
    keys = [
        "lyrics_id",
        "lyrics_title",
        "url_slug",
        "summary_short",
        "lyrics_extract",
        "sutra",
        "topic",
        "intention",
        "light_shadow",
        "lang",
        "written_year",
        "published_at",
        "cover_image_url",
        "track_genres",
        "track_secondary_genres",
        "track_instruments",
        "track_moods",
        "discovery_top_track_genres",
        "track_count_published",
        "aggregate_play_count",
        "aggregate_like_count",
        "peak_play_count",
        "peak_like_count",
        "primary_ep_url",
        "has_in_app_playback",
        "has_sc_catalog_listen",
        "has_youtube_video",
        "has_youtube_embed",
        "songbook",
        "muse",
        "song_muse_quote",
    ]
    out: list[dict[str, Any]] = []
    for row in song_catalog:
        out.append({k: row.get(k) for k in keys})
    return out


def build_song_search_deep(song_catalog: list[dict[str, Any]]) -> dict[str, str]:
    """Deep meaning index for progressive search refinement (`lyrics_id` -> lyric head text)."""
    out: dict[str, str] = {}
    for row in song_catalog:
        lid = str(row.get("lyrics_id") or "").strip()
        if not lid:
            continue
        out[lid] = str(row.get("lyrics_head_search") or "")
    return out


EDITION_TITLE_RE = re.compile(r"^\s*(?P<base>.+?)\s*\((?P<label>[^)]*edition[^)]*)\)\s*$", re.IGNORECASE)


def find_edition_link_gaps(song_detail: dict[str, dict[str, Any]]) -> list[dict[str, Any]]:
    """Report edition rows missing EP and/or related links (for source-data QA)."""
    out: list[dict[str, Any]] = []
    for lid, row in song_detail.items():
        title = str(row.get("lyrics_title") or "").strip()
        if not EDITION_TITLE_RE.match(title):
            continue
        missing_ep = not bool(str(row.get("primary_ep_url") or "").strip())
        related_count = len(row.get("related_songs") or [])
        missing_related = related_count == 0
        if not (missing_ep or missing_related):
            continue
        out.append(
            {
                "lyrics_id": lid,
                "lyrics_title": title,
                "missing_primary_ep_url": missing_ep,
                "missing_related_songs": missing_related,
                "related_count": related_count,
                "track_count": len(row.get("tracks") or []),
            }
        )
    out.sort(key=lambda r: str(r.get("lyrics_title") or "").lower())
    return out


def normalize_songbook_label(label: str) -> str:
    text = str(label or "").strip()
    if not text:
        return ""
    return songbook_alias_target(text) or text


def songbook_tokens(raw: str | None) -> list[str]:
    # Songbook field is often comma-separated in lyrics rows.
    return dedupe_preserve_order([normalize_songbook_label(token) for token in split_multi(raw)])


def primary_songbook(raw: str | None) -> str:
    tokens = songbook_tokens(raw)
    if not tokens:
        return ""
    # Prefer non-language/world labels for song-level display links.
    for token in tokens:
        if not token.lower().startswith("world:"):
            return token
    return tokens[0]


def songbook_row_in_app(meta: dict[str, str] | None) -> bool:
    """SONGBOOKs gate for catalog: missing column (older exports) defaults to True."""
    if not meta:
        return True
    if "songbook_in_app" not in meta:
        return True
    return parse_bool(meta.get("songbook_in_app"))


def soundcloud_oembed_thumbnail(playlist_url: str, *, timeout: float = 15.0) -> str:
    """Resolve playlist/set thumbnail via SoundCloud oEmbed (canonical playlist artwork).

    Airtable ``artwork_url`` on SC Playlists is sometimes populated with a **track** cover
    (formula drift, paste error, or automation). oEmbed's ``thumbnail_url`` matches the
    artwork SoundCloud shows for that playlist/set URL.
    """
    u = (playlist_url or "").strip()
    if not u or "soundcloud.com" not in u.lower():
        return ""
    q = urllib.parse.urlencode({"url": u, "format": "json"})
    req_url = f"https://soundcloud.com/oembed?{q}"
    try:
        req = urllib.request.Request(req_url, headers={"User-Agent": "BANANASUTRA-catalog-build/1.0"})
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
        return str(payload.get("thumbnail_url") or "").strip()
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, json.JSONDecodeError, ValueError):
        return ""


def sc_playlist_join_fields(
    playlist: dict[str, str],
    *,
    fetch_oembed_art: bool = True,
) -> tuple[str, str] | None:
    """Canonical playback URL + artwork for **SC Playlists** row (joined by ``songbook_id``).

    ``playlist_url`` always comes from the CSV row. **Artwork:** prefer SoundCloud oEmbed
    ``thumbnail_url`` (true playlist/set art); fall back to CSV ``artwork_url`` when oEmbed
    fails or is disabled (``BANANASUTRA_SC_PLAYLIST_OEMBED=0``).

    Returns ``None`` if playlist URL is missing — caller skips emitting that songbook.
    """
    joined_url = str(playlist.get("playlist_url") or "").strip()
    if not joined_url:
        return None
    csv_art = str(playlist.get("artwork_url") or "").strip()
    oembed_art = ""
    _raw = os.environ.get("BANANASUTRA_SC_PLAYLIST_OEMBED", "1").strip().lower()
    _oembed_off = _raw in ("0", "false", "no")
    if fetch_oembed_art and not _oembed_off:
        oembed_art = soundcloud_oembed_thumbnail(joined_url)
    playlist_artwork_url = oembed_art or csv_art
    return joined_url, playlist_artwork_url


def build_songbook_catalog(
    song_catalog: list[dict[str, Any]],
    songbook_rows: list[dict[str, str]],
    sc_playlist_rows: list[dict[str, str]],
    songbook_tokens_by_lyrics_id: dict[str, list[str]],
) -> list[dict[str, Any]]:
    songs_by_songbook: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for song in song_catalog:
        lid = str(song.get("lyrics_id") or "").strip()
        books = songbook_tokens_by_lyrics_id.get(lid, [])
        for book in books:
            songs_by_songbook[book].append(song)

    songbook_meta_by_name: dict[str, dict[str, str]] = {}
    songbook_meta_by_norm: dict[str, dict[str, str]] = {}
    for row in songbook_rows:
        name = str(row.get("songbook") or "").strip()
        if not name:
            continue
        if name not in songbook_meta_by_name:
            songbook_meta_by_name[name] = row
        norm = normalize_text_key(name)
        if norm and norm not in songbook_meta_by_norm:
            songbook_meta_by_norm[norm] = row

    playlist_by_songbook_id: dict[str, dict[str, str]] = {}
    for row in sc_playlist_rows:
        name = str(row.get("playlist_name") or "").strip()
        if not name:
            continue
        linked_songbook_id = str(row.get("songbook_id") or "").strip()
        if linked_songbook_id and linked_songbook_id not in playlist_by_songbook_id:
            playlist_by_songbook_id[linked_songbook_id] = row

    out: list[dict[str, Any]] = []
    for book_name, songs in songs_by_songbook.items():
        songs_sorted = sorted(songs, key=lambda s: str(s.get("published_at") or ""), reverse=True)
        norm_book = normalize_text_key(book_name)
        meta = songbook_meta_by_name.get(book_name) or songbook_meta_by_norm.get(norm_book)
        if meta is not None and not songbook_row_in_app(meta):
            continue
        songbook_id = str(meta.get("songbook_id") or "").strip() if meta else ""
        playlist = playlist_by_songbook_id.get(songbook_id) if songbook_id else None
        if not playlist:
            continue
        resolved = sc_playlist_join_fields(playlist)
        if resolved is None:
            continue
        pl_url, pl_art = resolved
        explicit_playlist_url = str(meta.get("sc_playlist_url") or "").strip() if meta else ""
        explicit_art_url = str(meta.get("songbook_art_url") or "").strip() if meta else ""
        songbook_type = str((meta or {}).get("songbook_type") or "").strip().lower()
        out.append(
            {
                "songbook": book_name,
                "songbook_in_app": songbook_row_in_app(meta),
                "songbook_id": songbook_id,
                "songbook_type": songbook_type,
                "sutra_id_rollup": str(meta.get("sutra_id_rollup") or "").strip() if meta else "",
                "status": str(meta.get("status") or "").strip() if meta else "",
                "description": str(meta.get("description") or "").strip() if meta else "",
                "sutras": str(meta.get("sutras") or "").strip() if meta else "",
                "secondary_sutra": str(meta.get("secondary_sutra") or "").strip() if meta else "",
                "topics_primary": str(meta.get("topics_primary") or "").strip() if meta else "",
                "landr_url": str(meta.get("landr_url") or "").strip() if meta else "",
                "url_slug_songbook": catalog_songbook_url_slug(meta, book_name),
                "url_songbook_locked": parse_bool(meta.get("url_songbook_locked")) if meta else False,
                "sc_playlist_url": explicit_playlist_url,
                "songbook_art_url": explicit_art_url,
                "playlist_url": pl_url,
                "playlist_artwork_url": pl_art,
                "playlist_total_plays": parse_int(playlist.get("total_plays")) if playlist else 0,
                "playlist_total_likes": parse_int(playlist.get("total_likes")) if playlist else 0,
                "song_count": len(songs_sorted),
                "songs_with_in_app_playback": sum(
                    1 for s in songs_sorted if bool(s.get("has_in_app_playback"))
                ),
                "member_lyrics_ids": [str(s.get("lyrics_id") or "") for s in songs_sorted],
                "member_songs": [
                    {
                        "lyrics_id": str(s.get("lyrics_id") or ""),
                        "lyrics_title": str(s.get("lyrics_title") or ""),
                        "url_slug": str(s.get("url_slug") or ""),
                        "summary_short": str(s.get("summary_short") or ""),
                        "cover_image_url": str(s.get("cover_image_url") or ""),
                        "has_in_app_playback": bool(s.get("has_in_app_playback")),
                        "has_sc_catalog_listen": bool(s.get("has_sc_catalog_listen")),
                        "has_youtube_video": bool(s.get("has_youtube_video")),
                        "has_youtube_embed": bool(s.get("has_youtube_embed")),
                        "aggregate_play_count": parse_int(str(s.get("aggregate_play_count") or "0")),
                        "aggregate_like_count": parse_int(str(s.get("aggregate_like_count") or "0")),
                    }
                    for s in songs_sorted
                ],
            }
        )

    emitted_names = {str(r.get("songbook") or "").strip() for r in out if str(r.get("songbook") or "").strip()}
    for row in songbook_rows:
        name = str(row.get("songbook") or "").strip()
        if not name or not songbook_row_in_app(row):
            continue
        if name in emitted_names:
            continue
        songbook_id = str(row.get("songbook_id") or "").strip()
        playlist = playlist_by_songbook_id.get(songbook_id) if songbook_id else None
        if not playlist:
            continue
        resolved = sc_playlist_join_fields(playlist)
        if resolved is None:
            continue
        pl_url, pl_art = resolved
        explicit_playlist_url = str(row.get("sc_playlist_url") or "").strip()
        explicit_art_url = str(row.get("songbook_art_url") or "").strip()
        songbook_type = str(row.get("songbook_type") or "").strip().lower()
        out.append(
            {
                "songbook": name,
                "songbook_in_app": True,
                "songbook_id": songbook_id,
                "songbook_type": songbook_type,
                "sutra_id_rollup": str(row.get("sutra_id_rollup") or "").strip(),
                "status": str(row.get("status") or "").strip(),
                "description": str(row.get("description") or "").strip(),
                "sutras": str(row.get("sutras") or "").strip(),
                "secondary_sutra": str(row.get("secondary_sutra") or "").strip(),
                "topics_primary": str(row.get("topics_primary") or "").strip(),
                "landr_url": str(row.get("landr_url") or "").strip(),
                "url_slug_songbook": catalog_songbook_url_slug(row, name),
                "url_songbook_locked": parse_bool(row.get("url_songbook_locked")),
                "sc_playlist_url": explicit_playlist_url,
                "songbook_art_url": explicit_art_url,
                "playlist_url": pl_url,
                "playlist_artwork_url": pl_art,
                "playlist_total_plays": parse_int(playlist.get("total_plays")) if playlist else 0,
                "playlist_total_likes": parse_int(playlist.get("total_likes")) if playlist else 0,
                "song_count": 0,
                "songs_with_in_app_playback": 0,
                "member_lyrics_ids": [],
                "member_songs": [],
            }
        )
        emitted_names.add(name)

    out.sort(key=lambda row: str(row.get("songbook") or "").lower())
    return out


def norm_lyrics_id_for_join(value: str | None) -> str:
    """Match lyrics_id keys used in song_detail.json (L-<int>, no zero padding)."""
    v = (value or "").strip()
    if v.startswith("L-"):
        try:
            return f"L-{int(v[2:])}"
        except ValueError:
            return v
    return v


def load_sc_catalog_listen_overrides(path: Path) -> dict[str, dict[str, Any]]:
    """
    Optional CSV: force or suppress catalog SC listen URL when there is no primary SC EP.

    Columns: ``lyrics_id``, ``suppress`` (yes/true/checked), ``sc_url``, ``track_title`` (optional).

    - ``suppress`` set → no inferred listen from FULL v4 / raw export / URL fallbacks.
    - ``sc_url`` set (and not suppressed) → use that URL; ``track_title`` optional (else resolved
      from raw export by URL when available).
    Last row wins per ``lyrics_id``.
    """
    if not path.is_file():
        return {}
    with path.open("r", encoding="utf-8-sig", newline="") as fp:
        reader = csv.DictReader(fp)
        rows = [dict(row) for row in reader]
    out: dict[str, dict[str, Any]] = {}
    for row in rows:
        lid = norm_lyrics_id_for_join(row.get("lyrics_id"))
        if not lid.startswith("L-"):
            continue
        if parse_bool(row.get("suppress")):
            out[lid] = {"suppress": True}
            continue
        sc_url = str(row.get("sc_url") or "").strip()
        if not sc_url:
            continue
        out[lid] = {
            "suppress": False,
            "sc_url": sc_url,
            "track_title": str(row.get("track_title") or "").strip(),
        }
    return out


def load_sc_cover_art_overrides(
    path: Path,
) -> tuple[dict[str, str], dict[str, str]]:
    """
    Optional CSV: force cover art URLs for song cards/detail.

    Columns:
      - ``lyrics_id`` (optional, L-###)
      - ``ep_url`` (optional SoundCloud set URL)
      - ``cover_image_url`` (required to apply row)

    Precedence at build time:
      1) exact ``lyrics_id`` override
      2) ``ep_url`` override (applies to any song whose primary EP URL matches)
      3) automatic artwork selection from SC EP / SC tracks
    """
    if not path.is_file():
        return {}, {}
    with path.open("r", encoding="utf-8-sig", newline="") as fp:
        reader = csv.DictReader(fp)
        rows = [dict(row) for row in reader]
    by_lyrics_id: dict[str, str] = {}
    by_ep_url: dict[str, str] = {}
    for row in rows:
        cover = str(row.get("cover_image_url") or "").strip()
        if not cover:
            continue
        lid = norm_lyrics_id_for_join(row.get("lyrics_id"))
        if lid.startswith("L-"):
            by_lyrics_id[lid] = cover
        ep_norm = _norm_soundcloud_url(str(row.get("ep_url") or ""))
        if ep_norm:
            by_ep_url[ep_norm] = cover
    return by_lyrics_id, by_ep_url


def build_snapshot_sc_track_lyrics_id_lookup(
    sc_tracks_snapshot: list[dict[str, str]],
) -> tuple[dict[str, str | None], dict[str, str | None]]:
    """
    Map ``track_id`` and normalized ``sc_url`` → snapshot ``lyrics_id`` (or ``None`` if unlinked).

    ``AT-TRACKS-FULL-v4.csv`` is regenerated by ``pipelines/sc/build_sc_final_v4.py`` and can lag
    Airtable; the snapshot SC TRACKS table is authoritative for which SoundCloud row belongs to
    which ``lyrics_id``.
    """
    by_track_id: dict[str, str | None] = {}
    by_norm_url: dict[str, str | None] = {}
    for row in sc_tracks_snapshot:
        tid = (row.get("track_id") or "").strip()
        raw_url = (row.get("sc_url") or "").strip()
        nu = ""
        if raw_url and "/sets/" not in raw_url:
            nu = _norm_soundcloud_url(raw_url)
        lid_raw = norm_lyrics_id_for_join(row.get("lyrics_id"))
        lid: str | None = lid_raw if lid_raw.startswith("L-") else None
        if tid:
            by_track_id[tid] = lid
        if nu:
            by_norm_url[nu] = lid
    return by_track_id, by_norm_url


def effective_full_v4_lyrics_id(
    row: dict[str, str],
    by_track_id: dict[str, str | None],
    by_norm_url: dict[str, str | None],
) -> str:
    tid = (row.get("track_id") or "").strip()
    if tid and tid in by_track_id:
        mapped = by_track_id[tid]
        return mapped if mapped is not None else ""
    raw_url = (row.get("sc_url") or "").strip()
    if raw_url and "/sets/" not in raw_url:
        nu = _norm_soundcloud_url(raw_url)
        if nu and nu in by_norm_url:
            mapped = by_norm_url[nu]
            return mapped if mapped is not None else ""
    return norm_lyrics_id_for_join(row.get("lyrics_id"))


def build_sc_tracks_full_v4_indexes(
    path: Path,
    sc_tracks_snapshot: list[dict[str, str]] | None = None,
) -> tuple[dict[str, dict[str, str]], dict[str, dict[str, str]]]:
    """
    Read ``AT-TRACKS-FULL-v4.csv`` for catalog SC listen (with raw-export + overrides) and SC
    cover fallbacks when snapshot art is missing.

    When ``sc_tracks_snapshot`` is set (clean ``sc_tracks-*.csv`` rows), each FULL v4 row is
    grouped under the snapshot's ``lyrics_id`` for that ``track_id`` / ``sc_url`` instead of the
    CSV column alone, so ``npm run catalog:data`` picks up Airtable link edits without rebuilding
    ``AT-TRACKS-FULL-v4.csv``.

    Returns:
        by_lyrics_id: best track per lyrics_id (winner: track_in_app, fav_track, liked_track, play_count).
        by_norm_url: normalized track ``sc_url`` -> that row's ``sc_url``, ``track_title``, ``artwork_url``
        (for ``fallback_sc_url`` exact match on any row).
    """
    if not path.exists():
        print(f"WARNING: missing {path} — SC catalog listen + SC cover fallbacks disabled (run pipelines/sc build)")
        return {}, {}
    rows = read_csv(path)
    buckets: dict[str, list[dict[str, str]]] = defaultdict(list)
    by_norm_url: dict[str, dict[str, str]] = {}

    snap_tid: dict[str, str | None] = {}
    snap_url: dict[str, str | None] = {}
    if sc_tracks_snapshot:
        snap_tid, snap_url = build_snapshot_sc_track_lyrics_id_lookup(sc_tracks_snapshot)

    def rank_key(r: dict[str, str]) -> tuple[bool, bool, bool, int]:
        liked_raw = (r.get("liked_track") or "").strip().lower()
        liked = liked_raw in {"yes", "true", "1", "y", "on"} or parse_bool(r.get("liked_track"))
        return (
            parse_track_in_app(r.get("track_in_app")),
            parse_bool(r.get("fav_track")),
            liked,
            parse_int(r.get("play_count")),
        )

    for row in rows:
        lid = (
            effective_full_v4_lyrics_id(row, snap_tid, snap_url)
            if sc_tracks_snapshot
            else norm_lyrics_id_for_join(row.get("lyrics_id"))
        )
        if not lid.startswith("L-"):
            continue
        url = (row.get("sc_url") or "").strip()
        if not url or "/sets/" in url:
            continue
        buckets[lid].append(row)
        nu = _norm_soundcloud_url(url)
        if nu:
            by_norm_url[nu] = {
                "sc_url": url,
                "track_title": (row.get("track_title") or "").strip(),
                "artwork_url": (row.get("artwork_url") or "").strip(),
            }

    by_lyrics_id: dict[str, dict[str, str]] = {}
    for lid, group in buckets.items():
        top = sorted(group, key=rank_key, reverse=True)[0]
        by_lyrics_id[lid] = {
            "sc_url": (top.get("sc_url") or "").strip(),
            "track_title": (top.get("track_title") or "").strip(),
            "artwork_url": (top.get("artwork_url") or "").strip(),
        }
    return by_lyrics_id, by_norm_url


def youtube_row_can_embed(row: dict[str, str]) -> bool:
    """
    In-app iframe only when YouTube allows embed and the row is explicitly in app.
    """
    vid = (row.get("video_id") or "").strip()
    if not vid:
        return False
    if not parse_bool(row.get("embeddable")):
        return False
    st = (row.get("status") or "").strip().lower()
    if st == "out":
        return False
    ps = (row.get("privacy_status") or "").strip().lower()
    if ps in {"private", "privacyStatusPrivate"}:
        return False
    if not youtube_row_in_app(row):
        return False
    if parse_bool(row.get("made_for_kids")):
        return False
    return True


def youtube_row_to_payload(row: dict[str, str], lyrics_id: str) -> dict[str, Any]:
    return {
        "video_id": (row.get("video_id") or "").strip(),
        "title": (row.get("title") or "").strip(),
        "lyrics_title": (row.get("lyrics_title") or "").strip(),
        "lyrics_id": lyrics_id,
        "video_featured": parse_bool(row.get("video_featured")),
        "video_featured_description": (row.get("video_featured_description") or "").strip(),
        "sutra": (row.get("sutra") or "").strip(),
        "genre_primary": (row.get("genre_primary") or "").strip(),
        "genre_secondary": (row.get("genre_secondary") or "").strip(),
        "instruments": (row.get("instruments") or "").strip(),
        "yt_url": (row.get("yt_url") or "").strip(),
        "thumbnail_url": (row.get("thumbnail_url") or "").strip(),
        "duration": (row.get("duration") or "").strip(),
        "publish_date": (row.get("publish_date") or "").strip(),
        "playlist_names": (row.get("playlist_names") or "").strip(),
        "content_type": (row.get("content_type") or "").strip(),
        "format": (row.get("format") or "").strip(),
        "topic_categories": (row.get("topic_categories") or "").strip(),
        "can_embed": youtube_row_can_embed(row),
    }


def youtube_row_in_app(row: dict[str, str]) -> bool:
    raw = row.get("ytvideo_in_app")
    if raw is None or str(raw).strip() == "":
        return False
    normalized = str(raw).strip().lower()
    if normalized in {"false", "unchecked", "0"}:
        return False
    return parse_bool(raw)


def build_youtube_by_lyrics_index_from_snapshot_rows(rows: list[dict[str, str]]) -> dict[str, list[dict[str, Any]]]:
    """Build ``youtube_by_lyrics_id`` from canonical ``clean/yt_videos-*.csv`` (Airtable = catalog source of truth).

    Same gates as before: ``video_id`` required, ``status`` not Out, ``ytvideo_in_app`` on.
    ``pipelines/yt/build_yt_final.py`` / ``AT-VIDEOS-final.csv`` stay for scrape-backed QA and Airtable import only.
    """
    by_lid: dict[str, list[dict[str, Any]]] = defaultdict(list)
    # Rows with no usable L-* lyrics_id (Airtable blank / not yet linked) still belong in the export
    # under the empty-string key; each payload keeps lyrics_id "" so the hub can show them as YouTube-only.
    UNLINKED_BUCKET = ""
    for row in rows:
        if not (row.get("video_id") or "").strip():
            continue
        if (row.get("status") or "").strip().lower() == "out":
            continue
        if not youtube_row_in_app(row):
            continue
        lid = norm_lyrics_id_for_join(row.get("lyrics_id"))
        if lid.startswith("L-"):
            by_lid[lid].append(youtube_row_to_payload(row, lid))
        else:
            by_lid[UNLINKED_BUCKET].append(youtube_row_to_payload(row, ""))
    for _lid, items in by_lid.items():
        items.sort(
            key=lambda x: (str(x.get("publish_date") or ""), str(x.get("video_id") or "")),
            reverse=True,
        )
    return dict(by_lid)


def enrich_youtube_videos_with_catalog_song_fields(
    youtube_by_lyrics_id: dict[str, list[dict[str, Any]]],
    song_catalog: list[dict[str, Any]],
) -> None:
    """Attach song metadata from featured song_catalog rows for meaning-first /videos UI."""
    by_lid: dict[str, dict[str, Any]] = {}
    for row in song_catalog:
        lid = str(row.get("lyrics_id") or "").strip()
        if lid:
            by_lid[lid] = row
    for lid, videos in youtube_by_lyrics_id.items():
        song = by_lid.get(lid)
        topic = str(song.get("topic") or "").strip() if song else ""
        intention = str(song.get("intention") or "").strip() if song else ""
        lyrics_summary = str(song.get("summary_short") or "").strip() if song else ""
        us = str(song.get("url_slug") or "").strip() if song else ""
        for v in videos:
            v["song_topic"] = topic
            v["song_intention"] = intention
            v["lyrics_summary"] = lyrics_summary
            if us:
                v["url_slug"] = us


def merge_youtube_flags_into_catalog(
    song_catalog: list[dict[str, Any]],
    youtube_by_lyrics_id: dict[str, list[dict[str, Any]]],
) -> None:
    """Attach has_youtube_video / has_youtube_embed to each row (any in-app YT row vs any embeddable)."""
    for row in song_catalog:
        lid = str(row.get("lyrics_id") or "").strip()
        vids = youtube_by_lyrics_id.get(lid, [])
        row["has_youtube_video"] = bool(vids)
        row["has_youtube_embed"] = any(bool(v.get("can_embed")) for v in vids)


def fill_catalog_covers_from_youtube_thumbnails(
    song_catalog: list[dict[str, Any]],
    youtube_by_lyrics_id: dict[str, list[dict[str, Any]]],
) -> int:
    """
    When choose_artwork left cover_image_url empty (no SC track or EP art), use the first
    YouTube thumbnail from the snapshot (newest-first list). Never replaces a non-empty SC-derived URL.
    """
    filled = 0
    for row in song_catalog:
        if str(row.get("cover_image_url") or "").strip():
            continue
        lid = str(row.get("lyrics_id") or "").strip()
        for v in youtube_by_lyrics_id.get(lid, []):
            u = str(v.get("thumbnail_url") or "").strip()
            if u:
                row["cover_image_url"] = u
                filled += 1
                break
    return filled


def sync_song_detail_covers_from_catalog(
    song_catalog: list[dict[str, Any]],
    song_detail: dict[str, dict[str, Any]],
) -> None:
    """Keep song_detail hero art aligned with catalog rows after YT cover fill."""
    for row in song_catalog:
        lid = str(row.get("lyrics_id") or "").strip()
        if lid in song_detail:
            song_detail[lid]["cover_image_url"] = str(row.get("cover_image_url") or "")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--date", help="Snapshot date in YYYY-MM-DD format")
    parser.add_argument("--top-tracks", type=int, default=DEFAULT_TOP_TRACKS)
    parser.add_argument("--like-weight", type=int, default=LIKE_WEIGHT)
    args = parser.parse_args()

    snapshot_date = args.date or latest_snapshot_date()
    config = Config(
        snapshot_date=snapshot_date,
        top_tracks=args.top_tracks,
        like_weight=args.like_weight,
    )

    paths = build_paths(config.snapshot_date)
    missing = [name for name, path in paths.items() if not path.exists()]
    if missing:
        missing_list = ", ".join(missing)
        raise FileNotFoundError(f"Missing required CSVs for {config.snapshot_date}: {missing_list}")

    lyrics_rows = read_csv(paths["lyrics"])
    sc_tracks_raw = read_csv(paths["sc_tracks"])
    sc_tracks_rows = [normalize_track_row(row) for row in sc_tracks_raw]
    sc_eps_rows = read_csv(paths["sc_eps"])
    songbook_rows = read_csv(paths["songbooks"])
    sc_playlist_rows = read_csv(paths["sc_playlists"])
    sutra_rows = read_csv(paths["sutras"])
    muse_rows = read_csv(paths["muses"])
    quotes_rows = read_csv(paths["quotes"])
    yt_videos_rows = read_csv(paths["yt_videos"])
    muse_visibility = build_muse_visibility_index(muse_rows)
    sutra_context = build_sutra_context(sutra_rows)
    merge_featured_eps_into_sutra_context(sutra_context, sc_eps_rows)

    # Last write wins per lyrics_id; process non-app rows first so duplicate IDs keep the
    # in-app row (e.g. L-52 "Criminals" vs "Criminals (Bertrand Edition)" in the same export).
    lyrics_index: dict[str, dict[str, str]] = {}
    for row in sorted(lyrics_rows, key=lyric_row_in_app):
        lid = row.get("lyrics_id", "").strip()
        if lid:
            lyrics_index[lid] = row
    eps_index: dict[str, dict[str, Any]] = {}
    for row in sc_eps_rows:
        keys = split_multi(row.get("lyrics_id"))
        if not keys:
            continue
        current_created = parse_datetime(row.get("created_at"))
        for key in keys:
            existing = eps_index.get(key)
            # Keep the newest by created date when duplicates exist.
            if not existing or current_created > str(existing.get("created_at", "")):
                eps_index[key] = {
                    "lyrics_id": key,
                    "ep_title": row.get("ep_title", "").strip(),
                    "ep_url": row.get("ep_url", "").strip(),
                    "ep_volume": parse_int(row.get("ep_volume")),
                    "ep_rating": str(row.get("ep_rating") or "").strip(),
                    "created_at": current_created,
                    "artwork_url": row.get("artwork_url", "").strip(),
                    "total_plays": parse_int(row.get("total_plays")),
                    "total_likes": parse_int(row.get("total_likes")),
                    "duration_total": row.get("duration_total", "").strip(),
                }

    tracks_by_lyrics: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in sc_tracks_rows:
        lyrics_id = row.get("lyrics_id", "")
        if lyrics_id:
            tracks_by_lyrics[lyrics_id].append(row)

    full_v4_by_lid, full_v4_by_url = build_sc_tracks_full_v4_indexes(
        SC_TRACKS_FULL_V4, sc_tracks_raw
    )
    listen_overrides = load_sc_catalog_listen_overrides(SC_CATALOG_LISTEN_OVERRIDES)
    cover_overrides_by_lid, cover_overrides_by_ep = load_sc_cover_art_overrides(
        SC_COVER_ART_OVERRIDES
    )
    suppress_sc_fallback_ids = {
        lid for lid, payload in listen_overrides.items() if bool(payload.get("suppress"))
    }
    export_listen_rows = load_soundcloud_raw_export_listen_rows(SC_RAW_EXPORT_CSV)
    if SC_RAW_EXPORT_CSV.is_file():
        print(f"NOTE: SC raw export for catalog title-match: {SC_RAW_EXPORT_CSV.relative_to(ROOT)}")
    else:
        print(
            f"WARNING: missing {SC_RAW_EXPORT_CSV.relative_to(ROOT)} — export_title listen + "
            "raw-export cover title-match disabled (run pipelines/sc/bananasutra_sc_export.py)."
        )
    if listen_overrides:
        print(
            f"NOTE: loaded {len(listen_overrides)} SC catalog listen override(s) from "
            f"{SC_CATALOG_LISTEN_OVERRIDES.relative_to(ROOT)}"
        )
    if cover_overrides_by_lid or cover_overrides_by_ep:
        print(
            "NOTE: loaded "
            f"{len(cover_overrides_by_lid)} SC cover override(s) by lyrics_id and "
            f"{len(cover_overrides_by_ep)} by ep_url from "
            f"{SC_COVER_ART_OVERRIDES.relative_to(ROOT)}"
        )

    song_catalog: list[dict[str, Any]] = []
    song_detail: dict[str, dict[str, Any]] = {}
    songbook_tokens_by_lyrics_id: dict[str, list[str]] = {}
    related_titles_by_lyrics_id: dict[str, list[str]] = {}
    deprecated_songbook_hits: Counter[str] = Counter()

    for lyrics_id, lyric in lyrics_index.items():
        if not lyric_row_in_app(lyric):
            continue

        tracks = tracks_by_lyrics.get(lyrics_id, [])
        fallback_sc_url = str(lyric.get("fallback_sc_url") or "").strip()
        published_tracks = [t for t in tracks if t["track_in_app"]]
        has_in_app_playback = bool(published_tracks or fallback_sc_url)

        selected_tracks = (
            select_best_tracks(
                tracks=tracks,
                top_tracks=config.top_tracks,
                like_weight=config.like_weight,
            )
            if tracks
            else []
        )
        detail_tracks = sort_tracks_for_detail(tracks, config.like_weight) if tracks else []
        discovery_top_track_genres = discovery_top_track_genres_line(detail_tracks)

        aggregate_play_count = sum(int(t["play_count"]) for t in published_tracks)
        aggregate_like_count = sum(int(t["like_count"]) for t in published_tracks)
        aggregate_duration = sum(int(t["duration_sec"]) for t in published_tracks)
        peak_play_count = max((int(t["play_count"]) for t in published_tracks), default=0)
        peak_like_count = max((int(t["like_count"]) for t in published_tracks), default=0)

        track_genres = (
            collect_track_genres(tracks, published_only=True) if published_tracks else []
        )
        track_secondary_genres = (
            collect_secondary_genres(tracks, published_only=True) if published_tracks else []
        )
        track_instruments = (
            collect_track_instruments(tracks, published_only=True) if published_tracks else []
        )
        track_moods = collect_track_moods(tracks, published_only=True) if published_tracks else []
        soundcloud_tags = sorted(
            {str(t["soundcloud_genre"]) for t in published_tracks if t.get("soundcloud_genre")}
        )

        artwork_url = choose_artwork(lyrics_id, tracks, detail_tracks, eps_index)
        if not artwork_url:
            artwork_url = str(lyric.get("fallback_cover_art") or "").strip()
        ep_meta = eps_index.get(lyrics_id)
        ep_url_from_row = str(ep_meta.get("ep_url") or "").strip() if ep_meta else ""
        if lyrics_id in cover_overrides_by_lid:
            artwork_url = cover_overrides_by_lid[lyrics_id]
        else:
            ep_norm = _norm_soundcloud_url(ep_url_from_row)
            if ep_norm and ep_norm in cover_overrides_by_ep:
                artwork_url = cover_overrides_by_ep[ep_norm]
        ep_title_from_row = str(ep_meta.get("ep_title") or "").strip() if ep_meta else ""
        ep_created = str(ep_meta.get("created_at") or "").strip() if ep_meta else ""
        sc_catalog_listen_url = ""
        sc_catalog_track_title = ""
        sc_catalog_listen_source = ""
        if not ep_url_from_row:
            ov = listen_overrides.get(lyrics_id)
            if ov and ov.get("suppress"):
                pass
            elif ov and str(ov.get("sc_url") or "").strip():
                sc_catalog_listen_url = str(ov["sc_url"]).strip()
                sc_catalog_track_title = str(ov.get("track_title") or "").strip()
                if not sc_catalog_track_title:
                    sc_catalog_track_title = track_title_from_export_rows_by_norm_url(
                        export_listen_rows, _norm_soundcloud_url(sc_catalog_listen_url)
                    )
                sc_catalog_listen_source = "override"
            else:
                hit = full_v4_by_lid.get(lyrics_id)
                if hit and str(hit.get("sc_url") or "").strip():
                    sc_catalog_listen_url = str(hit.get("sc_url") or "").strip()
                    sc_catalog_track_title = str(hit.get("track_title") or "").strip()
                    sc_catalog_listen_source = "full_v4"
                if not sc_catalog_listen_url:
                    ex_u, ex_t = pick_listen_url_from_soundcloud_export_rows(
                        export_listen_rows,
                        lyric.get("song_title"),
                        fallback_sc_url,
                    )
                    if ex_u:
                        sc_catalog_listen_url = ex_u
                        sc_catalog_track_title = ex_t
                        sc_catalog_listen_source = "export_title"
                if not sc_catalog_listen_url:
                    fb_key = _norm_soundcloud_url(fallback_sc_url)
                    url_hit = full_v4_by_url.get(fb_key) if fb_key else None
                    if url_hit and str(url_hit.get("sc_url") or "").strip():
                        sc_catalog_listen_url = str(url_hit.get("sc_url") or "").strip()
                        sc_catalog_track_title = str(url_hit.get("track_title") or "").strip()
                        sc_catalog_listen_source = "full_v4_url"
        has_sc_catalog_listen = bool(sc_catalog_listen_url)
        # Catalog "newest" timestamp: SC tracks if present, else SC EP date if present, else lyrics.
        if tracks:
            primary_published_at = soundcloud_catalog_sort_at(ep_created, tracks)
        elif ep_created:
            primary_published_at = ep_created
        else:
            primary_published_at = lyrics_fallback_catalog_at(lyric)

        if published_tracks:
            sc_title_blob = collect_soundcloud_title_blob(tracks, published_only=True)
        elif tracks:
            sc_title_blob = collect_soundcloud_title_blob(tracks, published_only=False)
        else:
            sc_title_blob = ""
        primary_ep_volume = parse_int(str(ep_meta.get("ep_volume") or "0")) if ep_meta else 0
        primary_ep_rating = str(ep_meta.get("ep_rating") or "").strip() if ep_meta else ""

        written_year = str(lyric.get("year_created") or "").strip()
        raw_lyrics = collapse_airtable_separator_newlines(str(lyric.get("lyrics") or "")).strip()
        raw_songbook = str(lyric.get("songbook") or "").strip()
        for token in split_multi(raw_songbook):
            normalized = str(token or "").strip()
            if not normalized:
                continue
            if normalized.upper() in SONGBOOK_ALIAS_KEYS_UPPER:
                deprecated_songbook_hits[normalized] += 1
        books_for_song = songbook_tokens(raw_songbook)
        songbook_tokens_by_lyrics_id[lyrics_id] = books_for_song
        related_titles_by_lyrics_id[lyrics_id] = parse_linked_record_titles(lyric.get("sister_songs"))
        display_songbook = primary_songbook(raw_songbook)
        display_title = lyric.get("song_title", "").strip()
        url_slug = catalog_url_slug(lyric, display_title)

        card = {
            "lyrics_id": lyrics_id,
            "lyrics_title": display_title,
            "url_slug": url_slug,
            "url_slug_locked": parse_bool(lyric.get("url_slug_locked")),
            "summary_short": lyric.get("lyrics_summary", "").strip(),
            "lyrics_extract": str(lyric.get("lyrics_extract") or "").strip(),
            "sutra": lyric.get("sutra", "").strip(),
            "topic": lyric.get("topic", "").strip(),
            "intention": lyric.get("intention", "").strip(),
            "light_shadow": lyric.get("light_shadow", "").strip(),
            "lang": lyric.get("lang", "").strip(),
            "written_year": written_year,
            "song_in_app": lyric_row_in_app(lyric),
            "fav": parse_bool(lyric.get("fav")),
            "published_at": primary_published_at,
            "cover_image_url": artwork_url,
            "track_genres": track_genres,
            "track_secondary_genres": track_secondary_genres,
            "track_instruments": track_instruments,
            "track_moods": track_moods,
            "discovery_top_track_genres": discovery_top_track_genres,
            "soundcloud_genre_tags": soundcloud_tags,
            "track_count_total": len(tracks),
            "track_count_published": len(published_tracks),
            "track_count_selected": len(selected_tracks),
            "aggregate_play_count": aggregate_play_count,
            "aggregate_like_count": aggregate_like_count,
            "peak_play_count": peak_play_count,
            "peak_like_count": peak_like_count,
            "aggregate_duration_sec": aggregate_duration,
            "best_track_ids": [str(t["track_id"]) for t in selected_tracks],
            "ep_refs": sorted(
                {u for u in (str(t.get("ep_url") or "").strip() for t in tracks) if u}
                | ({ep_url_from_row} if ep_url_from_row else set())
            ),
            "primary_ep_volume": primary_ep_volume,
            "primary_ep_rating": primary_ep_rating,
            "primary_ep_url": ep_url_from_row,
            "primary_ep_title": ep_title_from_row,
            "has_fav_track": any(bool(t["fav_track"]) for t in published_tracks),
            "songbook": display_songbook,
            "muse": str(lyric.get("muse") or "").strip(),
            "song_muse_quote": trim_for_search_blob(lyric.get("song_muse_quote"), SEARCH_MUSE_QUOTE_MAX),
            "soundcloud_title_blob": sc_title_blob,
            "lyrics_head_search": trim_for_search_blob(raw_lyrics, SEARCH_LYRICS_HEAD_MAX),
            "fallback_sc_url": fallback_sc_url,
            "has_in_app_playback": has_in_app_playback,
            "has_sc_catalog_listen": has_sc_catalog_listen,
            "sc_catalog_listen_url": sc_catalog_listen_url,
            "sc_catalog_track_title": sc_catalog_track_title,
            "sc_catalog_listen_source": sc_catalog_listen_source,
            # Airtable SONGS `status` — internal pipeline vocabulary; used for /words “in pipeline” heuristic.
            "lyrics_pipeline_status": str(
                lyric.get("production_stage") or lyric.get("status") or ""
            ).strip(),
        }
        song_catalog.append(card)

        song_detail[lyrics_id] = {
            "lyrics_id": lyrics_id,
            "lyrics_title": display_title,
            "url_slug": url_slug,
            "url_slug_locked": parse_bool(lyric.get("url_slug_locked")),
            "lyrics_summary": lyric.get("lyrics_summary", "").strip(),
            "lyrics_extract": str(lyric.get("lyrics_extract") or "").strip(),
            "lyrics_text": raw_lyrics,
            "sutra": lyric.get("sutra", "").strip(),
            "topic": lyric.get("topic", "").strip(),
            "intention": lyric.get("intention", "").strip(),
            "light_shadow": lyric.get("light_shadow", "").strip(),
            "lang": lyric.get("lang", "").strip(),
            "written_year": written_year,
            "song_in_app": lyric_row_in_app(lyric),
            "fav": parse_bool(lyric.get("fav")),
            "cover_image_url": artwork_url,
            "songbook": display_songbook,
            "muse": filter_song_detail_muse(str(lyric.get("muse") or "").strip(), muse_visibility),
            "primary_ep_volume": primary_ep_volume,
            "primary_ep_rating": primary_ep_rating,
            "primary_ep_url": ep_url_from_row,
            "primary_ep_title": ep_title_from_row,
            "fallback_sc_url": fallback_sc_url,
            "has_sc_catalog_listen": has_sc_catalog_listen,
            "sc_catalog_listen_url": sc_catalog_listen_url,
            "sc_catalog_track_title": sc_catalog_track_title,
            "sc_catalog_listen_source": sc_catalog_listen_source,
            "related_songs": [],
            "tracks": detail_tracks,
        }

    # Default sort contract: newest first (stable tie-break on lyrics_id).
    song_catalog.sort(key=lambda row: str(row.get("lyrics_id", "")))
    song_catalog.sort(key=lambda row: str(row.get("published_at", "")), reverse=True)

    youtube_by_lyrics_id = build_youtube_by_lyrics_index_from_snapshot_rows(yt_videos_rows)
    merge_youtube_flags_into_catalog(song_catalog, youtube_by_lyrics_id)
    yt_cover_fill = fill_catalog_covers_from_youtube_thumbnails(song_catalog, youtube_by_lyrics_id)
    sc_full_cover_fill = fill_catalog_covers_from_sc_tracks_full_v4(
        song_catalog,
        by_lyrics_id=full_v4_by_lid,
        by_norm_url=full_v4_by_url,
        skip_lyrics_ids=suppress_sc_fallback_ids,
    )
    sc_raw_cover_fill = fill_catalog_covers_from_soundcloud_raw_export(
        song_catalog,
        export_csv=SC_RAW_EXPORT_CSV if SC_RAW_EXPORT_CSV.is_file() else None,
        skip_lyrics_ids=suppress_sc_fallback_ids,
    )
    sync_song_detail_covers_from_catalog(song_catalog, song_detail)
    enrich_youtube_videos_with_catalog_song_fields(youtube_by_lyrics_id, song_catalog)

    cards_by_lyrics_id: dict[str, dict[str, Any]] = {
        str(row.get("lyrics_id") or "").strip(): row for row in song_catalog
    }
    title_exact_map: dict[str, list[str]] = defaultdict(list)
    title_norm_map: dict[str, list[str]] = defaultdict(list)
    for row in song_catalog:
        lid = str(row.get("lyrics_id") or "").strip()
        title = str(row.get("lyrics_title") or "").strip()
        if not lid or not title:
            continue
        exact_key = title.lower()
        norm_key = normalize_text_key(title)
        if lid not in title_exact_map[exact_key]:
            title_exact_map[exact_key].append(lid)
        if norm_key and lid not in title_norm_map[norm_key]:
            title_norm_map[norm_key].append(lid)

    related_links_written = 0
    for lid, detail_row in song_detail.items():
        related_titles = related_titles_by_lyrics_id.get(lid, [])
        resolved_ids = resolve_related_lyrics_ids(
            current_lyrics_id=lid,
            related_titles=related_titles,
            title_exact_map=title_exact_map,
            title_norm_map=title_norm_map,
        )
        payload: list[dict[str, Any]] = []
        for rid in resolved_ids:
            related_card = cards_by_lyrics_id.get(rid)
            if not related_card:
                continue
            payload.append(
                {
                    "lyrics_id": rid,
                    "lyrics_title": str(related_card.get("lyrics_title") or ""),
                    "url_slug": str(related_card.get("url_slug") or ""),
                    "cover_image_url": str(related_card.get("cover_image_url") or ""),
                    "has_in_app_playback": bool(related_card.get("has_in_app_playback")),
                    "has_sc_catalog_listen": bool(related_card.get("has_sc_catalog_listen")),
                    "has_youtube_video": bool(related_card.get("has_youtube_video")),
                }
            )
        detail_row["related_songs"] = payload
        related_links_written += len(payload)

    facets = create_facets(song_catalog)
    songbook_catalog = build_songbook_catalog(
        song_catalog,
        songbook_rows,
        sc_playlist_rows,
        songbook_tokens_by_lyrics_id,
    )
    edition_link_gaps = find_edition_link_gaps(song_detail)
    home_quotes = build_home_quotes(quotes_rows)
    song_catalog_browse = build_song_catalog_browse(song_catalog)
    song_search_deep = build_song_search_deep(song_catalog)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    review_csv = OUTPUT_DIR / "sc_catalog_listen_review.csv"
    with review_csv.open("w", newline="", encoding="utf-8") as fp:
        writer = csv.DictWriter(
            fp,
            fieldnames=[
                "lyrics_id",
                "lyrics_title",
                "primary_ep_url",
                "has_in_app_playback",
                "sc_catalog_listen_source",
                "sc_catalog_listen_url",
                "sc_catalog_track_title",
            ],
        )
        writer.writeheader()
        for row in song_catalog:
            if not row.get("has_sc_catalog_listen"):
                continue
            writer.writerow(
                {
                    "lyrics_id": str(row.get("lyrics_id") or ""),
                    "lyrics_title": str(row.get("lyrics_title") or ""),
                    "primary_ep_url": str(row.get("primary_ep_url") or ""),
                    "has_in_app_playback": "yes" if row.get("has_in_app_playback") else "",
                    "sc_catalog_listen_source": str(row.get("sc_catalog_listen_source") or ""),
                    "sc_catalog_listen_url": str(row.get("sc_catalog_listen_url") or ""),
                    "sc_catalog_track_title": str(row.get("sc_catalog_track_title") or ""),
                }
            )

    automatch_review_csv = OUTPUT_DIR / "sc_catalog_listen_automatch_review.csv"
    automatch_review_rows = [
        row
        for row in song_catalog
        if row.get("has_sc_catalog_listen")
        and not str(row.get("primary_ep_url") or "").strip()
        and str(row.get("sc_catalog_listen_source") or "").strip() in {"full_v4", "full_v4_url", "export_title"}
    ]
    automatch_sources = Counter(
        str(row.get("sc_catalog_listen_source") or "").strip() for row in automatch_review_rows
    )
    with automatch_review_csv.open("w", newline="", encoding="utf-8") as fp:
        writer = csv.DictWriter(
            fp,
            fieldnames=[
                "lyrics_id",
                "url_slug",
                "lyrics_title",
                "sc_catalog_listen_source",
                "sc_catalog_listen_url",
                "sc_catalog_track_title",
                "fallback_sc_url",
                "cover_image_url",
                "has_in_app_playback",
            ],
        )
        writer.writeheader()
        for row in automatch_review_rows:
            writer.writerow(
                {
                    "lyrics_id": str(row.get("lyrics_id") or ""),
                    "url_slug": str(row.get("url_slug") or ""),
                    "lyrics_title": str(row.get("lyrics_title") or ""),
                    "sc_catalog_listen_source": str(row.get("sc_catalog_listen_source") or ""),
                    "sc_catalog_listen_url": str(row.get("sc_catalog_listen_url") or ""),
                    "sc_catalog_track_title": str(row.get("sc_catalog_track_title") or ""),
                    "fallback_sc_url": str(row.get("fallback_sc_url") or ""),
                    "cover_image_url": str(row.get("cover_image_url") or ""),
                    "has_in_app_playback": "yes" if row.get("has_in_app_playback") else "",
                }
            )

    catalog_chrome_stats = build_catalog_chrome_stats(facets, song_catalog, songbook_catalog)
    song_slug_index = build_song_slug_index(song_detail)
    track_catalog = build_track_catalog_flat(song_detail, cards_by_lyrics_id, config.like_weight)

    outputs = {
        "song_catalog.json": song_catalog,
        "song_catalog_browse.json": song_catalog_browse,
        "song_search_deep.json": song_search_deep,
        "song_detail.json": song_detail,
        "track_catalog.json": track_catalog,
        "facets.json": facets,
        "songbook_catalog.json": songbook_catalog,
        "catalog_chrome_stats.json": catalog_chrome_stats,
        "song_slug_index.json": song_slug_index,
        "sutra_context.json": sutra_context,
        "home_quotes.json": home_quotes,
        "youtube_by_lyrics_id.json": youtube_by_lyrics_id,
    }
    for filename, payload in outputs.items():
        out_path = OUTPUT_DIR / filename
        with out_path.open("w", encoding="utf-8") as fp:
            json.dump(payload, fp, ensure_ascii=False, indent=2)
            fp.write("\n")

    with_playback = sum(1 for row in song_catalog if row.get("has_in_app_playback"))
    with_sc_catalog = sum(1 for row in song_catalog if row.get("has_sc_catalog_listen"))
    summary = {
        "snapshot_date": config.snapshot_date,
        "songs": len(song_catalog),
        "details": len(song_detail),
        "featured_with_in_app_playback": with_playback,
        "featured_with_sc_catalog_listen": with_sc_catalog,
        "featured_lyrics_only": len(song_catalog) - with_playback,
        "facet_keys": list(facets.keys()),
        "songbooks": len(songbook_catalog),
        "top_tracks_per_song": config.top_tracks,
        "like_weight": config.like_weight,
        "youtube_lyrics_ids": len(youtube_by_lyrics_id),
        "youtube_video_rows": sum(len(v) for v in youtube_by_lyrics_id.values()),
        "youtube_rows_missing_lyrics_id": len(youtube_by_lyrics_id.get("", [])),
        "sutra_context_rows": len(sutra_context),
        "home_quotes": len(home_quotes),
        "track_catalog_rows": len(track_catalog),
        "related_song_links_written": related_links_written,
        "edition_rows_missing_links_count": len(edition_link_gaps),
        "edition_rows_missing_links": edition_link_gaps[:25],
        "sc_tracks_full_v4_csv": str(SC_TRACKS_FULL_V4.relative_to(ROOT)),
        "sc_raw_export_csv": str(SC_RAW_EXPORT_CSV.relative_to(ROOT)) if SC_RAW_EXPORT_CSV.is_file() else "",
        "sc_catalog_listen_overrides_csv": str(SC_CATALOG_LISTEN_OVERRIDES.relative_to(ROOT))
        if SC_CATALOG_LISTEN_OVERRIDES.is_file()
        else "",
        "sc_cover_art_overrides_csv": str(SC_COVER_ART_OVERRIDES.relative_to(ROOT))
        if SC_COVER_ART_OVERRIDES.is_file()
        else "",
        "sc_cover_art_overrides_lyrics_ids": len(cover_overrides_by_lid),
        "sc_cover_art_overrides_ep_urls": len(cover_overrides_by_ep),
        "sc_catalog_automatch_review_csv": str(automatch_review_csv.relative_to(ROOT)),
        "sc_catalog_automatch_rows": len(automatch_review_rows),
        "sc_catalog_automatch_source_counts": dict(sorted(automatch_sources.items())),
        "inputs": {
            name: {
                "path": str(path.relative_to(ROOT)),
                "sha256": file_sha256(path),
                "rows": len(
                    {
                        "lyrics": lyrics_rows,
                        "sc_tracks": sc_tracks_rows,
                        "sc_eps": sc_eps_rows,
                        "songbooks": songbook_rows,
                        "sc_playlists": sc_playlist_rows,
                        "sutras": sutra_rows,
                        "muses": muse_rows,
                        "quotes": quotes_rows,
                        "yt_videos": yt_videos_rows,
                    }[name]
                ),
            }
            for name, path in paths.items()
        },
    }
    with (OUTPUT_DIR / "_build_summary.json").open("w", encoding="utf-8") as fp:
        json.dump(summary, fp, ensure_ascii=False, indent=2)
        fp.write("\n")

    print(f"Built artifacts from snapshot {config.snapshot_date}")
    print(f"Songs: {len(song_catalog)}")
    if edition_link_gaps:
        print(f"WARNING: edition rows missing EP and/or related links: {len(edition_link_gaps)}")
        for row in edition_link_gaps[:8]:
            print(
                "  - "
                f"{row['lyrics_id']} {row['lyrics_title']} | "
                f"missing_ep={row['missing_primary_ep_url']} missing_related={row['missing_related_songs']}"
            )
    if yt_cover_fill:
        print(f"Catalog covers filled from YouTube thumbnails (no SC art): {yt_cover_fill}")
    if sc_full_cover_fill:
        print(f"Catalog covers filled from AT-TRACKS-FULL-v4.csv fallback: {sc_full_cover_fill}")
    if sc_raw_cover_fill:
        print(f"Catalog covers filled from raw SC export title-match: {sc_raw_cover_fill}")
    yt_ids = len(youtube_by_lyrics_id)
    yt_rows = sum(len(v) for v in youtube_by_lyrics_id.values())
    yt_unlinked = len(youtube_by_lyrics_id.get("", []))
    print(
        f"YouTube (clean yt_videos snapshot): {yt_ids} bucket keys, {yt_rows} video rows"
        f" ({yt_unlinked} with no lyrics_id) → youtube_by_lyrics_id.json"
    )
    if deprecated_songbook_hits:
        print("Deprecated songbook labels detected in lyrics rows (auto-aliased):")
        for label, count in deprecated_songbook_hits.most_common():
            target = songbook_alias_target(label) or "(alias target unknown)"
            print(f"  - {label} -> {target} ({count} rows)")
    print(
        f"SC catalog listen URLs (overrides + AT-TRACKS-FULL-v4 + raw export title-match, no primary EP): "
        f"{with_sc_catalog} songs"
    )
    print(f"SC catalog listen QA export → {review_csv.relative_to(ROOT)}")
    print(
        "SC catalog automatch QA export → "
        f"{automatch_review_csv.relative_to(ROOT)} ({len(automatch_review_rows)} rows)"
    )
    if automatch_sources:
        print(f"SC automatch sources: {dict(sorted(automatch_sources.items()))}")
    print(f"Output: {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
