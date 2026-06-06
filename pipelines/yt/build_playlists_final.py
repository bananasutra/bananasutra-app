"""
build_playlists_final.py
Produce an Airtable-import-ready YT Playlists CSV with linked_sutra renamed to
sutra (for parity with SC Playlists and LYRICS).

Primary input:
  AIRTABLE/snapshots/<latest>/clean/yt_playlists-*.csv

Optional enrichment (when present):
  pipelines/yt/raw/yt_playlists_raw.csv — from 1_extract.py (YouTube API)
  pipelines/yt/name_mapping.csv       — raw_yt_title → cleaned_name

Curated Airtable rows often use cleaned playlist_name while playlist_id /
playlist_url / thumbnail_url / video_count were never pasted from YouTube.
This pass fills those blanks by reverse-mapping cleaned_name → raw_title(s)
via name_mapping, then looking up metadata on the scrape row.

Output: pipelines/yt/outputs/AT-PLAYLISTS-final.csv
        pipelines/yt/outputs/archive/<YYYY-MM-DD>/AT-PLAYLISTS-final-<YYYY-MM-DD>.csv
"""
import csv
import re
import shutil
import sys
from collections import defaultdict
from datetime import date
from pathlib import Path
from typing import Dict, Optional

SCRIPT_DIR = Path(__file__).resolve().parent
REPO = SCRIPT_DIR.parent.parent
SNAPSHOTS = REPO / "AIRTABLE" / "snapshots"
OUT_DIR = SCRIPT_DIR / "outputs"
ARCHIVE_DIR = OUT_DIR / "archive"
OUT = OUT_DIR / "AT-PLAYLISTS-final.csv"
RUN_DATE = date.today().isoformat()

RAW_PLAYLISTS = SCRIPT_DIR / "raw" / "yt_playlists_raw.csv"
NAME_MAP = SCRIPT_DIR / "name_mapping.csv"
NAME_ALIASES = SCRIPT_DIR / "playlist_name_aliases.csv"

from playlist_name_utils import (
    canonical_playlist_name,
    load_name_aliases,
    load_raw_to_clean,
    youtube_canonical_name_for_id,
)

# youtube.com/watch?v=...&list=PL...
_LIST_PARAM_RE = re.compile(r"[?&]list=([a-zA-Z0-9_-]+)")


def latest_snapshot():
    dated = sorted(
        p for p in SNAPSHOTS.iterdir()
        if p.is_dir() and re.match(r"^\d{4}-\d{2}-\d{2}$", p.name)
    )
    if not dated:
        sys.exit(f"No dated snapshots in {SNAPSHOTS}")
    return dated[-1]


def pick_playlists_snapshot(clean_dir: Path, snap: Path) -> Path:
    """Prefer yt_playlists-<snapshot-date>.csv; else latest dated suffix in folder."""
    hits = sorted(clean_dir.glob("yt_playlists-*.csv"))
    if not hits:
        return None
    preferred = clean_dir / f"yt_playlists-{snap.name}.csv"
    if preferred.exists():
        return preferred

    def _date_suffix(path: Path) -> str:
        m = re.search(r"(\d{4}-\d{2}-\d{2})", path.stem)
        return m.group(1) if m else ""

    return max(hits, key=_date_suffix)


def extract_playlist_id_from_url(url: str) -> str:
    if not (url or "").strip():
        return ""
    m = _LIST_PARAM_RE.search(url)
    return m.group(1).strip() if m else ""


def canonical_playlist_url(playlist_id: str) -> str:
    pid = (playlist_id or "").strip()
    return f"https://www.youtube.com/playlist?list={pid}" if pid else ""


def load_raw_playlists_by_title(path: Path) -> Dict[str, Dict[str, str]]:
    if not path.exists():
        return {}
    with open(path, encoding="utf-8-sig", newline="") as f:
        rows = list(csv.DictReader(f))
    out: Dict[str, Dict[str, str]] = {}
    for r in rows:
        title = (r.get("raw_title") or "").strip()
        if title:
            out[title] = r
    return out


def load_cleaned_to_raw_titles(path: Path) -> Dict[str, list]:
    """cleaned_name -> ordered list of raw_yt_title keys (for reverse lookup)."""
    m: Dict[str, list] = defaultdict(list)
    if not path.exists():
        return {}
    with open(path, encoding="utf-8-sig", newline="") as f:
        for r in csv.DictReader(f):
            raw = (r.get("raw_yt_title") or "").strip()
            cl = (r.get("cleaned_name") or "").strip()
            if raw and cl and (not m[cl] or m[cl][-1] != raw):
                m[cl].append(raw)
    return dict(m)


