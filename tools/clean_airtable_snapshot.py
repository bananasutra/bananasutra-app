#!/usr/bin/env python3
"""
Airtable snapshot canonicalizer.

Airtable CSV exports come with quirks that silently poison downstream joins:
  - BOM (U+FEFF) embedded in the first-column header, sometimes doubled
  - Invisible chars inside cells (NBSP, ZWSP, ZWJ, U+2028 line separator)
  - Inconsistent header naming (UPPER, Title Case, snake_case, with
    spaces / slashes / parens / "?" / "#" etc.)

This script reads the raw CSVs in a snapshot folder and writes canonicalized
copies to `{snapshot}/clean/`:
  - headers are pure snake_case per the HEADER_MAP below
  - cells have invisible chars normalized or stripped
  - raw files are never modified (kept as evidence)

Pipelines and future app code should read from `clean/` exclusively.

Further documentation (performance cleanup, future improvements): `_docs/CLEAN-AIRTABLE-SNAPSHOT.md`.

Usage:
    python3 tools/clean_airtable_snapshot.py
        # runs against the latest dated snapshot folder
    python3 tools/clean_airtable_snapshot.py 2026-04-19
        # runs against a specific snapshot
    python3 tools/clean_airtable_snapshot.py /full/path/to/snapshot-folder
        # or an absolute path
"""
from __future__ import annotations

import csv
import re
import sys
from pathlib import Path

from airtable_cell_newlines import collapse_airtable_separator_newlines

# ══════════════════════════════════════════════════════════════════════════════
# PATHS
# ══════════════════════════════════════════════════════════════════════════════

REPO = Path(__file__).resolve().parent.parent
SNAPSHOTS = REPO / "AIRTABLE" / "snapshots"

# ══════════════════════════════════════════════════════════════════════════════
# HEADER MAP — raw Airtable headers → canonical snake_case
# ══════════════════════════════════════════════════════════════════════════════
#
# Top-level keys are raw filename patterns (date-agnostic). Values map raw
# header strings (BOM-stripped, outer-whitespace-stripped) → canonical names.
#
# When adding a new table, list EVERY raw header. If the canonicalizer sees a
# header that isn't in the map, it errors out with a clear message asking you
# to add the mapping. This keeps silent drift impossible.
#
# Airtable sometimes exports "pretty" headers, and sometimes exports field
# names that are already snake_case (often identical to canonical names). Both
# shapes must be listed here so older and newer snapshots canonicalize.

