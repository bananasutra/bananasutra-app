#!/usr/bin/env python3
"""
build_sc_final_v4.py
====================
Full pipeline from raw SC export to Airtable-ready CSVs (mirror of
pipelines/yt/build_yt_final.py for the SoundCloud side).

── WHERE TO RUN ─────────────────────────────────────────────────────────────
Run from anywhere, but typically:
    cd ~/Developer/BANANASUTRA-app/pipelines/sc && python3 build_sc_final_v4.py

Paths resolve relative to this file. Expected layout:
    <repo>/pipelines/sc/build_sc_final_v4.py         (this file)
    <repo>/pipelines/sc/raw/                          (raw SC scrape)
    <repo>/pipelines/sc/outputs/                      (Airtable-ready CSVs)
    <repo>/pipelines/sc/outputs/archive/YYYY-MM-DD/   (dated archive per run)
    <repo>/pipelines/sc/_legacy/                      (old one-shot scripts)
    <repo>/AIRTABLE/snapshots/YYYY-MM-DD/             (raw Airtable exports)
    <repo>/AIRTABLE/snapshots/YYYY-MM-DD/clean/       (canonicalized exports)
    <repo>/AIRTABLE/SOUNDCLOUD/sc-archived/           (legacy fallback CSVs)

The script auto-picks the newest snapshot of each Airtable table. All four
(LYRICS, SC TRACKS, SC EPS, SC PLAYLISTS) are read from the canonicalized
`clean/` subfolder produced by tools/clean_airtable_snapshot.py. If no
snapshot folder exists yet, falls back to the legacy frozen CSVs under
sc-archived/.

── SOURCE OF TRUTH ──────────────────────────────────────────────────────────
Two Airtable tables bridge identities across the pipeline:

  SC TRACKS snapshot   →   track_id → lyrics_id (+ lyrics_title, sutra, ...)
  LYRICS snapshot      →   lyrics_id → canonical song title, SUTRA

The user maintains lyrics_id manually in Airtable, so it is the stable
primary key. Title is the secondary/fallback key used to heal historical
lid mismatches.

── DELTA LOGIC ───────────────────────────────────────────────────────────────
Known tracks (track_id in SC TRACKS snapshot):
    ID-primary resolve to LYRICS snapshot:
      1. lyrics_id from SC TRACKS → LYRICS canonical title + sutra  (happy path)
      2. If that lid is gone / missing, bridge via lyrics_title → new lid
         (flagged `id_drift_resolved` in SC-SYNC-REPORT.csv)
      3. If neither ID nor title match LYRICS, keep confirmed values
         and flag `id_drift_unresolved` for manual fix in Airtable.
    Refresh play/like counts, dates, playlist memberships.
    Fall back to confirmed data for any fields missing in raw export
    (artwork_url, waveform_url, duration, bpm, etc.).

New tracks (track_id not yet in SC TRACKS snapshot):
    Parse sutra from EP/track title.
    Parse genres from SC tags.
    Fuzzy-match lyrics_id from extracted song name.
    Write to QA file for manual review.

── TWO-PASS WORKFLOW ────────────────────────────────────────────────────────
Pass 1:  python3 build_sc_final_v4.py
         → Outputs QA file (outputs/SC-NEW-TRACKS-QA.csv) for new tracks.
         → Auto-matched lyrics_ids filled in where score ≥ 80.
         → Low-confidence rows have blank CORRECT_LYRICS_ID column.

Pass 2:  Open outputs/SC-NEW-TRACKS-QA.csv, fill in CORRECT_LYRICS_ID
         (e.g. L-312) for any low-confidence rows, save.
         Re-run: python3 build_sc_final_v4.py
         → Script reads the corrected lyrics_id, then pulls the canonical
           title and sutra from the LYRICS snapshot (no hand-typed titles).
         → Outputs final corrected CSVs.

── FILTER ───────────────────────────────────────────────────────────────────
play_count >= 300  OR  like_count >= 5  →  determines membership in AT-TRACKS-v4.csv only.
                                         AT-TRACKS-FULL-v4.csv always contains every row from the raw export.

── INPUTS ───────────────────────────────────────────────────────────────────
  pipelines/sc/raw/bananasutra_sc_export.csv         raw scrape (bananasutra_sc_export.py)
  pipelines/sc/raw/sc_playlist_art_api.json            playlist/set artwork from SC API — dual sizes (same run as export)
  snapshots/YYYY-MM-DD/clean/sc_tracks-*.csv         confirmed track reference (canonicalized)
  snapshots/YYYY-MM-DD/clean/sc_eps-*.csv            confirmed EP reference (canonicalized)
  snapshots/YYYY-MM-DD/clean/sc_playlists-*.csv      confirmed PLAYLIST reference (canonicalized)
  snapshots/YYYY-MM-DD/clean/lyrics-*.csv            LYRICS base (canonicalized)
  (all auto-picked from newest snapshot folder; legacy CSVs under
   sc-archived/ are used only if no snapshot folder exists yet)

── OUTPUTS ──────────────────────────────────────────────────────────────────
  pipelines/sc/outputs/AT-TRACKS-v4.csv          TRACKS for Airtable import ONLY —
                                                   rows where play_count≥300 OR like_count≥5
                                                   (keeps SC TRACKS within free-tier limits)
  pipelines/sc/outputs/AT-TRACKS-FULL-v4.csv    Same columns, ALL scraped tracks —
                                                   do NOT import this table to Airtable.
                                                   Use for long-tail metadata, embed permalinks,
                                                   and artwork fallbacks when building the catalog app.
  pipelines/sc/outputs/AT-EPS-v4.csv             Airtable-ready EPS table (includes ep_featured,
                                                   ep_description, ep_songbook_title passthrough from snapshot)
  pipelines/sc/outputs/AT-PLAYLISTS-v4.csv       Airtable-ready PLAYLISTS table (set covers from
                                                   sc_playlist_art_api.json first — re-run export after SC artwork changes)
  pipelines/sc/outputs/SC-NEW-TRACKS-QA.csv      QA file for new tracks
  pipelines/sc/outputs/SC-SYNC-REPORT.csv        drift flags vs LYRICS snapshot
  pipelines/sc/outputs/archive/YYYY-MM-DD/       dated copies per run
"""

import csv
import json
import os
import re
from collections import Counter, defaultdict
from datetime import date
from rapidfuzz import fuzz

from sc_sndcdn_artwork import sndcdn_artwork_sm_lg

# ══════════════════════════════════════════════════════════════════════════════
# CONFIG — paths resolve relative to this file. See docstring for layout.
# ══════════════════════════════════════════════════════════════════════════════

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT  = os.path.normpath(os.path.join(SCRIPT_DIR, '..', '..'))

# Folder layout mirrors pipelines/yt:
#   pipelines/sc/raw/        — raw SC scrape dropped here by bananasutra_sc_export.py
#   pipelines/sc/outputs/    — Airtable-ready CSVs + QA + sync report
#   pipelines/sc/outputs/archive/YYYY-MM-DD/ — dated archive of each run
#   pipelines/sc/_legacy/    — old one-shot scripts, frozen pre-reorg data
WORK_DIR      = SCRIPT_DIR
RAW_DIR       = os.path.join(WORK_DIR, 'raw')
OUT_DIR       = os.path.join(WORK_DIR, 'outputs')
REF_DIR       = os.path.join(REPO_ROOT, 'AIRTABLE', 'SOUNDCLOUD', 'sc-archived')
SNAPSHOTS_DIR = os.path.join(REPO_ROOT, 'AIRTABLE', 'snapshots')

# Inputs
SC_EXPORT           = os.path.join(RAW_DIR, 'bananasutra_sc_export.csv')
# Companion to SC_EXPORT — written by bananasutra_sc_export.py from SC API playlist objects.
SC_PLAYLIST_ART_API = os.path.join(RAW_DIR, 'sc_playlist_art_api.json')
CONFIRMED_TRACKS    = os.path.join(REF_DIR,  'confirmed',       'CONFIRMED-TRACKS-4-15-26.csv')
CONFIRMED_EPS       = os.path.join(REF_DIR,  'confirmed',       'CONFIRMED-EPS-4-15-26.csv')
CONFIRMED_PLAYLISTS = os.path.join(REF_DIR,  'confirmed',       'CONFIRMED-PLAYLISTS-4-15-26.csv')
LYRICS_REF_LEGACY   = os.path.join(REF_DIR,  'lyrics-id-fixed', 'LYRICS-with airtable ids.csv')


def latest_snapshot_dir(snapshots_dir):
    """
    Return (date_str, folder_path) for the newest YYYY-MM-DD subfolder under
    AIRTABLE/snapshots/ that contains at least one Airtable export CSV.
    Returns (None, None) if no such folder exists.
    """
    if not os.path.isdir(snapshots_dir):
        return None, None
    date_dirs = sorted(
        d for d in os.listdir(snapshots_dir)
        if re.match(r'^\d{4}-\d{2}-\d{2}$', d)
        and os.path.isdir(os.path.join(snapshots_dir, d))
    )
    for d in reversed(date_dirs):
        folder = os.path.join(snapshots_dir, d)
        # Consider this a usable snapshot folder if it has at least one CSV
        if any(f.endswith('.csv') for f in os.listdir(folder)):
            return d, folder
    return None, None


def latest_snapshot_file(snapshots_dir, prefix, in_clean=False):
    """
    Return the path to the newest `{prefix}*.csv` under any YYYY-MM-DD folder
    in `snapshots_dir`. Returns None if no match.

    Picks the newest folder first, then the newest matching file in it.

    If in_clean=True (the normal case), looks inside the `clean/` subfolder
    produced by `tools/clean_airtable_snapshot.py`. Use this for any
    Airtable-native table (LYRICS, sc_tracks, sc_eps, sc_playlists, etc.)
    with the canonical snake_case prefix.

    If in_clean=False, looks at the snapshot root. Reserved for raw,
    uncanonicalized files if ever needed.
    """
    if not os.path.isdir(snapshots_dir):
        return None
    date_dirs = sorted(
        d for d in os.listdir(snapshots_dir)
        if re.match(r'^\d{4}-\d{2}-\d{2}$', d)
        and os.path.isdir(os.path.join(snapshots_dir, d))
    )
    for d in reversed(date_dirs):
        folder = os.path.join(snapshots_dir, d)
        search_dir = os.path.join(folder, 'clean') if in_clean else folder
        if not os.path.isdir(search_dir):
            continue
        hits = sorted(
            os.path.join(search_dir, f)
            for f in os.listdir(search_dir)
            if f.startswith(prefix) and f.endswith('.csv')
        )
        if hits:
            return hits[-1]
    return None


# Resolve snapshot references. All Airtable-native tables are read from the
# canonicalized `clean/` subfolder produced by `tools/clean_airtable_snapshot.py`.
# That subfolder guarantees BOM-free, snake_case headers and normalized Unicode.
# Patterns:
#     snapshots/YYYY-MM-DD/clean/lyrics-YYYY-MM-DD.csv
#     snapshots/YYYY-MM-DD/clean/sc_tracks-YYYY-MM-DD.csv
#     snapshots/YYYY-MM-DD/clean/sc_eps-YYYY-MM-DD.csv
#     snapshots/YYYY-MM-DD/clean/sc_playlists-YYYY-MM-DD.csv
# Fallbacks to legacy frozen CSVs kick in only if no canonicalized snapshot
# exists. Run `python3 tools/clean_airtable_snapshot.py` after every fresh
# Airtable export.
LYRICS_REF_AUTO       = latest_snapshot_file(SNAPSHOTS_DIR, 'lyrics', in_clean=True)
LYRICS_REF            = LYRICS_REF_AUTO or LYRICS_REF_LEGACY

SC_TRACKS_REF_AUTO    = latest_snapshot_file(SNAPSHOTS_DIR, 'sc_tracks', in_clean=True)
SC_TRACKS_REF         = SC_TRACKS_REF_AUTO or CONFIRMED_TRACKS

SC_EPS_REF_AUTO       = latest_snapshot_file(SNAPSHOTS_DIR, 'sc_eps', in_clean=True)
SC_EPS_REF            = SC_EPS_REF_AUTO or CONFIRMED_EPS