def scrape_meta_for_playlist_name(
    playlist_name: str,
    cleaned_to_raw: Dict[str, list],
    raw_by_title: Dict[str, Dict[str, str]],
) -> Optional[Dict[str, str]]:
    """Return scrape row dict for this Airtable playlist_name, or None."""
    tried: set[str] = set()
    candidates: list[str] = []
    for raw in cleaned_to_raw.get(playlist_name, []):
        if raw not in tried:
            candidates.append(raw)
            tried.add(raw)
    # Try identity (no rename in mapping)
    if playlist_name not in tried:
        candidates.append(playlist_name)
    for raw in candidates:
        meta = raw_by_title.get(raw)
        if meta:
            return meta
    return None


def merge_playlist_rows(group: list, yt_name: str) -> Dict[str, str]:
    """Merge duplicate Airtable rows that share one YouTube playlist_id."""
    merged = {k: "" for k in group[0].keys()}
    checked = {"1", "true", "yes", "y", "on", "checked"}

    def score(row: Dict[str, str]) -> tuple:
        in_app = (row.get("ytplaylist_in_app") or "").strip().lower() in checked
        return (
            int(in_app),
            len((row.get("description") or "").strip()),
            len((row.get("ytvideos") or "").strip()),
        )

    ordered = sorted(group, key=score, reverse=True)
    for row in ordered:
        for key, val in row.items():
            if val is None:
                continue
            sval = str(val).strip()
            if sval and not (merged.get(key) or "").strip():
                merged[key] = val

    if yt_name:
        merged["playlist_name"] = yt_name
    elif len(ordered) == 1:
        merged["playlist_name"] = ordered[0].get("playlist_name", "")
    else:
        merged["playlist_name"] = ordered[0].get("playlist_name", "")

    return merged


def dedupe_rows_by_playlist_id(
    rows: list,
    raw_by_title: Dict[str, Dict[str, str]],
    raw_to_clean: Dict[str, str],
    stats: Dict[str, int],
) -> list:
    """One output row per playlist_id; merge duplicate Airtable rows."""
    no_id: list = []
    by_id: Dict[str, list] = defaultdict(list)
    for row in rows:
        pid = (row.get("playlist_id") or "").strip()
        if not pid:
            pid = extract_playlist_id_from_url((row.get("playlist_url") or "").strip())
            if pid:
                row["playlist_id"] = pid
        if pid:
            by_id[pid].append(row)
        else:
            no_id.append(row)

    out = list(no_id)
    for pid, group in by_id.items():
        if len(group) == 1:
            out.append(group[0])
            continue
        stats["deduped_groups"] += 1
        stats["deduped_rows_removed"] += len(group) - 1
        yt_name = youtube_canonical_name_for_id(pid, raw_by_title, raw_to_clean)
        out.append(merge_playlist_rows(group, yt_name))
    return out


def enrich_row_from_scrape(row: Dict[str, str], meta: Dict[str, str], stats: Dict[str, int]) -> None:
    """Fill blank playlist_id / playlist_url / thumbnail_url / video_count from API scrape."""
    sid = (meta.get("playlist_id") or "").strip()
    surl = (meta.get("playlist_url") or "").strip()
    sthumb = (meta.get("thumbnail_url") or "").strip()
    icount = (meta.get("item_count") or "").strip()

    rid = (row.get("playlist_id") or "").strip()
    if not rid:
        rid = extract_playlist_id_from_url((row.get("playlist_url") or "").strip())
        if rid:
            row["playlist_id"] = rid
            stats["id_from_url"] += 1

    rid = (row.get("playlist_id") or "").strip()
    if not rid and sid:
        row["playlist_id"] = sid
        stats["filled_id"] += 1
        rid = sid

    rurl = (row.get("playlist_url") or "").strip()
    if not rurl and surl:
        row["playlist_url"] = surl
        stats["filled_url"] += 1
        rurl = surl

    rid = (row.get("playlist_id") or "").strip()
    if rid and rurl and "youtube.com/watch" in rurl and "list=" in rurl:
        row["playlist_url"] = canonical_playlist_url(rid)
        stats["norm_watch_url"] += 1
        rurl = row["playlist_url"]
    elif rid and not (row.get("playlist_url") or "").strip():
        row["playlist_url"] = canonical_playlist_url(rid)
        stats["filled_url"] += 1

    if not (row.get("thumbnail_url") or "").strip() and sthumb:
        row["thumbnail_url"] = sthumb
        stats["filled_thumb"] += 1

    if not (row.get("video_count") or "").strip() and icount:
        row["video_count"] = icount
        stats["filled_count"] += 1