HEADER_MAP: dict[str, dict[str, str]] = {
    "SUTRAs": {
        "SUTRA Name": "sutra",
        "Question": "question",
        "Practice": "practice",
        "Themes": "themes",
        "Alignment": "alignment",
        "Intentions": "intentions",
        "The Vibe": "vibe",
        "The Mental Health Pivot": "mental_health_pivot",
        "The Takeaway": "takeaway",
        "Sutra Essence": "sutra_essence",
        "SUTRA Essence": "sutra_essence",
        "SUTRA ID": "sutra_id",
        "SONGBOOKs": "songbooks",
        "SONGS (Lyrics)": "songs",
        "SONGs (Lyrics)": "songs",
        "URL slug sutra": "url_slug_sutra",
        "Url slug sutra": "url_slug_sutra",
        "URL slug SUTRA": "url_slug_sutra",
        "url_slug_sutra": "url_slug_sutra",
        "URL sutra locked": "url_sutra_locked",
        "Url sutra locked": "url_sutra_locked",
        "URL slug sutra locked": "url_sutra_locked",
        "Url slug sutra locked": "url_sutra_locked",
        "url_sutra_locked": "url_sutra_locked",
        # snake_case export (2026-04-20+)
        "sutra": "sutra",
        "question": "question",
        "practice": "practice",
        "themes": "themes",
        "alignment": "alignment",
        "intentions": "intentions",
        "sutra_when": "sutra_when",
        "sutra_card_essence": "sutra_card_essence",
        "sutra_essence": "sutra_essence",
        "vibe": "vibe",
        "mental_health_pivot": "mental_health_pivot",
        "takeaway": "takeaway",
        "sutra_id": "sutra_id",
        "songbooks": "songbooks",
        "songs": "songs",

    },
    "SONGBOOKs": {
        "SONGBOOK name": "songbook",
        "Status": "status",
        "LANDR URL": "landr_url",
        "SUTRA(s)": "sutras",
        "Secondary SUTRA": "secondary_sutra",
        "Topics (primary)": "topics_primary",
        "Description": "description",
        "ID": "songbook_id",
        "SONGS (Lyrics)": "songs",
        "SONGs (Lyrics)": "songs",
        "SUTRA ID Rollup (from SUTRA(s))": "sutra_id_rollup",
        "Songbook in app": "songbook_in_app",
        "Songbook in App": "songbook_in_app",
        "SONGBOOK in app": "songbook_in_app",
        # snake_case export
        "songbook": "songbook",
        "status": "status",
        "songbook_in_app": "songbook_in_app",
        "landr_url": "landr_url",
        "sutras": "sutras",
        "secondary_sutra": "secondary_sutra",
        "topics_primary": "topics_primary",
        "description": "description",
        "songbook_id": "songbook_id",
        "songbook_type": "songbook_type",
        "sutra_id_rollup": "sutra_id_rollup",
        "songbook_art_url": "songbook_art_url",
        "sc_playlist_url": "sc_playlist_url",
        "Imported table": "imported_table",
        "URL slug songbook": "url_slug_songbook",
        "Url slug songbook": "url_slug_songbook",
        "URL slug SONGBOOK": "url_slug_songbook",
        "url_slug_songbook": "url_slug_songbook",
        "URL songbook locked": "url_songbook_locked",
        "Url songbook locked": "url_songbook_locked",
        "URL slug songbook locked": "url_songbook_locked",
        "Url slug songbook locked": "url_songbook_locked",
        "url_songbook_locked": "url_songbook_locked",
        # Homepage / cross-page featuring (checkbox); specs TBD in templates
        "songbook_featured": "songbook_featured",
        "Songbook featured": "songbook_featured",
        "SONGBOOK featured": "songbook_featured",
    },
    "MUSEs": {
        "MUSE Name": "muse",
        "MUSE in app": "muse_in_app",
        "First Name": "first_name",
        "Last Name": "last_name",
        "Gender / Pronoun": "gender_pronoun",
        "Type, Category": "type_category",
        "Country": "country",
        "Era": "era",
        "Birth Year": "birth_year",
        "Death year": "death_year",
        "Famous Work(s)": "famous_works",
        "Core SUTRA": "core_sutra",
        "Secondary SUTRAs": "secondary_sutras",
        "Themes/ Keywords": "themes_keywords",
        "Bananasutra Notes": "bananasutra_notes",
        "Key Quotes": "key_quotes",
        # Distinct from Key Quotes: Airtable field linking / storing QUOTEs content (not merged into key_quotes).
        "QUOTEs": "quotes",
        "QUOTEs lookup": "quotes_lookup",
        "Primary Source": "primary_source",
        "Additional Sources": "additional_sources",
        "Status": "status",
        "autoID": "auto_id",
        "museID": "muse_id",
        "SONGS (Lyrics)": "songs",
        "SONGs (Lyrics)": "songs",
        # snake_case export
        "muse": "muse",
        "muse_in_app": "muse_in_app",
        "first_name": "first_name",
        "last_name": "last_name",
        "gender_pronoun": "gender_pronoun",
        "type_category": "type_category",
        "country": "country",
        "era": "era",
        "birth_year": "birth_year",
        "death_year": "death_year",
        "famous_works": "famous_works",
        "core_sutra": "core_sutra",
        "secondary_sutras": "secondary_sutras",
        "themes_keywords": "themes_keywords",
        "bananasutra_notes": "bananasutra_notes",
        "key_quotes": "key_quotes",
        "quotes": "quotes",
        "quotes_lookup": "quotes_lookup",
        "QUOTEs_rollup": "quotes_lookup",
        "primary_source": "primary_source",
        "additional_sources": "additional_sources",
        "status": "status",
        "auto_id": "auto_id",
        "muse_id": "muse_id",
    },
    "QUOTEs": {
        "QUOTEsutra": "quote",
        "MUSE": "muse",
        "QUOTE in app": "quote_in_app",
        "Primary SUTRA": "primary_sutra",
        "Secondary SUTRAs": "secondary_sutras",
        "Core TOPIC": "core_topic",
        "Core INTENTIONS": "core_intentions",
        "Created": "created",
        "autoID": "auto_id",
        "quote-ID": "quote_id",
        # snake_case export
        "quote": "quote",
        "muse": "muse",
        "quote_in_app": "quote_in_app",
        "primary_sutra": "primary_sutra",
        "secondary_sutras": "secondary_sutras",
        "core_topic": "core_topic",
        "core_intentions": "core_intentions",
        "created": "created",
        "auto_id": "auto_id",
        "quote_id": "quote_id",
        # legacy alias kept for backward compatibility
        "quote_featured_in_app": "quote_in_app",
    },
    "SONGS (Lyrics)": {
        "SONG TITLE": "song_title",
        # Pipeline stage (replaces legacy `status` / `STATUS`); canonical CSV column is always `production_stage`.
        "STATUS": "production_stage",
        "status": "production_stage",
        "production_stage": "production_stage",
        "PRODUCTION_STAGE": "production_stage",
        "Production stage": "production_stage",
        "lyrics_id": "lyrics_id",
        "URL slug": "url_slug",
        "Url slug": "url_slug",
        "url_slug": "url_slug",
        "URL slug locked": "url_slug_locked",
        "Url slug locked": "url_slug_locked",
        "url_slug_locked": "url_slug_locked",
        "LANDR URL": "landr_url",
        "LDR # TRC#": "ldr_trc_count",
        "LDR VOL#": "ldr_vol",
        "SUTRA": "sutra",
        "SONGBOOK": "songbook",
        "MUSE": "muse",
        "Canonical?": "canonical",
        "LYRICS": "lyrics",
        "lyrics_extract": "lyrics_extract",
        "LYRICS Summary": "lyrics_summary",
        "SISTER SONG(S)": "sister_songs",
        "From field: SISTER SONG(S) 2": "from_sister_songs",
        "From field: sister_songs": "from_sister_songs",
        "LANG": "lang",
        "Light/Shadow": "light_shadow",
        "TOPIC": "topic",
        "INTENTION": "intention",
        "LYRICS Rating": "lyrics_rating",
        "FAV?": "fav",
        "COVER?": "cover",
        "PUBLIC DOMAIN?": "public_domain",
        "Song Muse Type": "song_muse_type",
        "Song Muse Quote": "song_muse_quote",
        "LYRICS Notes": "lyrics_notes",
        "Files & media": "files_media",
        "YEAR Created": "year_created",
        "Date created": "date_created",
        "Last Modified": "last_modified",
        "Last edited vintage time": "last_edited_vintage_time",
        "Auto ID": "auto_id",
        "FEATURED in APP?": "song_in_app",
        "featured_in_app": "song_in_app",
        # snake_case export (field order differs; names match canonical)
        "song_title": "song_title",
        "lyrics_rating": "lyrics_rating",
        "fav": "fav",
        "song_in_app": "song_in_app",
        "canonical": "canonical",
        "cover": "cover",
        "public_domain": "public_domain",
        "song_muse_type": "song_muse_type",
        "song_muse_quote": "song_muse_quote",
        "song_characters": "song_characters",
        "lyrics_notes": "lyrics_notes",
        "files_media": "files_media",
        "year_created": "year_created",
        "date_created": "date_created",
        "last_modified": "last_modified",
        "last_edited_vintage_time": "last_edited_vintage_time",
        "landr_url": "landr_url",
        "ldr_trc_count": "ldr_trc_count",
        "ldr_vol": "ldr_vol",
        "sutra": "sutra",
        "songbook": "songbook",
        "muse": "muse",
        "lyrics": "lyrics",
        "lyrics_extract": "lyrics_extract",
        "lyrics_summary": "lyrics_summary",
        "sister_songs": "sister_songs",
        "from_sister_songs": "from_sister_songs",
        "lang": "lang",
        "light_shadow": "light_shadow",
        "topic": "topic",
        "intention": "intention",
        "auto_id": "auto_id",
        "lyrics_id": "lyrics_id",
        "url_slug": "url_slug",
        "url_slug_locked": "url_slug_locked",
        "fallback_cover_art": "fallback_cover_art",
        "fallback_sc_url": "fallback_sc_url",
        "lyrics_review_needed": "lyrics_review_needed",
        "Lyrics review needed": "lyrics_review_needed",
        "meta_review_needed": "meta_review_needed",
        "Meta review needed": "meta_review_needed",
        "review_notes": "review_notes",
        "Review notes": "review_notes",
        "sutra_id Rollup (from sutra)": "sutra_id_rollup",
        "sutra_id_rollup": "sutra_id_rollup",
    },
    "YTplaylists": {
        "playlist_name": "playlist_name",
        "playlist_type": "playlist_type",
        "yt_playlist_type": "playlist_type",
        "sutra": "sutra",
        "video_count": "video_count",
        "description": "description",
        "playlist_id": "playlist_id",
        "playlist_url": "playlist_url",
        "thumbnail_url": "thumbnail_url",
        "ytplaylist_in_app": "ytplaylist_in_app",
        "ytplaylist_featured": "ytplaylist_featured",
        "YT playlist featured": "ytplaylist_featured",
        "YTplaylist featured": "ytplaylist_featured",
        "ytplaylist_featured_description": "ytplaylist_featured_description",
        "YT playlist featured description": "ytplaylist_featured_description",
        "YTplaylist featured description": "ytplaylist_featured_description",
        "YTvideos": "ytvideos",
    },
    "YTvideos": {
        "title": "title",
        "ytvideo_in_app": "ytvideo_in_app",
        "app_ready": "ytvideo_in_app",
        "lyrics_title": "lyrics_title",
        "lyrics_id": "lyrics_id",
        "format": "format",
        "rating": "rating",
        "duration": "duration",
        "topic_categories": "topic_categories",
        "yt_url": "yt_url",
        "content_type": "content_type",
        "genre_primary": "genre_primary",
        "genre_secondary": "genre_secondary",
        "instruments": "instruments",
        "sutra": "sutra",
        # Optional curation metadata (kept flexible while taxonomy settles)
        "mood": "mood",
        "track_mood": "mood",
        "tempo_feel": "tempo_feel",
        "energy": "tempo_feel",
        "upbeat_downbeat": "tempo_feel",
        "speed_feel": "tempo_feel",
        "curation_rating": "curation_rating",
        "track_rating": "curation_rating",
        "rating_track": "curation_rating",
        "has_manual_caption": "has_manual_caption",
        "manual_notes": "manual_notes",
        "publish_date": "publish_date",
        "view_count": "view_count",
        "like_count": "like_count",
        "comment_count": "comment_count",
        "thumbnail_url": "thumbnail_url",
        "description": "description",
        "yt_tags": "yt_tags",
        "series_info": "series_info",
        "language": "language",
        "playlist_names": "playlist_names",
        "playlist_count": "playlist_count",
        "has_captions": "has_captions",
        "privacy_status": "privacy_status",
        "embeddable": "embeddable",
        "license": "license",
        "made_for_kids": "made_for_kids",
        "status": "status",
        "notes": "notes",
        "video_id": "video_id",
        "video_featured": "video_featured",
        "Video featured": "video_featured",
        "video_featured_description": "video_featured_description",
        "Video featured description": "video_featured_description",
        "video_songbook": "video_songbook",
        "Video songbook": "video_songbook",
    },
    # SC TRACKs — headers converged to snake_case after the first import
    # round-trip (Airtable adopted the output column names). Legacy "track
    # title" and "soundcloud genre" spellings were in the pre-import snapshot
    # but Airtable has since renamed them.
    "SC TRACKs": {
        "track_title": "track_title",
        "sc_url": "sc_url",
        "lyrics_title": "lyrics_title",
        "sutra": "sutra",
        "genres": "genres",
        "primary_genre": "primary_genre",
        # Pipeline / Airtable: SC-derived genre line (separate from primary_genre curation)
        "extracted_genre": "extracted_genre",
        "instruments": "instruments",
        # Optional curation metadata + backwards-compatible aliases
        "mood": "mood",
        "track_mood": "mood",
        "tempo_feel": "tempo_feel",
        "energy": "tempo_feel",
        "upbeat_downbeat": "tempo_feel",
        "speed_feel": "tempo_feel",
        "curation_rating": "curation_rating",
        "track_rating": "curation_rating",
        "rating_track": "curation_rating",
        "ep_title": "ep_title",
        "ep_url": "ep_url",
        "ep_volume": "ep_volume",
        "volume": "ep_volume",
        "ep_track_number": "ep_track_number",
        "ep_total_tracks": "ep_total_tracks",
        "playlist_names_clean": "playlist_names_clean",
        "playlist_count": "playlist_count",
        "play_count": "play_count",
        "like_count": "like_count",
        "repost_count": "repost_count",
        "comment_count": "comment_count",
        "duration": "duration",
        "created_at": "created_at",
        "bpm": "bpm",
        "artwork_url": "artwork_url",
        "artwork_lg_url": "artwork_lg_url",
        "waveform_url": "waveform_url",
        "soundcloud_genre": "soundcloud_genre",
        "tags": "tags",
        "description": "description",
        "license": "license",
        "track_type": "track_type",
        "purchase_url": "purchase_url",
        "download_url": "download_url",
        "track_id": "track_id",
        "lyrics_id": "lyrics_id",
        # Manual curation + QA (Airtable field names must match CSV export headers)
        "track_status": "track_status",
        "track_in_app": "track_in_app",
        "track_featured_in_app": "track_in_app",
        # Optional featured embed + copy (separate from `description` / EP copy)
        "track_featured": "track_featured",
        "Track featured": "track_featured",
        "track_description": "track_description",
        "Track description": "track_description",
        "fav_track": "fav_track",
        "liked_track": "liked_track",
        "user_liked": "liked_track",
        "secondary_genre": "secondary_genres",
        "secondary_genres": "secondary_genres",
    },
    # SC EPs — `lyrics_title` is now a real column (for human review in
    # Airtable). Linked-record columns (e.g. `SC TRACKs`) reappear whenever
    # Airtable includes the link in the grid export — map them to snake_case
    # for a clean CSV; catalog build may ignore these fields.
    "SC EPs": {
        "SC TRACKs": "sc_tracks_link",
        "ep_title": "ep_title",
        "ep_url": "ep_url",
        "ep_volume": "ep_volume",
        "ep_rating": "ep_rating",
        "lyrics_title": "lyrics_title",
        "lyrics_id": "lyrics_id",
        "sutra": "sutra",
        "genres": "genres",
        "genres_full": "genres_full",
        "ep_total_tracks": "ep_total_tracks",
        "total_plays": "total_plays",
        "total_likes": "total_likes",
        "duration_total": "duration_total",
        "artwork_url": "artwork_url",
        "artwork_lg_url": "artwork_lg_url",
        "created_at": "created_at",
        "playlist_names_clean": "playlist_names_clean",
        "ep_in_app": "ep_in_app",
        # Optional featured embed + EP-specific copy; internal grouping in SC base
        "ep_featured": "ep_featured",
        "EP featured": "ep_featured",
        "ep_description": "ep_description",
        "EP description": "ep_description",
        "ep_songbook_title": "ep_songbook_title",
        "EP songbook title": "ep_songbook_title",
    },
    # SC Playlists — linked-record columns may reappear on Airtable grid export;
    # map to snake_case; catalog build may ignore.
    "SC Playlists": {
        "SC EPs": "sc_eps_link",
        "playlist_name": "playlist_name",
        "playlist_url": "playlist_url",
        "sc_playlist_type": "sc_playlist_type",
        "sutra": "sutra",
        "genres": "genres",
        "track_count": "track_count",
        "total_plays": "total_plays",
        "total_likes": "total_likes",
        "duration_total": "duration_total",
        "artwork_url": "artwork_url",
        "artwork_lg_url": "artwork_lg_url",
        "scplaylist_in_app": "scplaylist_in_app",
        "songbook_id": "songbook_id",
    },
}