SC_PLAYLISTS_REF_AUTO = latest_snapshot_file(SNAPSHOTS_DIR, 'sc_playlists', in_clean=True)
SC_PLAYLISTS_REF      = SC_PLAYLISTS_REF_AUTO or CONFIRMED_PLAYLISTS

# Snapshot folder is still auto-detected for loading reference data, but
# the dated output filenames use today's local date — "when I built this"
# rather than "which snapshot this came from". Multiple runs off the same
# snapshot on different days get different dated archive files.
SNAPSHOT_DATE, SNAPSHOT_DIR_PATH = latest_snapshot_dir(SNAPSHOTS_DIR)

# Outputs go to pipelines/sc/outputs/ (stable names for Airtable import) plus
# a dated archive under pipelines/sc/outputs/archive/YYYY-MM-DD/.
# RUN_DATE = today's local date (the day the script is run).
RUN_DATE            = date.today().isoformat()
ARCHIVE_DIR         = os.path.join(OUT_DIR, 'archive', RUN_DATE)
OUT_TRACKS          = os.path.join(OUT_DIR, 'AT-TRACKS-v4.csv')
OUT_TRACKS_FULL     = os.path.join(OUT_DIR, 'AT-TRACKS-FULL-v4.csv')
OUT_EPS             = os.path.join(OUT_DIR, 'AT-EPS-v4.csv')
OUT_PLAYLISTS       = os.path.join(OUT_DIR, 'AT-PLAYLISTS-v4.csv')
OUT_QA              = os.path.join(OUT_DIR, 'SC-NEW-TRACKS-QA.csv')
OUT_EP_QA           = os.path.join(OUT_DIR, 'SC-NEW-EPS-QA.csv')
# Persists curator CORRECT_LYRICS_ID values across runs. SC-NEW-TRACKS-QA.csv is
# intentionally ephemeral (removed when empty); without this file, re-scrapes
# would lose manual fixes for tracks not yet in Airtable SC TRACKS snapshot.
OUT_TRACK_QA_PERSIST = os.path.join(OUT_DIR, 'SC-TRACK-QA-CORRECTIONS.csv')
OUT_SYNC            = os.path.join(OUT_DIR, 'SC-SYNC-REPORT.csv')
OUT_TRACKS_DATED    = os.path.join(ARCHIVE_DIR, f'AT-TRACKS-{RUN_DATE}.csv')
OUT_TRACKS_FULL_DATED = os.path.join(ARCHIVE_DIR, f'AT-TRACKS-FULL-{RUN_DATE}.csv')
OUT_EPS_DATED       = os.path.join(ARCHIVE_DIR, f'AT-EPS-{RUN_DATE}.csv')
OUT_PLAYLISTS_DATED = os.path.join(ARCHIVE_DIR, f'AT-PLAYLISTS-{RUN_DATE}.csv')

# Filter thresholds
MIN_PLAYS = 300
MIN_LIKES = 5

# Fuzzy match score below which a track is flagged as low-confidence in QA
QA_LOW_CONF  = 80
QA_HIGH_CONF = 90

# Optional curation metadata (kept flexible while taxonomy evolves).
TRACK_OPTIONAL_FIELD_ALIASES = {
    'mood': ['mood', 'track_mood'],
    'tempo_feel': ['tempo_feel', 'energy', 'upbeat_downbeat', 'speed_feel'],
    'curation_rating': ['curation_rating', 'track_rating', 'rating_track'],
}

# ══════════════════════════════════════════════════════════════════════════════
# GENRE SYSTEM
# ══════════════════════════════════════════════════════════════════════════════

# 11 standard genres — controlled vocabulary for Airtable multi-select
STANDARD_GENRES = [
    'BANJO', 'BLUES', 'BURLESQUE', 'DUB', 'FOLK', 'INDIE',
    'JAZZ', 'LOFI', 'MANTRA', 'ROCK', 'WORLD',
]

# Extended vocabulary for genres_full
EXTENDED_GENRES = STANDARD_GENRES + [
    'GIPSY', 'RAGGA', 'PSYCHEDELIC', 'ACOUSTIC', 'CABARET',
    'FADO', 'FLAMENCO', 'SOUL', 'TRIP HOP', 'COUNTRY',
    'ELECTRONIC', 'EXPERIMENTAL', 'CLASSICAL', 'SPOKEN WORD', 'AMBIENT',
    'SYCHEDELIC', 'HIP HOP',  # keep known SC spelling variants
]

# Aliases: SC tag text → canonical genre name
GENRE_ALIASES = {
    'lo-fi': 'LOFI', 'lo fi': 'LOFI', 'lofi': 'LOFI',
    'gypsy': 'GIPSY', 'tzigane': 'GIPSY', 'gitane': 'GIPSY',
    'reggae': 'RAGGA', 'ragga': 'RAGGA',
    'trip-hop': 'TRIP HOP', 'triphop': 'TRIP HOP',
    'hip-hop': 'HIP HOP', 'hiphop': 'HIP HOP', 'hip hop': 'HIP HOP',
    'psychedelic': 'PSYCHEDELIC', 'psych': 'PSYCHEDELIC',
    'electro': 'ELECTRONIC', 'electronic': 'ELECTRONIC',
    'burlesque': 'BURLESQUE',
    'flamenco': 'FLAMENCO',
    'cabaret': 'CABARET',
    'fado': 'FADO',
    'acoustic': 'ACOUSTIC',
    'soul': 'SOUL',
    'mantra': 'MANTRA',
    'spoken word': 'SPOKEN WORD',
    'ambient': 'AMBIENT',
}


def parse_genres(tags_raw, sc_genre):
    """
    Extract controlled vocab genres from SC tags + genre field.
    Returns (genres_std, genres_full) — both comma-separated strings.
    """
    combined = ' ' + (tags_raw or '').lower() + ' ' + (sc_genre or '').lower() + ' '
    found = []

    # Aliases first (multi-word first to avoid partial matches)
    for alias in sorted(GENRE_ALIASES, key=len, reverse=True):
        mapped = GENRE_ALIASES[alias]
        if alias in combined and mapped not in found:
            found.append(mapped)

    # Remaining extended vocab
    for g in EXTENDED_GENRES:
        if g not in found and (' ' + g.lower() + ' ' in combined or
                               ' ' + g.lower() + ',' in combined or
                               ' ' + g.lower() in combined):
            found.append(g)

    genres_full = ', '.join(found)
    genres_std  = ', '.join(g for g in found if g in STANDARD_GENRES)
    return genres_std, genres_full


# ══════════════════════════════════════════════════════════════════════════════
# SUTRA SYSTEM
# ══════════════════════════════════════════════════════════════════════════════

SUTRAS = [
    'KNOWsutra', 'GROWsutra', 'BLOWsutra', 'QUACKsutra',
    'FLOWsutra', 'GLOWsutra', 'BOWsutra', 'SHOWsutra',
]


def parse_sutra(ep_title, track_title=''):
    combined = (ep_title or '') + ' ' + (track_title or '')
    for s in SUTRAS:
        if s.lower() in combined.lower():
            return s
    return ''


# ══════════════════════════════════════════════════════════════════════════════
# INSTRUMENT PARSER
# ══════════════════════════════════════════════════════════════════════════════

INSTRUMENTS = [
    'accordion', 'banjo', 'bass', 'cello', 'clarinet', 'drums', 'fiddle',
    'flute', 'guitar', 'harmonica', 'harp', 'keyboard', 'lute', 'mandolin',
    'oboe', 'organ', 'percussion', 'piano', 'saxophone', 'sax', 'synth',
    'theremin', 'trombone', 'trumpet', 'tuba', 'ukulele', 'viola', 'violin',
]
SAX_NORM = {'sax': 'saxophone'}


def parse_instruments(title):
    t = title.lower()
    found = []
    for inst in INSTRUMENTS:
        if re.search(r'\b' + inst + r'\b', t):
            norm_inst = SAX_NORM.get(inst, inst)
            if norm_inst not in found:
                found.append(norm_inst)
    return ', '.join(sorted(found))


# ══════════════════════════════════════════════════════════════════════════════
# PLAYLIST / EP NAME CLEANING
# ══════════════════════════════════════════════════════════════════════════════

PLAYLIST_FIXES = {
    'BLOWsutra : REVOLBLOWsutra (now)':                     'BLOWsutra : REVOLT (now)',
    'KNOWsutra : BERBLOWsutraRAND (mon chéri)':             'KNOWsutra : BERTRAND (mon chéri)',
    'FOBLOWsutraUS CIRCUS Playlist An American Freaks Show': 'FOTUS CIRCUS Playlist An American Freaks Show',
    'MANBLOWsutraRAsutra':                                   'MANTRAsutra',
    "BOWsutra the last of 7 sutras, it's divine <3":         "BOWsutra the last of 7 sutras · it's divine <3",
    'FRENCHsutra oui oui, sacrebleu':                        'FRENCHsutra oui oui · sacrebleu',
    # Fragment keys — created by Airtable's comma-split on import, need merging back
    "BOWsutra the last of 7 sutras":                         "BOWsutra the last of 7 sutras · it's divine <3",
    "it's divine <3":                                        "BOWsutra the last of 7 sutras · it's divine <3",
    'FRENCHsutra oui oui':                                   'FRENCHsutra oui oui · sacrebleu',
    'sacrebleu':                                             'FRENCHsutra oui oui · sacrebleu',
}

# Known blank-genre EPs — manually confirmed
BLANK_EP_GENRES = {
    "A Man's A Man for A' That - VOL. 01 - Revolution Forever": ('FOLK, INDIE', 'FOLK, INDIE'),
    "Some Truths (Are Harder to Swallow) EPx7":                 ('BLUES, INDIE, LOFI', 'BLUES, INDIE, LOFI'),
    "Tell the Truth EP x4 BLUESsutra":                          ('BANJO, BLUES, JAZZ', 'BANJO, BLUES, JAZZ'),
    "Where We Begin (Preakly Peaches) EPx4":                    ('BURLESQUE, DUB', 'BURLESQUE, DUB'),
}


def clean_ep_title(t):
    """Replace commas → · to prevent Airtable ghost-record splitting on linked fields."""
    return re.sub(r',\s*', ' · ', (t or '').strip())


def fix_playlist_name(name):
    return PLAYLIST_FIXES.get(name.strip(), name.strip())


def _register_playlist_art_entry(
    sm_out: dict[str, str],
    lg_out: dict[str, str],
    key: str,
    art: str,
    art_lg: str,
) -> None:
    key = (key or '').strip()
    if not key:
        return
    canon = fix_playlist_name(key)
    if art:
        sm_out[canon] = art
        if key != canon:
            sm_out[key] = art
    if art_lg:
        lg_out[canon] = art_lg
        if key != canon:
            lg_out[key] = art_lg


def load_playlist_art_api_json(path: str) -> tuple[dict[str, str], dict[str, str]]:
    """Set-cover URLs from ``sc_playlist_art_api.json`` (SoundCloud playlist API objects).

    Written by ``bananasutra_sc_export.write_playlist_art_api_json`` from the same
    ``fetch_all_playlists`` payload as the scrape. This is the primary source for
    AT-PLAYLISTS artwork (see playlist table build).

    Returns ``(artwork_url_by_key, artwork_lg_url_by_key)``. Keys include canonical names,
    raw names when they differ, and playlist URLs for ``by_url`` entries.
    """
    if not os.path.isfile(path):
        return {}, {}
    sm_out: dict[str, str] = {}
    lg_out: dict[str, str] = {}
    with open(path, encoding='utf-8') as f:
        data = json.load(f)
    for bucket in ('by_name', 'by_url'):
        block = data.get(bucket) or {}
        for key, entry in block.items():
            if not isinstance(entry, dict):
                continue
            art = (entry.get('artwork_url') or '').strip()
            art_lg = (entry.get('artwork_lg_url') or '').strip()
            if not art and not art_lg:
                continue
            _register_playlist_art_entry(sm_out, lg_out, (key or '').strip(), art, art_lg)
    return sm_out, lg_out