def main():
    snap = latest_snapshot()
    clean_dir = snap / "clean"
    src = pick_playlists_snapshot(clean_dir, snap) if clean_dir.exists() else None
    if not src:
        sys.exit(
            f"No yt_playlists-*.csv in {clean_dir}\n"
            f"Run the canonicalizer first: python3 tools/clean_airtable_snapshot.py"
        )
    print(f"Reading: {src.name}")

    with open(src, encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        rows = [{k.lstrip("\ufeff"): v for k, v in r.items()} for r in reader]
        src_fields = [k.lstrip("\ufeff") for k in reader.fieldnames]

    renamed_fields = ["sutra" if f == "linked_sutra" else f for f in src_fields]
    for r in rows:
        if "linked_sutra" in r:
            r["sutra"] = r.pop("linked_sutra")

    raw_by_title = load_raw_playlists_by_title(RAW_PLAYLISTS)
    raw_to_clean = load_raw_to_clean(NAME_MAP)
    name_aliases = load_name_aliases(NAME_ALIASES)
    cleaned_to_raw = load_cleaned_to_raw_titles(NAME_MAP)
    stats = defaultdict(int)

    for r in rows:
        old = (r.get("playlist_name") or "").strip()
        new = canonical_playlist_name(old, raw_to_clean, name_aliases)
        if new and new != old:
            r["playlist_name"] = new
            stats["names_normalized"] += 1

    if raw_by_title:
        for r in rows:
            pname = (r.get("playlist_name") or "").strip()
            if not pname:
                continue
            meta = scrape_meta_for_playlist_name(pname, cleaned_to_raw, raw_by_title)
            if not meta:
                continue
            before = (
                (r.get("playlist_id") or "").strip(),
                (r.get("playlist_url") or "").strip(),
                (r.get("thumbnail_url") or "").strip(),
                (r.get("video_count") or "").strip(),
            )
            enrich_row_from_scrape(r, meta, stats)
            after = (
                (r.get("playlist_id") or "").strip(),
                (r.get("playlist_url") or "").strip(),
                (r.get("thumbnail_url") or "").strip(),
                (r.get("video_count") or "").strip(),
            )
            if after != before:
                stats["rows_touched"] += 1
        print(f"  Enriched from {RAW_PLAYLISTS.name} + {NAME_MAP.name}: "
              f"{stats['rows_touched']} row(s) touched "
              f"(filled_id={stats['filled_id']}, id_from_url={stats['id_from_url']}, "
              f"filled_url={stats['filled_url']}, norm_watch_url={stats['norm_watch_url']}, "
              f"filled_thumb={stats['filled_thumb']}, filled_count={stats['filled_count']})")
    else:
        print(f"  No {RAW_PLAYLISTS.name} — skipping API enrichment (run 1_extract.py)")

    if stats["names_normalized"]:
        print(f"  Normalized playlist_name via name map/aliases: "
              f"{stats['names_normalized']} row(s)")

    rows = dedupe_rows_by_playlist_id(rows, raw_by_title, raw_to_clean, stats)
    if stats["deduped_groups"]:
        print(f"  Deduped by playlist_id: {stats['deduped_groups']} group(s), "
              f"{stats['deduped_rows_removed']} duplicate row(s) removed")

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    with open(OUT, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=renamed_fields)
        w.writeheader()
        w.writerows(rows)

    dest_dir = ARCHIVE_DIR / RUN_DATE
    dest_dir.mkdir(parents=True, exist_ok=True)
    dated = dest_dir / f"{OUT.stem}-{RUN_DATE}{OUT.suffix}"
    shutil.copy2(OUT, dated)

    print(f"Wrote   : {OUT.name}  ({len(rows)} rows)")
    print(f"        : {dated.name}")
    print(f"Renames : linked_sutra \u2192 sutra (when column present)")


if __name__ == "__main__":
    main()