# Raw filename stem pattern → (map key, clean filename stem)
# Raw filename: "{prefix}-YYYY-MM-DD.csv"
# Clean filename: "{clean_prefix}-YYYY-MM-DD.csv"
FILE_PATTERNS: list[tuple[str, str, str]] = [
    # (raw_prefix,              map_key,          clean_prefix)
    ("SUTRAs",                  "SUTRAs",         "sutras"),
    ("SONGBOOKs",               "SONGBOOKs",      "songbooks"),
    ("MUSEs",                   "MUSEs",          "muses"),
    ("QUOTEs",                  "QUOTEs",         "quotes"),
    ("SONGS (Lyrics)",          "SONGS (Lyrics)", "lyrics"),
    ("YTplaylists",             "YTplaylists",    "yt_playlists"),
    ("YTvideos",                "YTvideos",       "yt_videos"),
    ("SC TRACKs",               "SC TRACKs",      "sc_tracks"),
    ("SC EPs",                  "SC EPs",         "sc_eps"),
    ("SC Playlists",            "SC Playlists",   "sc_playlists"),
]

# ══════════════════════════════════════════════════════════════════════════════
# CELL-LEVEL NORMALIZATION
# ══════════════════════════════════════════════════════════════════════════════
#
# What each replacement does and why:
#   BOM (U+FEFF)        → ''        : zero-width, should never appear in data
#   ZWSP (U+200B)       → ''        : invisible, breaks equality checks; no
#                                     legitimate use in our content
#   NBSP (U+00A0)       → ' '       : non-breaking space becomes regular space
#   LINE SEP (U+2028)   → '\n'      : Unicode line sep breaks many consumers
#                                     (JSON parsers, JS split('\n'), SQL loaders).
#                                     When Airtable emits U+2028 immediately before a real
#                                     newline, ``airtable_cell_newlines`` collapses that
#                                     pair to one ``\\n`` first so we do not double gaps.
#   PARA SEP (U+2029)   → '\n'      : same (pair collapse handled there too)
#   CRLF  (\r\n)        → '\n'      : normalize line endings
#   bare CR (\r)        → '\n'      : same
#
# NOT stripped in cells (both have legitimate uses in user content):
#   ZWJ  (U+200D)  : joiner for compound emoji like 🏴‍☠️, ❤️‍🔥, 👨‍👩‍👧 —
#                    stripping corrupts the emoji
#   ZWNJ (U+200C)  : used in Farsi, Hindi, and other scripts as non-joiner
#
# Headers are handled separately (see HEADER_STRIP below) — every invisible
# character is stripped from headers since column names should be pure ASCII.
#
# Implementation: one `re.sub` scan per cell (was sequential `.replace` passes).