def _strip_prioritized(*vals: str) -> str:
    for p in vals:
        s = (p or '').strip()
        if s:
            return s
    return ''


def clean_playlist_names(raw):
    """Pipe-separated → comma-separated, with PLAYLIST_FIXES applied."""
    if not (raw or '').strip():
        return ''
    parts = [p.strip() for p in (raw.split('|') if '|' in raw else raw.split(','))]
    fixed = [fix_playlist_name(p) for p in parts if p.strip()]
    # Deduplicate, preserve order
    seen, deduped = set(), []
    for p in fixed:
        if p and p not in seen:
            seen.add(p)
            deduped.append(p)
    return ', '.join(deduped)


def parse_sc_tags(raw):
    """SC raw tag format → clean comma-separated string (no quotes)."""
    tags = re.findall(r'"([^"]+)"|(\S+)', raw or '')
    result = []
    for quoted, unquoted in tags:
        val = (quoted or unquoted).strip().strip('"')
        if val:
            result.append(val)
    return ', '.join(result)


# ══════════════════════════════════════════════════════════════════════════════
# LYRICS ID RESOLVER
# ══════════════════════════════════════════════════════════════════════════════

def norm(s):
    return re.sub(r'[^a-z0-9 ]', '', (s or '').lower()).strip()


def build_lyrics_map(path):
    """
    Build maps from the LYRICS reference CSV:
      - title_to_id: normalized song title → lyrics_id (used for fuzzy matching)
      - id_to_title: lyrics_id → canonical song title
      - id_to_sutra: lyrics_id → sutra (kept for reference, but unreliable
                     across snapshots because Airtable renumbers lyrics_id
                     when rows are inserted/reordered)
      - ntitle_to_sutra: normalized song title → sutra  ← PREFERRED source of
                         truth for sutra classification. Title is stable across
                         Airtable edits; lyrics_id is not.

    Supports both column-name formats:
      - Legacy `LYRICS-with airtable ids.csv` file: `LYRICS ID`
      - Airtable snapshot export (`SONGS (Lyrics)-*.csv`): `lyrics_id`
    """
    rows = _read_csv(path)[0]
    title_to_id = {}
    id_to_title = {}
    id_to_sutra = {}
    ntitle_to_sutra = {}

    def _get_ci(r, *names):
        """Case-insensitive column lookup that also tolerates stray BOM / whitespace
        in column headers (Airtable exports sometimes embed a \ufeff inside the
        first header, which utf-8-sig won't strip on its own)."""
        targets = {n.lower() for n in names}
        for k, v in r.items():
            if k is None:
                continue
            kk = k.lstrip('\ufeff').strip().lower()
            if kk in targets:
                return v
        return None

    for r in rows:
        t     = (_get_ci(r, 'SONG TITLE', 'song_title', 'song title') or '').strip()
        lid   = normalize_lid(_get_ci(r, 'LYRICS ID', 'lyrics_id') or '')
        sutra = (_get_ci(r, 'SUTRA', 'sutra') or '').strip()
        if not (t and lid):
            continue
        key = norm(t)
        if key not in title_to_id:  # first match wins (handles duplicate "Kindness")
            title_to_id[key] = lid
            id_to_title[lid] = t
        if sutra and lid not in id_to_sutra:
            id_to_sutra[lid] = sutra
        if sutra and key not in ntitle_to_sutra:
            ntitle_to_sutra[key] = sutra
    return title_to_id, id_to_title, id_to_sutra, ntitle_to_sutra


def normalize_lid(lid):
    """Normalize a lyrics_id to 'L-<int>' form. Strips leading zeros so that
    e.g. 'L-047' and 'L-47' both resolve to 'L-47'. Empty / malformed IDs
    pass through unchanged."""
    s = (lid or '').strip()
    if not s:
        return ''
    m = re.match(r'^L-(\d+)$', s, re.I)
    if m:
        return 'L-' + str(int(m.group(1)))
    return s


def normalize_track_in_app_for_airtable(raw: str) -> str:
    """Airtable checkbox-style values for SC track_in_app / ep_in_app."""
    v = (raw or '').strip().lower()
    if v in ('1', 'true', 'yes', 'y', 'on', 'checked'):
        return 'checked'
    return 'unchecked'


def resolve_against_snapshot(ref, id_to_title, id_to_sutra, title_to_id,
                             fuzz_thresh=85):
    """
    Resolve a confirmed SC-TRACK ref to its LYRICS-snapshot-aligned
    (lyrics_id, lyrics_title, sutra).

    RESOLUTION ORDER (ID-primary, title-secondary):

      1. ID-primary: ref.lyrics_id is the authoritative bridge — user
         maintains it manually in the SC TRACKS Airtable table, and the
         SC TRACKS snapshot is what we load here. If that lyrics_id
         exists in the LYRICS snapshot, use its canonical title and
         sutra. If the title in LYRICS differs from ref.lyrics_title,
         the user edited the title in LYRICS — surface as `title_edit`
         so the sync report can show it, but keep the ID.

      2. Title-secondary (fallback): if ref.lyrics_id is missing OR no
         longer exists in the LYRICS snapshot, try to heal via
         ref.lyrics_title → LYRICS snapshot. Exact match first, then
         fuzzy. A successful title-bridge yields `id_drift_resolved`;
         the final lyrics_id becomes the *new* one from the LYRICS
         snapshot, on the assumption that LYRICS is authoritative and
         the SC TRACKS ref carries a stale ID.

      3. Unresolved: ref.lyrics_id isn't in LYRICS AND ref.lyrics_title
         can't be matched. Emit `id_drift_unresolved` so the user can
         fix it in Airtable. The ref's own values pass through.

    Returns:
      (lyrics_id, lyrics_title, sutra, sync_flag, snap_at_conf_title,
       snap_at_conf_sutra)

      snap_at_conf_* = what LYRICS has at the confirmed lyrics_id right
      now (empty string if that lid isn't in LYRICS). Useful in the sync
      report for seeing exactly what drifted.

    sync_flag is one of:
      ''                        — clean ID-primary resolution
      'title_edit'              — ID resolved, but title differs in LYRICS
      'id_drift_resolved'       — confirmed ID gone; title bridged to new ID
      'id_drift_resolved_fuzzy' — confirmed ID gone; fuzzy title match only
      'id_drift_unresolved'     — confirmed ID gone AND title not in LYRICS
      'id_missing_title_match'  — no confirmed ID, but title is in LYRICS
      'track_id_not_confirmed'  — track_id not in SC TRACKS snapshot
    """
    ct  = (ref.get('lyrics_title') or '').strip()
    cs  = (ref.get('sutra') or '').strip()
    lid = normalize_lid(ref.get('lyrics_id') or '')

    # What does the LYRICS snapshot hold at the confirmed lid right now?
    snap_at_conf_title = id_to_title.get(lid, '') if lid else ''
    snap_at_conf_sutra = id_to_sutra.get(lid, '') if lid else ''

    # ── 1. ID-primary ─────────────────────────────────────────────────────
    if lid and lid in id_to_title:
        final_title = id_to_title[lid]
        final_sutra = id_to_sutra.get(lid, cs)
        # Title drift inside a live ID — LYRICS wins (user edited canonical)
        if ct and norm(ct) != norm(final_title):
            return (lid, final_title, final_sutra, 'title_edit',
                    snap_at_conf_title, snap_at_conf_sutra)
        return (lid, final_title, final_sutra, '',
                snap_at_conf_title, snap_at_conf_sutra)

    # ── 2. Title-secondary (healing bridge for stale lids) ────────────────
    if ct:
        key = norm(ct)
        if key in title_to_id:
            new_lid = title_to_id[key]
            flag    = 'id_drift_resolved' if lid else 'id_missing_title_match'
            return (new_lid, id_to_title.get(new_lid, ct),
                    id_to_sutra.get(new_lid, cs), flag,
                    snap_at_conf_title, snap_at_conf_sutra)

        # Fuzzy title match — minor edits like punctuation / articles
        best_score, best_key = 0, ''
        for k in title_to_id:
            score = fuzz.token_sort_ratio(key, k)
            if score > best_score:
                best_score, best_key = score, k
        if best_score >= fuzz_thresh:
            new_lid = title_to_id[best_key]
            flag    = 'id_drift_resolved_fuzzy' if lid else 'title_fuzzy_match'
            return (new_lid, id_to_title.get(new_lid, ct),
                    id_to_sutra.get(new_lid, cs), flag,
                    snap_at_conf_title, snap_at_conf_sutra)

    # ── 3. Unresolved — surface for manual fix ────────────────────────────
    if lid:
        # Keep confirmed values but flag
        return (lid, ct, cs, 'id_drift_unresolved',
                snap_at_conf_title, snap_at_conf_sutra)
    return ('', ct, cs, 'title_not_in_snapshot',
            snap_at_conf_title, snap_at_conf_sutra)


def resolve_lyrics_id(candidate_title, title_to_id):
    """
    Try to match a song name to a lyrics_id.
    Returns (lyrics_id, score) — score=100 for exact match, 0 if no match.
    """
    lt = (candidate_title or '').strip()
    if not lt:
        return '', 0
    key = norm(lt)
    if key in title_to_id:
        return title_to_id[key], 100
    best_score, best_id = 0, ''
    for k, lid in title_to_id.items():
        score = fuzz.token_sort_ratio(key, k)
        if score > best_score:
            best_score, best_id = score, lid
    if best_score >= QA_LOW_CONF:
        return best_id, best_score
    return '', best_score


def extract_song_name(track_title):
    """
    Heuristic extraction of the song name from a track title.

    Track titles follow patterns like:
      [01] Song Name • EP title Sutra Genre1 Genre2
      Side A [04] Song Name • ...
      *[03] Song Name • ...
    """
    t = (track_title or '').strip()
    # Strip leading positional prefix: [N], *[N], Side X [N]
    t = re.sub(r'^\*?(?:Side\s+[A-Z]\s+)?\[\d+\]\s*', '', t).strip()
    # Take everything before the first bullet separator
    for sep in ['•', '★', '☆', '⭐']:
        if sep in t:
            t = t.split(sep)[0].strip()
            break
    return t


# ══════════════════════════════════════════════════════════════════════════════
# CSV HELPERS
# ══════════════════════════════════════════════════════════════════════════════

def _read_csv(path, enc='utf-8-sig'):
    """Read a CSV as (rows, headers), stripping any stray BOM / whitespace
    from column names. utf-8-sig removes the BOM at the start of the file,
    but Airtable exports occasionally embed \ufeff inside individual header
    cells (especially the first header), which won't be handled otherwise.
    """
    with open(path, newline='', encoding=enc) as f:
        reader = csv.DictReader(f)
        raw_headers = list(reader.fieldnames or [])
        rows = list(reader)
    # Normalize: strip BOMs and outer whitespace from every header
    headers = [(h or '').lstrip('\ufeff').strip() for h in raw_headers]
    if headers != raw_headers:
        # Re-key each row so downstream callers see clean column names
        rename = dict(zip(raw_headers, headers))
        rows = [{rename.get(k, k): v for k, v in r.items()} for r in rows]
    return rows, headers


def _write_csv(path, rows, headers):
    # Ensure parent dir exists (e.g. outputs/archive/YYYY-MM-DD/ on first run).
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', newline='', encoding='utf-8') as f:
        w = csv.DictWriter(f, fieldnames=headers, extrasaction='ignore')
        w.writeheader()
        w.writerows(rows)


def _duration_to_secs(dur):
    if not dur:
        return 0
    parts = (dur or '').split(':')
    try:
        if len(parts) == 2:
            return int(parts[0]) * 60 + int(parts[1])
        if len(parts) == 3:
            return int(parts[0]) * 3600 + int(parts[1]) * 60 + int(parts[2])
    except ValueError:
        pass
    return 0


def _secs_to_hms(secs):
    secs = int(secs)
    h, rem = divmod(secs, 3600)
    m, s = divmod(rem, 60)
    return f"{h}:{m:02d}:{s:02d}"


def _pick_first_value(row, keys):
    """Return first non-empty value from row using ordered key candidates."""
    for key in keys:
        value = (row.get(key, '') or '').strip()
        if value:
            return value
    return ''