_CELL_SUB_RX = re.compile(r"\r\n|\r|\u2028|\u2029|\u00a0|\ufeff|\u200b")

_CELL_SUB_REP: dict[str, str] = {
    "\r\n": "\n",
    "\r": "\n",
    "\u2028": "\n",
    "\u2029": "\n",
    "\u00a0": " ",
    "\ufeff": "",
    "\u200b": "",
}

# Characters stripped entirely from headers (no legitimate use in column names)
HEADER_STRIP = ["\ufeff", "\u200b", "\u200c", "\u200d", "\u2028", "\u2029"]


def normalize_cell(v: str) -> tuple[str, dict[str, int]]:
    """Return (normalized_value, counts_per_replacement)."""
    if not v:
        return v, {}
    v = collapse_airtable_separator_newlines(v)
    counts: dict[str, int] = {}

    def repl(m: re.Match[str]) -> str:
        s = m.group(0)
        counts[s] = counts.get(s, 0) + 1
        return _CELL_SUB_REP[s]

    return _CELL_SUB_RX.sub(repl, v), counts


def strip_bom_and_ws(h: str) -> str:
    """Strip BOMs + all invisible chars + outer whitespace from a header cell.
    Column names should never contain zero-width or formatting characters.
    """
    out = h
    for ch in HEADER_STRIP:
        out = out.replace(ch, "")
    # NBSP in headers also becomes regular space (Airtable sometimes inserts)
    out = out.replace("\u00a0", " ")
    return out.strip()


# ══════════════════════════════════════════════════════════════════════════════
# CORE LOGIC
# ══════════════════════════════════════════════════════════════════════════════

CHAR_NAMES = {
    "\r\n": "CRLF",
    "\r": "CR",
    "\u2028": "LINE-SEP",
    "\u2029": "PARA-SEP",
    "\u00a0": "NBSP",
    "\ufeff": "BOM",
    "\u200b": "ZWSP",
}


def clean_file(raw_path: Path, clean_path: Path, header_map: dict[str, str]) -> dict:
    """Clean one CSV file. Returns a report dict."""
    # Read raw with plain utf-8 so BOMs show up as data we can strip explicitly.
    with open(raw_path, encoding="utf-8") as f:
        reader = csv.reader(f)
        raw_headers = next(reader)
        raw_rows = list(reader)

    # 1. Normalize headers: strip BOM + outer whitespace, then map to canonical.
    cleaned_headers_intermediate = [strip_bom_and_ws(h) for h in raw_headers]

    unmapped = [h for h in cleaned_headers_intermediate if h not in header_map]
    if unmapped:
        raise SystemExit(
            f"ERROR: {raw_path.name} has headers not in the canonical map:\n"
            + "\n".join(f"  {h!r}" for h in unmapped)
            + f"\n\nAdd these to HEADER_MAP in tools/clean_airtable_snapshot.py"
        )

    clean_headers = [header_map[h] for h in cleaned_headers_intermediate]

    # Check for duplicates after mapping (would silently overwrite columns)
    if len(clean_headers) != len(set(clean_headers)):
        seen: dict[str, int] = {}
        for h in clean_headers:
            seen[h] = seen.get(h, 0) + 1
        dupes = {h: n for h, n in seen.items() if n > 1}
        raise SystemExit(f"ERROR: {raw_path.name} → duplicate clean headers: {dupes}")

    # 2. Normalize every cell. Track which characters were touched, per-column.
    col_char_counts: dict[str, dict[str, int]] = {h: {} for h in clean_headers}
    rows_out: list[list[str]] = []
    for raw_row in raw_rows:
        # csv.reader gives a list aligned with headers; pad/truncate defensively
        if len(raw_row) < len(raw_headers):
            raw_row = raw_row + [""] * (len(raw_headers) - len(raw_row))
        elif len(raw_row) > len(raw_headers):
            raw_row = raw_row[: len(raw_headers)]

        row_out: list[str] = []
        for clean_h, cell in zip(clean_headers, raw_row):
            new_cell, touches = normalize_cell(cell)
            for ch, n in touches.items():
                col_char_counts[clean_h][ch] = col_char_counts[clean_h].get(ch, 0) + n
            row_out.append(new_cell)
        rows_out.append(row_out)

    # 3. Write clean file.
    clean_path.parent.mkdir(parents=True, exist_ok=True)
    with open(clean_path, "w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(clean_headers)
        writer.writerows(rows_out)

    return {
        "raw": raw_path.name,
        "clean": clean_path.name,
        "rows": len(rows_out),
        "cols": len(clean_headers),
        "raw_headers": cleaned_headers_intermediate,
        "clean_headers": clean_headers,
        "col_char_counts": col_char_counts,
    }


def find_snapshot_folder(arg: str | None) -> Path:
    """Resolve snapshot folder from CLI arg."""
    if arg:
        p = Path(arg)
        if p.is_absolute() and p.exists():
            return p
        # Try relative to SNAPSHOTS
        p2 = SNAPSHOTS / arg
        if p2.exists():
            return p2
        raise SystemExit(f"ERROR: snapshot folder not found: {arg}")
    # Default: latest dated folder
    dated = sorted(
        p for p in SNAPSHOTS.iterdir()
        if p.is_dir() and re.match(r"^\d{4}-\d{2}-\d{2}$", p.name)
    )
    if not dated:
        raise SystemExit(f"ERROR: no dated snapshot folders in {SNAPSHOTS}")
    return dated[-1]


def main() -> int:
    arg = sys.argv[1] if len(sys.argv) > 1 else None
    snap = find_snapshot_folder(arg)
    date_stamp = snap.name

    print(f"Canonicalizing snapshot: {snap}")
    print(f"  → output: {snap / 'clean'}/\n")

    clean_dir = snap / "clean"
    clean_dir.mkdir(exist_ok=True)

    reports = []
    for raw_prefix, map_key, clean_prefix in FILE_PATTERNS:
        raw_name = f"{raw_prefix}-{date_stamp}.csv"
        raw_path = snap / raw_name
        if not raw_path.exists():
            fallback_hits = sorted(snap.glob(f"{raw_prefix}-*.csv"))
            if not fallback_hits:
                fallback_hits = sorted(snap.glob(f"{raw_prefix}*.csv"))
            if not fallback_hits:
                print(f"  [skip] {raw_name} not in snapshot")
                continue
            raw_path = fallback_hits[-1]
            raw_name = raw_path.name
            print(f"  [note] using {raw_name} (date-stamp mismatch in filename)")
        clean_name = f"{clean_prefix}-{date_stamp}.csv"
        clean_path = clean_dir / clean_name
        rpt = clean_file(raw_path, clean_path, HEADER_MAP[map_key])
        reports.append(rpt)
        print(f"  [ok]   {raw_name:45} → clean/{clean_name}  ({rpt['rows']} rows, {rpt['cols']} cols)")

    # Write reports
    report_path = clean_dir / "_CLEANING_REPORT.txt"
    write_cleaning_report(report_path, reports, date_stamp)
    map_path = clean_dir / "_HEADER_MAP.md"
    write_header_map(map_path, reports, date_stamp)

    print(f"\n  [ok]   clean/_CLEANING_REPORT.txt")
    print(f"  [ok]   clean/_HEADER_MAP.md")
    print(f"\n✓ Canonicalization complete ({len(reports)} files)")
    return 0


def write_cleaning_report(path: Path, reports: list[dict], date_stamp: str) -> None:
    lines = [
        f"AIRTABLE SNAPSHOT CLEANING REPORT — {date_stamp}",
        "=" * 70,
        "",
        "Per-file summary of invisible-character normalization.",
        "Columns not listed had no modifications.",
        "",
    ]
    for rpt in reports:
        lines.append(f"── {rpt['raw']} → {rpt['clean']} ({rpt['rows']} rows)")
        touched_any = False
        for col, counts in rpt["col_char_counts"].items():
            if not counts:
                continue
            touched_any = True
            parts = [f"{CHAR_NAMES.get(ch, repr(ch))}×{n}" for ch, n in counts.items()]
            lines.append(f"    {col:35}  {', '.join(parts)}")
        if not touched_any:
            lines.append(f"    (no cell modifications)")
        lines.append("")
    path.write_text("\n".join(lines), encoding="utf-8")


def write_header_map(path: Path, reports: list[dict], date_stamp: str) -> None:
    lines = [
        f"# Airtable Header Map — {date_stamp}",
        "",
        "Raw Airtable export headers and their canonical snake_case names.",
        "Generated by `tools/clean_airtable_snapshot.py`. Do not edit by hand —",
        "update the `HEADER_MAP` dict in the script and re-run.",
        "",
    ]
    for rpt in reports:
        lines.append(f"## {rpt['clean']}")
        lines.append("")
        lines.append("| raw Airtable header | canonical name |")
        lines.append("|---|---|")
        for raw_h, clean_h in zip(rpt["raw_headers"], rpt["clean_headers"]):
            lines.append(f"| `{raw_h}` | `{clean_h}` |")
        lines.append("")
    path.write_text("\n".join(lines), encoding="utf-8")


if __name__ == "__main__":
    sys.exit(main())