def _merge_prefer_nonempty(base_row, override_row):
    """Merge two dict rows with non-empty override values winning."""
    out = dict(base_row)
    for k, v in override_row.items():
        if isinstance(v, str):
            if v.strip():
                out[k] = v
        elif v is not None:
            out[k] = v
    return out


def _lyrics_ids_from_cell(raw: str) -> list[str]:
    """Split a cell that may contain one or more L-ids (comma / slash separated)."""
    if not (raw or "").strip():
        return []
    parts = re.split(r"[,;/|]+", raw)
    out: list[str] = []
    for p in parts:
        lid = normalize_lid(p.strip())
        if lid and lid not in out:
            out.append(lid)
    return out


def _ep_lyrics_resolved(ep: dict, id_to_title: dict[str, str]) -> bool:
    """True if EP row has a resolvable lyrics_id → non-empty title in LYRICS snapshot."""
    title = (ep.get("lyrics_title") or "").strip()
    if title:
        return True
    lids = _lyrics_ids_from_cell(ep.get("lyrics_id", "") or "")
    if not lids:
        return False
    return any(id_to_title.get(lid, "").strip() for lid in lids)


def _ep_curation_from_snapshot(conf: dict) -> dict[str, str]:
    """Editorial EP fields from clean/sc_eps only — not derived from the scrape."""
    if not conf:
        return {"ep_featured": "", "ep_description": "", "ep_songbook_title": ""}
    return {
        "ep_featured": (conf.get("ep_featured") or "").strip(),
        "ep_description": (conf.get("ep_description") or "").strip(),
        "ep_songbook_title": (conf.get("ep_songbook_title") or "").strip(),
    }


def _load_persisted_track_corrections(path: str) -> dict[str, dict]:
    if not os.path.exists(path):
        return {}
    rows, _ = _read_csv(path, enc='utf-8-sig')
    out: dict[str, dict] = {}
    for r in rows:
        tid = (r.get('track_id') or '').strip()
        if tid:
            out[tid] = r
    return out


def _merge_track_qa_overrides(
    qa_overrides: dict[str, dict],
    persisted: dict[str, dict],
) -> None:
    """Merge persisted track QA rows into qa_overrides (from SC-NEW-TRACKS-QA.csv).

    SC-NEW-TRACKS-QA wins for most fields, but a stale QA row with a blank
    CORRECT_LYRICS_ID must not erase a correction already saved to
    SC-TRACK-QA-CORRECTIONS.csv — otherwise EP fixes + QA file churn cause ping-pong.

    Same for track_in_app: once set in the persist file, it survives removal of
    SC-NEW-TRACKS-QA.csv after lyrics QA clears (avoids re-opening the same rows
    only because in-app was still unchecked).
    """
    for tid, prow in persisted.items():
        qrow = qa_overrides.get(tid)
        if not qrow:
            qa_overrides[tid] = dict(prow)
            continue
        merged = dict(qrow)
        p_lid = normalize_lid((prow.get('CORRECT_LYRICS_ID') or '').strip())
        q_lid = normalize_lid((qrow.get('CORRECT_LYRICS_ID') or '').strip())
        if p_lid and not q_lid:
            merged['CORRECT_LYRICS_ID'] = p_lid
        p_ti_raw = (prow.get('track_in_app') or '').strip()
        q_ti_raw = (merged.get('track_in_app') or '').strip()
        if p_ti_raw and not q_ti_raw:
            merged['track_in_app'] = normalize_track_in_app_for_airtable(p_ti_raw)
        # Carry forward last-seen titles from persist when QA row omits them
        for k in ('track_title', 'ep_title'):
            if not (merged.get(k) or '').strip() and (prow.get(k) or '').strip():
                merged[k] = prow[k]
        qa_overrides[tid] = merged


def _write_persisted_track_corrections(path: str, qa_overrides: dict[str, dict]) -> int:
    """Persist CORRECT_LYRICS_ID and/or explicit track_in_app (survives SC-NEW-TRACKS-QA removal)."""
    rows = []
    def _sort_track_id(tid: str):
        return (0, int(tid)) if str(tid).isdigit() else (1, str(tid))

    for tid in sorted(qa_overrides, key=_sort_track_id):
        row = qa_overrides[tid]
        lid = normalize_lid((row.get('CORRECT_LYRICS_ID') or '').strip())
        raw_ti = (row.get('track_in_app') or '').strip()
        ti = normalize_track_in_app_for_airtable(raw_ti) if raw_ti else ''
        if not lid and not ti:
            continue
        rows.append({
            'track_id': tid,
            'CORRECT_LYRICS_ID': lid,
            'last_seen_track_title': (row.get('track_title') or '').strip(),
            'last_seen_ep_title': (row.get('ep_title') or '').strip(),
            'track_in_app': ti,
        })
    headers = [
        'track_id', 'CORRECT_LYRICS_ID', 'last_seen_track_title', 'last_seen_ep_title', 'track_in_app',
    ]
    if rows:
        _write_csv(path, rows, headers)
    elif os.path.exists(path):
        os.remove(path)
    return len(rows)


# ══════════════════════════════════════════════════════════════════════════════
# MAIN
# ══════════════════════════════════════════════════════════════════════════════

def main():
    print("=" * 60)
    print("  BananaSutra — Build Final v4")
    print("  Full pipeline: raw SC export → Airtable-ready CSVs")
    print("=" * 60)

    # ── 1. Load reference data ────────────────────────────────────────────────
    print("\n[1] Loading reference data...")

    # Announce which SC TRACKS / EPS / PLAYLISTS refs got picked (snapshot vs legacy)
    def _announce(label, auto_path, final_path):
        if auto_path:
            print(f"  ✓ {label} ref (latest snapshot): "
                  f"{os.path.relpath(final_path, REPO_ROOT)}")
        else:
            print(f"  ⚠  {label} ref (no snapshot — using legacy): "
                  f"{os.path.relpath(final_path, REPO_ROOT)}")

    _announce('SC TRACKS',    SC_TRACKS_REF_AUTO,    SC_TRACKS_REF)
    _announce('SC EPS',       SC_EPS_REF_AUTO,       SC_EPS_REF)
    _announce('SC PLAYLISTS', SC_PLAYLISTS_REF_AUTO, SC_PLAYLISTS_REF)

    if LYRICS_REF_AUTO:
        print(f"  ✓ LYRICS ref (canonicalized snapshot): "
              f"{os.path.relpath(LYRICS_REF, REPO_ROOT)}")
    else:
        print(f"  ⚠  LYRICS ref (no canonicalized snapshot — using legacy): "
              f"{os.path.relpath(LYRICS_REF, REPO_ROOT)}")
        print(f"     To refresh: drop a new Airtable export into")
        print(f"       AIRTABLE/snapshots/YYYY-MM-DD/SONGS (Lyrics)-YYYY-MM-DD.csv")
        print(f"     then run: python3 tools/clean_airtable_snapshot.py")
        print(f"     (produces AIRTABLE/snapshots/YYYY-MM-DD/clean/lyrics-YYYY-MM-DD.csv)")

    # Announce RUN_DATE so it's clear which date is being stamped on dated outputs
    snap_note = (f"  (snapshot folder is {SNAPSHOT_DATE})" if SNAPSHOT_DATE else "")
    print(f"  ✓ RUN_DATE = {RUN_DATE}  (today's local date){snap_note}")

    # Load confirmed tracks from latest snapshot + historical clean snapshots +
    # legacy confirmed fallback, then merge by track_id with newest non-empty
    # values winning. This prevents lyrics_id loss when the latest Airtable
    # export is intentionally partial.
    conf_track_rows, _ = _read_csv(SC_TRACKS_REF, enc='utf-8-sig')
    snapshot_by_id = {
        str(r.get('track_id', '')).strip(): r
        for r in conf_track_rows
        if (r.get('track_id') or '').strip()
    }

    historical_track_rows = []
    historical_paths = []
    if os.path.isdir(SNAPSHOTS_DIR):
        dated = sorted(
            d for d in os.listdir(SNAPSHOTS_DIR)
            if re.match(r'^\d{4}-\d{2}-\d{2}$', d)
            and os.path.isdir(os.path.join(SNAPSHOTS_DIR, d))
        )
        for d in dated:
            clean_dir = os.path.join(SNAPSHOTS_DIR, d, 'clean')
            if not os.path.isdir(clean_dir):
                continue
            hits = sorted(
                os.path.join(clean_dir, f)
                for f in os.listdir(clean_dir)
                if f.startswith('sc_tracks-') and f.endswith('.csv')
            )
            if not hits:
                continue
            p = hits[-1]
            if os.path.abspath(p) == os.path.abspath(SC_TRACKS_REF):
                continue
            rows, _ = _read_csv(p, enc='utf-8-sig')
            historical_track_rows.extend(rows)
            historical_paths.append(p)
    historical_by_id = {
        str(r.get('track_id', '')).strip(): r
        for r in historical_track_rows
        if (r.get('track_id') or '').strip()
    }

    legacy_track_rows = []
    if os.path.abspath(SC_TRACKS_REF) != os.path.abspath(CONFIRMED_TRACKS) and os.path.exists(CONFIRMED_TRACKS):
        legacy_track_rows, _ = _read_csv(CONFIRMED_TRACKS, enc='utf-8-sig')
    legacy_by_id = {
        str(r.get('track_id', '')).strip(): r
        for r in legacy_track_rows
        if (r.get('track_id') or '').strip()
    }

    confirmed_by_id = {}
    for source in (legacy_by_id, historical_by_id, snapshot_by_id):
        for tid, row in source.items():
            if tid in confirmed_by_id:
                confirmed_by_id[tid] = _merge_prefer_nonempty(confirmed_by_id[tid], row)
            else:
                confirmed_by_id[tid] = row

    print(f"  ✓ Confirmed tracks (snapshot): {len(snapshot_by_id)}")
    if historical_paths:
        print(f"  ✓ Confirmed tracks (historical snapshots): {len(historical_by_id)} from {len(historical_paths)} files")
    if legacy_by_id:
        print(f"  ✓ Confirmed tracks (legacy):              {len(legacy_by_id)}")
    print(f"  ✓ Confirmed tracks (merged):              {len(confirmed_by_id)}")

    # Load confirmed EPs from SC EPS snapshot (or legacy fallback).
    conf_ep_rows, _ = _read_csv(SC_EPS_REF, enc='utf-8-sig')
    confirmed_eps = {
        clean_ep_title(r.get('ep_title', '').strip()): r
        for r in conf_ep_rows
        if (r.get('ep_title') or '').strip()
    }
    # Case-insensitive fallback — SC export occasionally lowercases EP titles
    confirmed_eps_lower = {k.lower(): v for k, v in confirmed_eps.items()}
    # URL-keyed fallback — raw SC EP title and confirmed (canonical) EP title
    # are often intentionally different (e.g. "We're Tiny Specks, Right?" vs.
    # "We're Tiny Specks · Right • BOWsutra"). URL is the stable identifier.
    confirmed_eps_by_url = {
        (r.get('ep_url') or '').strip(): r
        for r in conf_ep_rows
        if (r.get('ep_url') or '').strip()
    }
    print(f"  ✓ Confirmed EPs:     {len(confirmed_eps)}")

    # Load confirmed playlists from SC PLAYLISTS snapshot (or legacy fallback).
    conf_pl_rows, _ = _read_csv(SC_PLAYLISTS_REF, enc='utf-8-sig')
    confirmed_playlists = {
        r.get('playlist_name', '').strip(): r
        for r in conf_pl_rows
        if (r.get('playlist_name') or '').strip()
    }
    print(f"  ✓ Confirmed PLAYLISTs: {len(confirmed_playlists)}")

    playlist_art_sm_from_api, playlist_art_lg_from_api = load_playlist_art_api_json(SC_PLAYLIST_ART_API)
    if playlist_art_sm_from_api or playlist_art_lg_from_api:
        print(
            f"  ✓ Playlist art API: {len(playlist_art_sm_from_api)} sm keys, "
            f"{len(playlist_art_lg_from_api)} lg keys in "
            f"{os.path.basename(SC_PLAYLIST_ART_API)}"
        )

    title_to_id, id_to_title, id_to_sutra, ntitle_to_sutra = build_lyrics_map(LYRICS_REF)
    print(f"  ✓ LYRICS map:        {len(title_to_id)} entries "
          f"({len(id_to_sutra)} with sutra classification)")

    # ── Load QA overrides: persisted CORRECT_LYRICS_ID + optional SC-NEW-TRACKS-QA.csv ─
    # Any field the user edits in the QA file — extracted_genre, auto_lyrics_id, sutra,
    # CORRECT_SONG_TITLE — is applied to the final output on re-run.
    qa_overrides = {}  # track_id → full QA row dict
    persisted_track_qa = _load_persisted_track_corrections(OUT_TRACK_QA_PERSIST)
    if os.path.exists(OUT_QA):
        qa_rows_prev, _ = _read_csv(OUT_QA)
        for q in qa_rows_prev:
            tid = q.get('track_id', '').strip()
            if tid:
                qa_overrides[tid] = q
        if qa_overrides:
            print(f"  ✓ QA overrides loaded: {len(qa_overrides)} tracks from {os.path.basename(OUT_QA)}")
    if persisted_track_qa:
        _merge_track_qa_overrides(qa_overrides, persisted_track_qa)
        print(f"  ✓ Merged {len(persisted_track_qa)} persisted row(s) from "
              f"{os.path.basename(OUT_TRACK_QA_PERSIST)} (CORRECT_LYRICS_ID / track_in_app)")

    ep_qa_by_url: dict[str, dict] = {}
    ep_qa_by_title_norm: dict[str, dict] = {}
    if os.path.exists(OUT_EP_QA):
        ep_qa_rows, _ = _read_csv(OUT_EP_QA)
        for row in ep_qa_rows:
            url = (row.get('ep_url') or '').strip()
            if url:
                ep_qa_by_url[url] = row
            title = (row.get('ep_title') or '').strip()
            if title:
                ep_qa_by_title_norm[title.lower()] = row
        if ep_qa_rows:
            print(f"  ✓ EP QA overrides loaded: {len(ep_qa_rows)} rows from {os.path.basename(OUT_EP_QA)}")

    # ── 2. Load raw SC export ─────────────────────────────────────────────────
    print("\n[2] Loading raw SC export...")
    raw_rows, _ = _read_csv(SC_EXPORT, enc='utf-8')
    print(f"  ✓ Raw tracks: {len(raw_rows)}")
    raw_by_track_id = {
        str(r.get('track_id', '')).strip(): r
        for r in raw_rows
        if (r.get('track_id') or '').strip()
    }

    # ── 3. Filter stats (import set vs full export) ───────────────────────────
    # Threshold applies in step 4 per row → out_tracks vs out_tracks_full.
    # We do not drop rows from raw_rows; FULL always mirrors the scrape 1:1.
    print("\n[3] Import-set filter (for AT-TRACKS-v4.csv only)...")
    import_set_count = 0
    for r in raw_rows:
        plays = int(r.get('play_count', 0) or 0)
        likes = int(r.get('like_count', 0) or 0)
        if plays >= MIN_PLAYS or likes >= MIN_LIKES:
            import_set_count += 1

    print(
        f"  ✓ {import_set_count}/{len(raw_rows)} tracks qualify for Airtable import "
        f"(play_count≥{MIN_PLAYS} OR like_count≥{MIN_LIKES}); "
        f"{len(raw_rows) - import_set_count} long-tail rows → AT-TRACKS-FULL-v4.csv only"
    )

    # ── 3b. Build playlist URL index ──────────────────────────────────────────
    backup_url_to_name = {
        r['playlist_url'].strip(): r['playlist_name'].strip()
        for r in conf_pl_rows
        if r.get('playlist_url', '').strip()
    }
    sc_name_to_url     = {}
    sc_name_to_artwork = {}
    sc_name_to_artwork_lg = {}

    for r in raw_rows:
        names_raw = r.get('playlist_names', '')
        urls_raw  = r.get('playlist_urls', '')
        if not names_raw:
            continue
        sep   = '|' if '|' in names_raw else ','
        names = [p.strip() for p in names_raw.split(sep)]
        urls  = [u.strip() for u in urls_raw.split(sep)] if urls_raw else []
        for i, sc_name in enumerate(names):
            if not sc_name or sc_name in sc_name_to_url:
                continue
            url = urls[i] if i < len(urls) else ''
            if url:
                sc_name_to_url[sc_name] = url
            if r.get('artwork_url') and sc_name not in sc_name_to_artwork:
                sc_name_to_artwork[sc_name] = r['artwork_url']
            if sc_name not in sc_name_to_artwork_lg:
                raw_lg = (r.get('artwork_lg_url') or '').strip()
                if not raw_lg and (r.get('artwork_url') or '').strip():
                    _, raw_lg = sndcdn_artwork_sm_lg(r.get('artwork_url', ''))
                if raw_lg:
                    sc_name_to_artwork_lg[sc_name] = raw_lg

    def resolve_pl_name(sc_name):
        url = sc_name_to_url.get(sc_name, '')
        if url and url in backup_url_to_name:
            return backup_url_to_name[url]
        return fix_playlist_name(sc_name)

    def clean_and_resolve_playlist_names(raw):
        if not (raw or '').strip():
            return ''
        sep   = '|' if '|' in raw else ','
        parts = [p.strip() for p in raw.split(sep)]
        seen, result = set(), []
        for p in parts:
            if not p:
                continue
            canonical = resolve_pl_name(p)
            if canonical and canonical not in seen:
                seen.add(canonical)
                result.append(canonical)
        return ', '.join(result)

    # ── 4. Process tracks (delta logic) ───────────────────────────────────────
    print("\n[4] Processing tracks (delta logic)...")

    out_tracks  = []  # filtered tracks (Airtable import set)
    out_tracks_full = []  # unfiltered tracks (complete export)
    qa_out      = []
    sync_issues = []   # rows flagged by resolve_against_snapshot (ID/title drift)
    known_count = new_count = 0
    known_count_full = new_count_full = 0

    # Column order: identity → LYRICS-resolved fields → top-line stats → sutra/
    # genres/instruments → EP context → playlist context → secondary stats →
    # metadata → SC-specific → IDs last. duration/play_count/like_count are
    # pulled forward (right after lyrics_title) for at-a-glance scanning.
    TRACK_HEADERS = [
        'track_title', 'sc_url', 'lyrics_title',
        'duration', 'play_count', 'like_count',
        'sutra', 'primary_genre', 'secondary_genre', 'extracted_genre', 'instruments',
        'mood', 'tempo_feel', 'curation_rating',
        'fav_track', 'liked_track', 'track_in_app',
        'ep_title', 'ep_url', 'ep_volume', 'ep_track_number', 'ep_total_tracks',
        'playlist_names_clean', 'playlist_count',
        'repost_count', 'comment_count',
        'created_at', 'bpm', 'artwork_url', 'artwork_lg_url', 'waveform_url',
        'soundcloud_genre', 'tags', 'description', 'license', 'track_type',
        'purchase_url', 'download_url', 'track_id', 'lyrics_id',
    ]

    for r in raw_rows:
        tid         = str(r.get('track_id', '')).strip()
        track_title = r.get('title', '').strip()
        ep_raw      = r.get('ep_title', '').strip()
        ep_title    = clean_ep_title(ep_raw)
        tags_clean  = parse_sc_tags(r.get('tags', ''))
        pl_clean    = clean_and_resolve_playlist_names(r.get('playlist_names', ''))
        plays       = int(r.get('play_count', 0) or 0)
        likes       = int(r.get('like_count', 0) or 0)
        is_filtered_track = plays >= MIN_PLAYS or likes >= MIN_LIKES
        extracted_genres_std, _ = parse_genres(r.get('tags', ''), r.get('genre', ''))

        # Duration: prefer 'duration' field; fall back to 'duration_seconds'
        # (older SC export versions output duration_seconds instead of duration)
        raw_duration = r.get('duration', '').strip()
        if not raw_duration:
            ds = int(r.get('duration_seconds', 0) or 0)
            if ds:
                m, s = divmod(ds, 60)
                raw_duration = f"{m}:{s:02d}"

        raw_art_sm = r.get('artwork_url', '')
        raw_art_lg = (r.get('artwork_lg_url') or '').strip()
        if not raw_art_lg and raw_art_sm:
            _, raw_art_lg = sndcdn_artwork_sm_lg(raw_art_sm)

        # Common refreshable fields (same for known and new)
        common = {
            'track_title':          track_title,
            'sc_url':               r.get('sc_url', ''),
            'ep_title':             ep_title,
            'ep_url':               r.get('ep_url', ''),
            'ep_volume':            (r.get('ep_volume', '') or r.get('volume', '')),
            'ep_track_number':      r.get('ep_track_number', ''),
            'ep_total_tracks':      r.get('ep_total_tracks', ''),
            'playlist_names_clean': pl_clean,
            'playlist_count':       r.get('playlist_count', ''),
            'play_count':           r.get('play_count', ''),
            'like_count':           r.get('like_count', ''),
            'repost_count':         r.get('repost_count', ''),
            'comment_count':        r.get('comment_count', ''),
            'duration':             raw_duration,
            'created_at':           r.get('created_at', ''),
            'bpm':                  r.get('bpm', ''),
            'artwork_url':          raw_art_sm,
            'artwork_lg_url':       raw_art_lg,
            'waveform_url':         r.get('waveform_url', ''),
            'soundcloud_genre':     r.get('genre', ''),
            'tags':                 tags_clean,
            'description':          r.get('description', ''),
            'license':              r.get('license', ''),
            'track_type':           r.get('track_type', ''),
            'purchase_url':         r.get('purchase_url', ''),
            'download_url':         r.get('download_url', ''),
            'track_id':             tid,
            'instruments':          parse_instruments(track_title),
            'liked_track':          r.get('user_liked', ''),
        }

        if tid in confirmed_by_id:
            # ── KNOWN: preserve confirmed editorial data ──────────────────────
            known_count_full += 1
            if is_filtered_track:
                known_count += 1
            ref = confirmed_by_id[tid]
            # For fields the raw export may not supply (older scraper versions
            # lack artwork_url, waveform_url, duration, bpm, etc.) fall back to
            # confirmed data so these fields are never silently blank.
            def _fb(field):
                return common[field] or ref.get(field, '')

            # ID-primary resolution against LYRICS snapshot, with title
            # fallback for historical lid drift. See resolve_against_snapshot.
            (final_lid, final_title, final_sutra, sync_flag,
             snap_at_conf_title, snap_at_conf_sutra) = resolve_against_snapshot(
                ref, id_to_title, id_to_sutra, title_to_id)
            if sync_flag and is_filtered_track:
                sync_issues.append({
                    'case':                          sync_flag,
                    'track_id':                      tid,
                    'track_title':                   track_title,
                    'ep_title':                      ep_title,
                    'confirmed_lyrics_id':           normalize_lid(ref.get('lyrics_id') or ''),
                    'confirmed_title':               (ref.get('lyrics_title') or '').strip(),
                    'confirmed_sutra':               (ref.get('sutra') or '').strip(),
                    'snapshot_at_confirmed_id_title': snap_at_conf_title,
                    'snapshot_at_confirmed_id_sutra': snap_at_conf_sutra,
                    'resolved_lyrics_id':            final_lid,
                    'resolved_title':                final_title,
                    'resolved_sutra':                final_sutra,
                })

            track_out_row = {
                **common,
                'duration':     _fb('duration'),
                'artwork_url':  _fb('artwork_url'),
                'artwork_lg_url': _fb('artwork_lg_url'),
                'waveform_url': _fb('waveform_url'),
                'bpm':          _fb('bpm'),
                'license':      _fb('license'),
                'track_type':   _fb('track_type'),
                'purchase_url': _fb('purchase_url'),
                'download_url': _fb('download_url'),
                'lyrics_title': final_title,
                'sutra':        final_sutra,
                'primary_genre': _pick_first_value(ref, ['primary_genre', 'genres']),
                'secondary_genre': _pick_first_value(ref, ['secondary_genres', 'secondary_genre']),
                'extracted_genre': extracted_genres_std,
                'mood': _pick_first_value(ref, TRACK_OPTIONAL_FIELD_ALIASES['mood']),
                'tempo_feel': _pick_first_value(ref, TRACK_OPTIONAL_FIELD_ALIASES['tempo_feel']),
                'curation_rating': _pick_first_value(ref, TRACK_OPTIONAL_FIELD_ALIASES['curation_rating']),
                'fav_track':    ref.get('fav_track', ''),
                'liked_track':  _pick_first_value(ref, ['liked_track', 'user_liked']) or common.get('liked_track', ''),
                'track_in_app': normalize_track_in_app_for_airtable(ref.get('track_in_app', '')),
                'lyrics_id':    final_lid,
            }
            out_tracks_full.append(track_out_row)
            if is_filtered_track:
                out_tracks.append(track_out_row)

        else:
            # ── NEW: auto-parse + fuzzy match + QA ───────────────────────────
            new_count_full += 1
            if is_filtered_track:
                new_count += 1

            if tid in qa_overrides:
                # ── Re-run: use whatever the user left in the QA file ────────
                qr         = qa_overrides[tid]
                # ID-primary correction: curator types CORRECT_LYRICS_ID (e.g.
                # "L-312") to override a bad auto-match. When present, it wins
                # and we pull canonical title + sutra from the LYRICS snapshot.
                # This eliminates the typo landmine of hand-typed titles
                # (historical bug: "Zero Sum (Zero. Sean)" with stray period
                # self-propagated across runs via CORRECT_SONG_TITLE).
                corrected_lid = normalize_lid(qr.get('CORRECT_LYRICS_ID', '').strip())
                auto_lid      = normalize_lid(qr.get('auto_lyrics_id', '').strip())
                lyrics_id     = corrected_lid or auto_lid
                if corrected_lid:
                    merged_qr = dict(qr)
                    merged_qr['CORRECT_LYRICS_ID'] = corrected_lid
                    qa_overrides[tid] = merged_qr
                # song_name → lyrics_title in output. When we have a resolved
                # lyrics_id, use the canonical title from LYRICS; otherwise
                # fall back to the prior run's extracted_song_name.
                song_name  = (id_to_title.get(lyrics_id, '') if lyrics_id
                              else qr.get('extracted_song_name', '').strip())
                genres_std = (qr.get('extracted_genre') or qr.get('genres') or '').strip()
                # ID-primary sutra lookup: trust the (possibly corrected) lid,
                # then fall back to QA-supplied sutra, then to title-parsed.
                sutra_from_lyrics = id_to_sutra.get(lyrics_id, '') if lyrics_id else ''
                sutra      = (sutra_from_lyrics
                              or qr.get('sutra', '').strip()
                              or parse_sutra(ep_title, track_title))
                # match_score may have been written as a float string on the prior run
                # (e.g. '61.53846154'), so go through float() before int() to coerce safely.
                score      = int(float(qr.get('match_score', 0) or 0))
                matched_title = id_to_title.get(lyrics_id, '') if lyrics_id else ''

                was_corrected = bool(corrected_lid)
                if was_corrected and lyrics_id not in id_to_title:
                    # Curator typed a lyrics_id that isn't in the LYRICS
                    # snapshot — flag for follow-up.
                    confidence = 'CORRECTED (but lyrics_id not in LYRICS — add it)'
                elif was_corrected:
                    confidence = 'CORRECTED ✓'
                else:
                    confidence = qr.get('confidence', '')
                    if not confidence or confidence.startswith('LOW'):
                        confidence = 'LOW — fill in below'

            else:
                # ── First run: auto-generate everything ──────────────────────
                sutra      = parse_sutra(ep_title, track_title)
                genres_std = extracted_genres_std
                song_name  = extract_song_name(track_title)
                lyrics_id, score = resolve_lyrics_id(song_name, title_to_id)
                matched_title = id_to_title.get(lyrics_id, '') if lyrics_id else ''
                # ID-primary sutra: once the fuzzy match gives us a lyrics_id,
                # look up its sutra in the snapshot.
                sutra_from_lyrics = id_to_sutra.get(lyrics_id, '') if lyrics_id else ''
                if sutra_from_lyrics:
                    sutra = sutra_from_lyrics
                confidence = (
                    'HIGH (spot-check)'  if score >= QA_HIGH_CONF else
                    'MEDIUM (review)'    if score >= QA_LOW_CONF  else
                    'LOW — fill in below'
                )

            # Curator sets `track_in_app` in SC-NEW-TRACKS-QA.csv (checked = publish in app).
            _qr_live = qa_overrides.get(tid, {})
            _ti_src = (_qr_live.get('track_in_app') or '').strip()
            track_in_app_out = (
                normalize_track_in_app_for_airtable(_ti_src) if _ti_src else 'unchecked'
            )

            track_out_row = {
                **common,
                'lyrics_title': song_name,
                'sutra':        sutra,
                'primary_genre': '',
                'secondary_genre': '',
                'extracted_genre': genres_std,
                'mood': _pick_first_value(qa_overrides.get(tid, {}), TRACK_OPTIONAL_FIELD_ALIASES['mood']),
                'tempo_feel': _pick_first_value(qa_overrides.get(tid, {}), TRACK_OPTIONAL_FIELD_ALIASES['tempo_feel']),
                'curation_rating': _pick_first_value(qa_overrides.get(tid, {}), TRACK_OPTIONAL_FIELD_ALIASES['curation_rating']),
                'fav_track':    '',
                'liked_track':  common.get('liked_track', ''),
                'track_in_app': track_in_app_out,
                'lyrics_id':    lyrics_id,
            }
            out_tracks_full.append(track_out_row)
            if is_filtered_track:
                out_tracks.append(track_out_row)

            if is_filtered_track:
                corrected_lid = normalize_lid(
                    (qa_overrides.get(tid, {}).get('CORRECT_LYRICS_ID') or '').strip()
                )
                if corrected_lid:
                    merged_qr = dict(qa_overrides.get(tid, {}))
                    merged_qr.update({
                        'track_id': tid,
                        'track_title': track_title,
                        'ep_title': ep_title,
                        'extracted_genre': genres_std,
                        'extracted_song_name': song_name,
                        'auto_lyrics_id': lyrics_id,
                        'match_score': score,
                        'matched_title': matched_title,
                        'confidence': confidence,
                        'play_count': r.get('play_count', ''),
                        'like_count': r.get('like_count', ''),
                        'CORRECT_LYRICS_ID': corrected_lid,
                    })
                    qa_overrides[tid] = merged_qr
                _ti_src2 = (qa_overrides.get(tid, {}).get('track_in_app') or '').strip()
                track_in_app_out = (
                    normalize_track_in_app_for_airtable(_ti_src2) if _ti_src2 else 'unchecked'
                )
                track_out_row['track_in_app'] = track_in_app_out
                needs_track_qa_row = (
                    confidence.startswith('LOW')
                    or confidence.startswith('MEDIUM')
                    or (corrected_lid and lyrics_id != corrected_lid)
                    or (corrected_lid and corrected_lid not in id_to_title)
                )
                # Do not keep rows in SC-NEW-TRACKS-QA.csv solely for unchecked track_in_app
                # — that caused an endless EP/track QA loop. Curator can still set track_in_app
                # in the QA file; it is merged into output and persisted in SC-TRACK-QA-CORRECTIONS.
                emit_track_qa = needs_track_qa_row
                if emit_track_qa:
                    qa_out.append({
                        'track_id':             tid,
                        'track_title':          track_title,
                        'ep_title':             ep_title,
                        'sutra':                sutra,
                        'extracted_genre':      genres_std,
                        'extracted_song_name':  song_name,
                        'auto_lyrics_id':       lyrics_id,
                        'match_score':          score,
                        'matched_title':        matched_title,
                        'confidence':           confidence,
                        'play_count':           r.get('play_count', ''),
                        'like_count':           r.get('like_count', ''),
                        # Curator writes here on re-run if auto_lyrics_id is wrong.
                        # Persist across runs so prior corrections aren't lost.
                        'CORRECT_LYRICS_ID':    corrected_lid or qa_overrides.get(tid, {}).get('CORRECT_LYRICS_ID', ''),
                        # checked = show in app catalog / default SC player; leave blank → unchecked until set.
                        'track_in_app':         track_in_app_out,
                    })

    print(f"  ✓ Known tracks (filtered import set):      {known_count}")
    print(f"  ✓ New tracks (filtered import set):        {new_count}")
    print(f"  ✓ Known tracks (full export):              {known_count_full}")
    print(f"  ✓ New tracks (full export):                {new_count_full}")

    # Persist CORRECT_LYRICS_ID before any code path can delete SC-NEW-TRACKS-QA.csv
    # (when qa_out is empty). Previously, stale QA removal ran before this write,
    # which dropped manual corrections on the same run and caused EP/track fix ping-pong.
    n_persist_tracks = _write_persisted_track_corrections(OUT_TRACK_QA_PERSIST, qa_overrides)
    if n_persist_tracks:
        print(f"  ✓ Persisted {n_persist_tracks} track QA row(s) → "
              f"{os.path.basename(OUT_TRACK_QA_PERSIST)} (CORRECT_LYRICS_ID and/or track_in_app)")

    # ── 5. Build EP table ─────────────────────────────────────────────────────
    # EPs are NOT filtered — ALL EPs appear regardless of track play/like counts.
    print("\n[5] Building EP table...")

    ep_agg = defaultdict(lambda: {
        'ep_url': '', 'ep_created_at': '', 'ep_total_tracks': '',
        'tracks': [], 'plays': 0, 'likes': 0, 'secs': 0,
        'lyrics_ids': [], 'sutras': [], 'genres_std': [],
        'playlist_names': set(), 'artwork_url': '', 'artwork_lg_url': '',
    })

    # Aggregate EP stats + lyrics_id candidates from the processed track rows
    # (full export), so track QA corrections participate in EP lyrics_id.
    for t in out_tracks_full:
        et = clean_ep_title((t.get('ep_title') or '').strip())
        if not et:
            continue
        d = ep_agg[et]
        tid = str(t.get('track_id', '') or '').strip()
        raw = raw_by_track_id.get(tid, {})
        d['ep_url']          = d['ep_url'] or raw.get('ep_url', '') or t.get('ep_url', '')
        d['ep_created_at']   = d['ep_created_at'] or (raw.get('ep_created_at') or '').strip()
        d['ep_total_tracks'] = d['ep_total_tracks'] or (raw.get('ep_total_tracks') or '').strip()
        d['artwork_url']     = d['artwork_url'] or raw.get('artwork_url', '') or t.get('artwork_url', '')
        raw_lg = (raw.get('artwork_lg_url') or '').strip() or (t.get('artwork_lg_url') or '').strip()
        d['artwork_lg_url']  = d['artwork_lg_url'] or raw_lg
        if not d['artwork_lg_url'] and d['artwork_url']:
            _, d['artwork_lg_url'] = sndcdn_artwork_sm_lg(d['artwork_url'])
        d['plays']          += int(t.get('play_count', 0) or raw.get('play_count', 0) or 0)
        d['likes']          += int(t.get('like_count', 0) or raw.get('like_count', 0) or 0)
        dur = (t.get('duration') or '').strip() or (raw.get('duration') or '').strip()
        if not dur:
            ds = int(raw.get('duration_seconds', 0) or 0)
            if ds:
                m, s = divmod(ds, 60)
                dur = f"{m}:{s:02d}"
        d['secs'] += _duration_to_secs(dur)
        d['tracks'].append(t.get('track_title', '') or raw.get('title', ''))
        pl_raw = clean_and_resolve_playlist_names(raw.get('playlist_names', ''))
        for pl in pl_raw.split(','):
            pl = pl.strip()
            if pl:
                d['playlist_names'].add(pl)

        lid = normalize_lid(t.get('lyrics_id', '') or '')
        if lid and lid != '?':
            d['lyrics_ids'].append(lid)
        s = (t.get('sutra') or '').strip()
        if s:
            d['sutras'].append(s)
        g = (t.get('primary_genre') or '').strip() or (t.get('extracted_genre') or '').strip()
        if g:
            d['genres_std'].append(g)

    # EP_HEADERS: 'TRACKs' linked-record column removed — Airtable linked
    # record lookups are now the source of truth for EP → TRACK membership.
    # lyrics_title added for at-a-glance scanning (looked up via lyrics_id
    # against the canonicalized LYRICS snapshot).
    # ep_featured / ep_description / ep_songbook_title: passthrough from
    # clean/sc_eps snapshot so AT-EPS imports do not strip editorial curation.
    EP_HEADERS = [
        'ep_title', 'ep_url', 'ep_volume', 'ep_rating', 'sutra', 'genres', 'genres_full',
        'ep_total_tracks', 'total_plays', 'total_likes', 'duration_total',
        'artwork_url', 'artwork_lg_url', 'lyrics_title', 'lyrics_id', 'ep_in_app',
        'ep_featured', 'ep_description', 'ep_songbook_title',
        'created_at', 'playlist_names_clean',
    ]

    out_eps = []
    for ep_title in sorted(ep_agg):
        d    = ep_agg[ep_title]
        # Lookup confirmed editorial data by title first, then case-insensitive
        # title, then URL. URL fallback is essential when raw SC title and
        # confirmed (canonical) title intentionally differ — the EP is still
        # the same record.
        conf = (
            confirmed_eps.get(ep_title)
            or confirmed_eps_lower.get(ep_title.lower())
            or confirmed_eps_by_url.get((d['ep_url'] or '').strip(), {})
        )

        lyrics_id   = Counter(d['lyrics_ids']).most_common(1)[0][0] if d['lyrics_ids'] else ''
        sutra       = Counter(d['sutras']).most_common(1)[0][0] if d['sutras'] else parse_sutra(ep_title)
        genres_std  = Counter(d['genres_std']).most_common(1)[0][0] if d['genres_std'] else ''
        genres_full = conf.get('genres_full', '') or genres_std
        artwork_url = d['artwork_url'] or conf.get('artwork_url', '')
        artwork_lg_url = (d.get('artwork_lg_url') or '').strip() or (conf.get('artwork_lg_url') or '').strip()
        if not artwork_lg_url and artwork_url:
            _, artwork_lg_url = sndcdn_artwork_sm_lg(artwork_url)

        if ep_title in BLANK_EP_GENRES:
            g, gf = BLANK_EP_GENRES[ep_title]
            genres_std  = genres_std  or g
            genres_full = genres_full or gf

        if not genres_full:
            genres_full = genres_std

        created_at = d['ep_created_at'] or conf.get('created_at', '')

        final_lyrics_id   = conf.get('lyrics_id', '').strip() or lyrics_id
        ep_qa = ep_qa_by_url.get((d['ep_url'] or '').strip(), {}) or ep_qa_by_title_norm.get(ep_title.lower(), {})
        corrected_ep_lid = normalize_lid((ep_qa.get('CORRECT_EP_LYRICS_ID') or '').strip())
        if corrected_ep_lid:
            final_lyrics_id = corrected_ep_lid
        # Fresh per-track aggregate (which already reflects LYRICS snapshot
        # overrides) wins over the possibly-stale confirmed-EP sutra. Only
        # fall back to confirmed when there are no raw tracks to aggregate
        # (orphan confirmed EPs).
        final_sutra       = sutra or conf.get('sutra', '').strip()
        final_genres_std  = conf.get('genres', '').strip() or genres_std
        final_genres_full = conf.get('genres_full', '').strip() or genres_full or final_genres_std

        ep_in_val = (
            normalize_track_in_app_for_airtable((conf.get('ep_in_app') or '').strip())
            if (conf.get('ep_in_app') or '').strip()
            else 'unchecked'
        )
        co_ep = (ep_qa.get('CORRECT_ep_in_app') or '').strip()
        if co_ep:
            ep_in_val = normalize_track_in_app_for_airtable(co_ep)

        # Preserve raw SC EP title in output. Confirmed/canonical title is only
        # used for matching to editorial data (sutra, genres, lyrics_id). Raw
        # and confirmed titles are often intentionally different.
        row_ep = {
            'ep_title':             ep_title,
            'ep_url':               d['ep_url'],
            'ep_volume':            conf.get('ep_volume', '').strip() or conf.get('volume', '').strip(),
            'ep_rating':            conf.get('ep_rating', '').strip(),
            'sutra':                final_sutra,
            'genres':               final_genres_std,
            'genres_full':          final_genres_full,
            'ep_total_tracks':      d['ep_total_tracks'] or conf.get('ep_total_tracks') or str(len(d['tracks'])),
            'total_plays':          d['plays'],
            'total_likes':          d['likes'],
            'duration_total':       _secs_to_hms(d['secs']),
            'artwork_url':          artwork_url,
            'artwork_lg_url':       artwork_lg_url,
            'lyrics_title':         id_to_title.get(final_lyrics_id, ''),
            'lyrics_id':            final_lyrics_id,
            'ep_in_app':            ep_in_val,
            'created_at':           created_at,
            'playlist_names_clean': ', '.join(sorted(d['playlist_names'])),
        }
        row_ep.update(_ep_curation_from_snapshot(conf))
        out_eps.append(row_ep)

    # ── Include confirmed EPs with no matching raw tracks ─────────────────────
    # Handles EPs that exist in the confirmed set but have no raw tracks in
    # this export (e.g. added to SC after the last extraction run).
    # Dedup by URL first — raw SC title and confirmed title can differ for the
    # same EP, so a title-only check would add phantom duplicate rows.
    ep_agg_lower = {k.lower(): k for k in ep_agg}
    raw_ep_urls = {(d['ep_url'] or '').strip() for d in ep_agg.values() if (d['ep_url'] or '').strip()}
    for conf_ep_raw, conf_data in confirmed_eps.items():
        conf_url = (conf_data.get('ep_url') or '').strip()
        if conf_url and conf_url in raw_ep_urls:
            continue  # already present in raw aggregation under its raw SC title
        if conf_ep_raw in ep_agg or conf_ep_raw.lower() in ep_agg_lower:
            continue  # already present by title match
        orphan_lid = conf_data.get('lyrics_id', '').strip()
        _url_o = (conf_data.get('ep_url') or '').strip()
        _epq_o = ep_qa_by_url.get(_url_o, {}) or ep_qa_by_title_norm.get(conf_ep_raw.lower(), {})
        _ep_in_o = (
            normalize_track_in_app_for_airtable((_epq_o.get('CORRECT_ep_in_app') or '').strip())
            if (_epq_o.get('CORRECT_ep_in_app') or '').strip()
            else (
                normalize_track_in_app_for_airtable((conf_data.get('ep_in_app') or '').strip())
                if (conf_data.get('ep_in_app') or '').strip()
                else 'unchecked'
            )
        )
        _au_o = (conf_data.get('artwork_url') or '').strip()
        _alg_o = (conf_data.get('artwork_lg_url') or '').strip()
        if not _alg_o and _au_o:
            _, _alg_o = sndcdn_artwork_sm_lg(_au_o)
        row_orphan = {
                'ep_title':             conf_ep_raw,
                'ep_url':               conf_data.get('ep_url', ''),
                'ep_volume':            conf_data.get('ep_volume', '') or conf_data.get('volume', ''),
                'ep_rating':            conf_data.get('ep_rating', ''),
                'sutra':                conf_data.get('sutra', ''),
                'genres':               conf_data.get('genres', ''),
                'genres_full':          conf_data.get('genres_full', conf_data.get('genres', '')),
                'ep_total_tracks':      conf_data.get('ep_total_tracks', conf_data.get('track_count', '')),
                'total_plays':          0,
                'total_likes':          0,
                'duration_total':       '0:00:00',
                'artwork_url':          _au_o,
                'artwork_lg_url':       _alg_o,
                'lyrics_title':         id_to_title.get(orphan_lid, conf_data.get('lyrics_title', '')),
                'lyrics_id':            orphan_lid,
                'ep_in_app':            _ep_in_o,
                'created_at':           conf_data.get('created_at', ''),
                'playlist_names_clean': conf_data.get('playlist_names_clean', ''),
            }
        row_orphan.update(_ep_curation_from_snapshot(conf_data))
        out_eps.append(row_orphan)

    out_eps.sort(key=lambda x: x['ep_title'].lower())
    print(f"  ✓ EPs: {len(out_eps)} (all EPs included regardless of track filter)")

    orphan_eps = [ep for ep in out_eps if not _ep_lyrics_resolved(ep, id_to_title)]
    ep_qa_out = []
    for ep in orphan_eps:
        url = (ep.get('ep_url') or '').strip()
        prev = ep_qa_by_url.get(url, {}) or ep_qa_by_title_norm.get(
            (ep.get('ep_title') or '').strip().lower(), {})
        ep_qa_out.append({
            'ep_title': (ep.get('ep_title') or '').strip(),
            'ep_url': url,
            'derived_lyrics_id': (ep.get('lyrics_id') or '').strip(),
            'derived_lyrics_title': (ep.get('lyrics_title') or '').strip(),
            'CORRECT_EP_LYRICS_ID': (prev.get('CORRECT_EP_LYRICS_ID') or '').strip(),
            'ep_in_app': (ep.get('ep_in_app') or '').strip(),
            'CORRECT_ep_in_app': (prev.get('CORRECT_ep_in_app') or '').strip(),
            'notes': (prev.get('notes') or '').strip(),
        })
    if ep_qa_out:
        EP_QA_HEADERS = [
            'ep_title', 'ep_url', 'derived_lyrics_id', 'derived_lyrics_title',
            'CORRECT_EP_LYRICS_ID', 'ep_in_app', 'CORRECT_ep_in_app', 'notes',
        ]
        _write_csv(OUT_EP_QA, ep_qa_out, EP_QA_HEADERS)
        print(f"\n  ✓ {os.path.basename(OUT_EP_QA)}  ({len(ep_qa_out)} EPs need manual lyrics_id)")
        print(f"    Fill CORRECT_EP_LYRICS_ID (single L-id); set CORRECT_ep_in_app to checked if the EP should be in-app.")
        print(f"    Re-run this script.")
    elif os.path.exists(OUT_EP_QA):
        os.remove(OUT_EP_QA)
        print(f"\n  ✓ No EP lyrics_id gaps — removed stale {os.path.basename(OUT_EP_QA)}")

    # ── 6. Build PLAYLISTS table ───────────────────────────────────────────────
    print("\n[6] Building PLAYLISTS table...")

    pl_agg = defaultdict(lambda: {
        'tracks': [], 'ep_titles': set(), 'plays': 0, 'likes': 0, 'secs': 0,
    })

    for t in out_tracks_full:
        for pl in (t.get('playlist_names_clean') or '').split(','):
            pl = pl.strip()
            if not pl:
                continue
            d = pl_agg[pl]
            d['tracks'].append(t.get('track_title', ''))
            ep = (t.get('ep_title') or '').strip()
            if ep:
                d['ep_titles'].add(ep)
            d['plays'] += int(t.get('play_count', 0) or 0)
            d['likes'] += int(t.get('like_count', 0) or 0)
            d['secs']  += _duration_to_secs(t.get('duration', ''))

    # PL_HEADERS: 'EPs' and 'TRACKs' linked-record columns removed — Airtable
    # linked records are now the source of truth for PLAYLIST → EP/TRACK
    # membership. Aggregates (track_count, total_plays, etc.) stay.
    PL_HEADERS = [
        'playlist_name', 'playlist_url', 'sutra', 'genres',
        'track_count', 'total_plays', 'total_likes', 'duration_total',
        'artwork_url', 'artwork_lg_url', 'sc_playlist_type', 'scplaylist_in_app', 'songbook_id',
    ]

    out_playlists = []
    for pl_name in sorted(pl_agg):
        d       = pl_agg[pl_name]
        conf_pl = confirmed_playlists.get(pl_name, {})
        pl_url  = conf_pl.get('playlist_url', '').strip() or sc_name_to_url.get(pl_name, '')
        # Art: SC API playlist manifest (same objects as fetch_all_playlists) → snapshot → track-derived
        pl_art = _strip_prioritized(
            playlist_art_sm_from_api.get(pl_name),
            playlist_art_sm_from_api.get(fix_playlist_name(pl_name)),
            playlist_art_sm_from_api.get(pl_url),
            conf_pl.get('artwork_url', '').strip(),
            sc_name_to_artwork.get(pl_name, ''),
        )
        pl_art_lg = _strip_prioritized(
            playlist_art_lg_from_api.get(pl_name),
            playlist_art_lg_from_api.get(fix_playlist_name(pl_name)),
            playlist_art_lg_from_api.get(pl_url),
            conf_pl.get('artwork_lg_url', '').strip(),
            sc_name_to_artwork_lg.get(pl_name, ''),
        )
        if not pl_art_lg and pl_art:
            _, pl_art_lg = sndcdn_artwork_sm_lg(pl_art)
        # Sutra ownership: if the playlist exists in the confirmed snapshot,
        # Airtable is authoritative — trust its value including intentional
        # blanks (e.g. genre playlists that shouldn't carry a main sutra).
        # Only fall back to parse_sutra() for genuinely new playlists.
        if conf_pl:
            pl_sutra = conf_pl.get('sutra', '').strip()
        else:
            pl_sutra = parse_sutra(pl_name)
        pl_genres = conf_pl.get('genres', '').strip()

        out_playlists.append({
            'playlist_name':  pl_name,
            'playlist_url':   pl_url,
            'sutra':          pl_sutra,
            'genres':         pl_genres,
            'track_count':    len(d['tracks']),
            'total_plays':    d['plays'],
            'total_likes':    d['likes'],
            'duration_total': _secs_to_hms(d['secs']),
            'artwork_url':    pl_art,
            'artwork_lg_url': pl_art_lg,
            'sc_playlist_type': conf_pl.get('sc_playlist_type', '').strip(),
            'scplaylist_in_app': conf_pl.get('scplaylist_in_app', '').strip(),
            'songbook_id': conf_pl.get('songbook_id', '').strip(),
        })

    print(f"  ✓ Playlists: {len(out_playlists)}")

    # ── 7. Write outputs ───────────────────────────────────────────────────────
    print("\n[7] Writing outputs...")
    if len(out_tracks_full) != len(raw_rows):
        print(
            f"  ⚠  Row-count sanity: FULL={len(out_tracks_full)} vs raw export={len(raw_rows)} "
            f"(expected equal — every scraped track becomes one FULL row)."
        )

    print(
        f"  TRACK CSVs — both written every run; same columns ({len(TRACK_HEADERS)} fields):\n"
        f"    • {os.path.basename(OUT_TRACKS)}  →  Airtable SC TRACKS import "
        f"({len(out_tracks)} rows; play≥{MIN_PLAYS} OR like≥{MIN_LIKES})\n"
        f"    • {os.path.basename(OUT_TRACKS_FULL)}  →  full scrape archive; "
        f"do not import to Airtable — use for embeds / artwork fallbacks / long-tail ({len(out_tracks_full)} rows)"
    )

    _write_csv(OUT_TRACKS, out_tracks, TRACK_HEADERS)
    _write_csv(OUT_TRACKS_DATED, out_tracks, TRACK_HEADERS)
    print(f"  ✓ {os.path.basename(OUT_TRACKS)}  + dated {os.path.basename(OUT_TRACKS_DATED)}")
    _write_csv(OUT_TRACKS_FULL, out_tracks_full, TRACK_HEADERS)
    _write_csv(OUT_TRACKS_FULL_DATED, out_tracks_full, TRACK_HEADERS)
    print(f"  ✓ {os.path.basename(OUT_TRACKS_FULL)}  + dated {os.path.basename(OUT_TRACKS_FULL_DATED)}")

    _write_csv(OUT_EPS, out_eps, EP_HEADERS)
    _write_csv(OUT_EPS_DATED, out_eps, EP_HEADERS)
    print(f"  ✓ {os.path.basename(OUT_EPS)}  ({len(out_eps)} rows)")
    print(f"    + dated copy: {os.path.basename(OUT_EPS_DATED)}")

    _write_csv(OUT_PLAYLISTS, out_playlists, PL_HEADERS)
    _write_csv(OUT_PLAYLISTS_DATED, out_playlists, PL_HEADERS)
    print(f"  ✓ {os.path.basename(OUT_PLAYLISTS)}  ({len(out_playlists)} rows)")
    print(f"    + dated copy: {os.path.basename(OUT_PLAYLISTS_DATED)}")

    if qa_out:
        QA_HEADERS = [
            'track_id', 'track_title', 'ep_title', 'sutra', 'extracted_genre',
            'extracted_song_name', 'auto_lyrics_id', 'match_score',
            'matched_title', 'confidence', 'play_count', 'like_count',
            'CORRECT_LYRICS_ID', 'track_in_app',
        ]
        _write_csv(OUT_QA, qa_out, QA_HEADERS)

        high      = sum(1 for q in qa_out if q['confidence'].startswith('HIGH'))
        med       = sum(1 for q in qa_out if q['confidence'].startswith('MEDIUM'))
        low       = sum(1 for q in qa_out if q['confidence'].startswith('LOW'))
        corrected = sum(1 for q in qa_out if q['confidence'].startswith('CORRECTED'))
        print(f"\n  ✓ {os.path.basename(OUT_QA)}  ({len(qa_out)} new tracks)")
        print(f"    HIGH      ({high}) — likely correct, spot-check only")
        print(f"    MEDIUM    ({med}) — worth a look")
        print(f"    LOW       ({low}) — fill in CORRECT_LYRICS_ID (e.g. L-312) and re-run")
        print(f"    CORRECTED ({corrected}) — title confirmed, add to LYRICS base when ready")
    else:
        if os.path.exists(OUT_QA):
            os.remove(OUT_QA)
            print(f"\n  ✓ No new tracks — removed stale {os.path.basename(OUT_QA)}")
        else:
            print(f"\n  ✓ No new tracks — QA file not needed")

    # Track QA corrections already persisted after track processing (see above).

    # ── Sync report: flag lyrics_id/title drift between CONFIRMED & LYRICS snapshot ──
    if sync_issues:
        SYNC_HEADERS = [
            'case', 'track_id', 'track_title', 'ep_title',
            'confirmed_lyrics_id', 'confirmed_title', 'confirmed_sutra',
            'snapshot_at_confirmed_id_title', 'snapshot_at_confirmed_id_sutra',
            'resolved_lyrics_id', 'resolved_title', 'resolved_sutra',
        ]
        # Sort: most urgent (UNRESOLVED) first, then healed-via-title cases,
        # then title-only differences.
        case_priority = {
            'id_drift_unresolved':     0,
            'title_not_in_snapshot':   1,
            'id_drift_resolved':       2,
            'id_drift_resolved_fuzzy': 3,
            'id_missing_title_match':  4,
            'title_fuzzy_match':       5,
            'title_edit':              6,
        }
        sync_issues.sort(key=lambda r: (case_priority.get(r['case'], 99),
                                        r.get('confirmed_lyrics_id', ''),
                                        r.get('track_title', '')))
        _write_csv(OUT_SYNC, sync_issues, SYNC_HEADERS)

        # Break down by case for the console summary
        from collections import Counter as _Counter
        case_counts = _Counter(r['case'] for r in sync_issues)
        print(f"\n  ⚠  {os.path.basename(OUT_SYNC)}  ({len(sync_issues)} tracks flagged)")
        for case in sorted(case_counts, key=lambda c: case_priority.get(c, 99)):
            label = {
                'id_drift_unresolved':     'ID drift (UNRESOLVED — fix in Airtable)',
                'title_not_in_snapshot':   'Orphan (no ID and title not in LYRICS)',
                'id_drift_resolved':       'ID drift — healed via exact title match',
                'id_drift_resolved_fuzzy': 'ID drift — healed via fuzzy title match',
                'id_missing_title_match':  'No confirmed ID; title matched in LYRICS',
                'title_fuzzy_match':       'No confirmed ID; fuzzy title match',
                'title_edit':              'Title edited in LYRICS (auto-picked up)',
            }.get(case, case)
            print(f"    {case_counts[case]:4d}  {label}")

    # ── Summary ───────────────────────────────────────────────────────────────
    # Gate "safe to import" on two review conditions:
    #   (1) any new tracks in QA file needing human eyes, OR
    #   (2) any orphan EPs (blank lyrics_id or lyrics_id not in LYRICS)
    # When either fires, emit a blocking-looking warning BEFORE the import
    # instructions so it's impossible to miss in a terminal scan.
    qa_needs_review = bool(qa_out)

    print("\n" + "=" * 60)
    print("  ✅  COMPLETE")

    if qa_needs_review or orphan_eps:
        print("\n" + "  ⚠ " * 10)
        print("  ⚠  REVIEW REQUIRED BEFORE IMPORTING")
        print("  ⚠ " * 10)

        if qa_needs_review:
            low  = sum(1 for q in qa_out if q['confidence'].startswith('LOW'))
            med  = sum(1 for q in qa_out if q['confidence'].startswith('MEDIUM'))
            high = sum(1 for q in qa_out if q['confidence'].startswith('HIGH'))
            corr = sum(1 for q in qa_out if q['confidence'].startswith('CORRECTED'))
            print(f"\n  ⚠  {len(qa_out)} new tracks in {os.path.basename(OUT_QA)}"
                  f"  (LOW={low}, MEDIUM={med}, HIGH={high}, CORRECTED={corr})")
            print(f"  → Open outputs/{os.path.basename(OUT_QA)}")
            print(f"  → Fill in CORRECT_LYRICS_ID (e.g. L-312) for LOW + MEDIUM rows")
            print(f"  → For CORRECTED rows flagged 'not in LYRICS', add the lyrics_id to LYRICS first")
            print(f"  → Optional: set track_in_app in QA (also written to SC-TRACK-QA-CORRECTIONS.csv);")
            print(f"    lyrics QA can clear without losing in-app choices on the next run.")
            print(f"  → Re-run this script — corrections will be applied")

        if orphan_eps:
            print(f"\n  ⚠  {len(orphan_eps)} EPs have missing or unresolved lyrics_id:")
            for ep in orphan_eps[:10]:
                title = (ep.get('ep_title', '') or '')[:60]
                lid   = ep.get('lyrics_id', '') or '(blank)'
                print(f"      • {title}   [lyrics_id={lid}]")
            if len(orphan_eps) > 10:
                print(f"      ... and {len(orphan_eps) - 10} more")
            print(f"  → Fix EP rows in {os.path.basename(OUT_EP_QA)}: CORRECT_EP_LYRICS_ID (single L-id),")
            print(f"    and CORRECT_ep_in_app when you want the EP in-app (checked). Re-run — EP output picks these up.")
            print(f"  → If the ID truly does not exist in LYRICS yet, add it in Airtable,")
            print(f"    re-export + canonicalize LYRICS, then rebuild.")

        print(f"\n  ⚠  DO NOT import AT-*-v4.csv until the above is resolved,")
        print(f"     or bad data will be upserted into Airtable and become 'confirmed'")
        print(f"     on the next build.")
    elif qa_out:
        # (unreachable given qa_needs_review logic, kept for symmetry)
        pass
    else:
        print(f"\n  ✓ No new tracks, no orphan EPs — safe to import")

    print(f"\n  Outputs saved to: {os.path.relpath(OUT_DIR, REPO_ROOT)}")
    print(f"  Archive:          {os.path.relpath(ARCHIVE_DIR, REPO_ROOT)}")
    if not (qa_needs_review or orphan_eps):
        print(f"  → Airtable import: AT-TRACKS-v4.csv (filtered tracks), AT-EPS-v4.csv, AT-PLAYLISTS-v4.csv")
        print(f"  → Keep AT-TRACKS-FULL-v4.csv out of Airtable — full scrape for app/catalog fallbacks only")
    print("=" * 60)


if __name__ == '__main__':
    main()
