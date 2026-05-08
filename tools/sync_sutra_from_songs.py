#!/usr/bin/env python3
"""
Set sc_tracks.sutra and sc_eps.sutra from SONGs (Lyrics): lyrics_id → sutra.
Optionally set sc_eps.ep_songbook_title from SONGs.songbook when that column exists.

Tracks: each row’s sutra comes from that track’s lyrics_id in SONGs.

EPs: sutra comes only from the EP row’s lyrics_id field (comma-separated).
     Typically one id → one sutra, or several ids that all map to the same sutra.
     Tracks on the EP do not influence EP sutra. If multiple ids disagree in SONGs,
     the script uses a majority vote (fix the songs so they agree).

EP songbook title: if the EP CSV has ep_songbook_title, it is filled from
SONGs.songbook for each EP lyrics_id. Multiple distinct songbooks are joined with
\" · \" in lyrics_id order (deduped).
"""

from __future__ import annotations

import argparse
import csv
from collections import Counter
from pathlib import Path


def parse_lyrics_ids(raw: str) -> list[str]:
    if not raw or not str(raw).strip():
        return []
    parts = []
    for chunk in str(raw).replace(";", ",").split(","):
        lid = chunk.strip()
        if lid:
            parts.append(lid)
    return parts


def load_song_sutras(songs_csv: Path) -> dict[str, str]:
    sutra, _ = load_song_sutra_and_songbook(songs_csv)
    return sutra


def load_song_sutra_and_songbook(
    songs_csv: Path,
) -> tuple[dict[str, str], dict[str, str]]:
    sutra: dict[str, str] = {}
    songbook: dict[str, str] = {}
    with songs_csv.open(newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            lid = (row.get("lyrics_id") or "").strip()
            if not lid:
                continue
            s = (row.get("sutra") or "").strip()
            if s:
                sutra[lid] = s
            sb = (row.get("songbook") or "").strip()
            if sb:
                songbook[lid] = sb
    return sutra, songbook


def ep_songbook_title_from_ids(
    ids: list[str], songbook_by_lid: dict[str, str]
) -> str:
    """Distinct songbook strings in lyrics_id order, joined with \" · \"."""
    seen: list[str] = []
    for lid in ids:
        v = songbook_by_lid.get(lid, "").strip()
        if v and v not in seen:
            seen.append(v)
    if not seen:
        return ""
    if len(seen) == 1:
        return seen[0]
    return " · ".join(seen)


def majority_sutra(ids: list[str], song_sutra: dict[str, str]) -> str | None:
    votes: list[str] = []
    for lid in ids:
        s = song_sutra.get(lid)
        if s:
            votes.append(s)
    if not votes:
        return None
    counts = Counter(votes)
    m = max(counts.values())
    winners = sorted(s for s, c in counts.items() if c == m)
    return winners[0]


def sync_tracks(
    tracks_csv: Path,
    song_sutra: dict[str, str],
) -> tuple[list[dict[str, str]], list[str]]:
    rows: list[dict[str, str]] = []
    with tracks_csv.open(newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        fieldnames = reader.fieldnames
        if not fieldnames or "lyrics_id" not in fieldnames or "sutra" not in fieldnames:
            raise SystemExit(f"Unexpected tracks header in {tracks_csv}")
        for row in reader:
            lid = (row.get("lyrics_id") or "").strip()
            if lid and lid in song_sutra:
                row["sutra"] = song_sutra[lid]
            rows.append(row)
    return rows, list(fieldnames)


def sync_eps(
    eps_csv: Path,
    song_sutra: dict[str, str],
    songbook_by_lid: dict[str, str] | None = None,
    *,
    songbook_only: bool = False,
) -> tuple[list[dict[str, str]], list[str]]:
    rows: list[dict[str, str]] = []
    fill_book = songbook_by_lid is not None
    update_sutra = not songbook_only
    with eps_csv.open(newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        fieldnames = reader.fieldnames
        if not fieldnames:
            raise SystemExit(f"Unexpected EPs header in {eps_csv}")
        if update_sutra and "sutra" not in fieldnames:
            raise SystemExit(f"Unexpected EPs header in {eps_csv}")
        has_ep_sb = fill_book and "ep_songbook_title" in fieldnames
        for row in reader:
            ids = parse_lyrics_ids(row.get("lyrics_id") or "")
            if update_sutra:
                chosen = majority_sutra(ids, song_sutra)
                if chosen:
                    row["sutra"] = chosen
            if has_ep_sb and songbook_by_lid is not None:
                row["ep_songbook_title"] = ep_songbook_title_from_ids(
                    ids, songbook_by_lid
                )
            rows.append(row)
    return rows, list(fieldnames)


def write_csv(path: Path, fieldnames: list[str], rows: list[dict[str, str]]) -> None:
    with path.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        w.writeheader()
        w.writerows(rows)


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument(
        "--snapshot-dir",
        type=Path,
        default=Path("AIRTABLE/snapshots/2026-04-30"),
        help="Directory containing CSV exports",
    )
    ap.add_argument(
        "--songs-csv",
        type=Path,
        default=None,
        help="SONGs (Lyrics) export (default: <snapshot-dir>/SONGs (Lyrics)-2026-04-30.csv)",
    )
    ap.add_argument(
        "--eps-only",
        action="store_true",
        help="Only update EP sutras; requires --eps-csv (does not touch tracks)",
    )
    ap.add_argument(
        "--eps-csv",
        type=Path,
        default=None,
        help="With --eps-only: SC EPs CSV to update in place",
    )
    ap.add_argument(
        "--songbook-only",
        action="store_true",
        help="With --eps-only: only fill ep_songbook_title from SONGs (do not change sutra)",
    )
    args = ap.parse_args()
    d = args.snapshot_dir
    songs = args.songs_csv or (d / "SONGs (Lyrics)-2026-04-30.csv")
    tracks_path = d / "SC TRACKs-2026-04-30.csv"
    if args.eps_only:
        if not args.eps_csv:
            raise SystemExit("--eps-only requires --eps-csv PATH")
        eps_path = args.eps_csv
    else:
        eps_path = d / "SC EPs-2026-04-30.csv"
    clean_tracks = d / "clean" / "sc_tracks-2026-04-30.csv"
    clean_eps = d / "clean" / "sc_eps-2026-04-30.csv"

    if not songs.is_file():
        raise SystemExit(f"Missing {songs}")

    song_sutra, songbook_map = load_song_sutra_and_songbook(songs)

    if args.eps_only:
        rows_e, fn_e = sync_eps(
            eps_path,
            song_sutra,
            songbook_map,
            songbook_only=args.songbook_only,
        )
        write_csv(eps_path, list(fn_e), rows_e)
        what = (
            "ep_songbook_title only (sutra unchanged)"
            if args.songbook_only
            else "sutra + ep_songbook_title from EP lyrics_id"
        )
        print(
            f"Loaded {len(song_sutra)} song sutras from {songs.name}\n"
            f"Wrote {eps_path} ({len(rows_e)} EPs; {what})\n"
        )
        return

    rows_t, fn_t = sync_tracks(tracks_path, song_sutra)
    rows_e, fn_e = sync_eps(eps_path, song_sutra, songbook_map)

    write_csv(tracks_path, list(fn_t), rows_t)
    write_csv(eps_path, list(fn_e), rows_e)

    if clean_tracks.is_file() and clean_eps.is_file():
        rows_ct, fn_ct = sync_tracks(clean_tracks, song_sutra)
        rows_ce, fn_ce = sync_eps(clean_eps, song_sutra, songbook_map)
        write_csv(clean_tracks, list(fn_ct), rows_ct)
        write_csv(clean_eps, list(fn_ce), rows_ce)

    n_tracks_synced = sum(
        1 for r in rows_t if (r.get("lyrics_id") or "").strip() in song_sutra
    )
    print(
        f"Loaded {len(song_sutra)} song sutras from {songs.name}\n"
        f"Wrote {tracks_path.name} ({len(rows_t)} tracks; sutra set from songs for {n_tracks_synced} rows)\n"
        f"Wrote {eps_path.name} ({len(rows_e)} EPs; sutra + ep_songbook_title when column present)\n"
        + (
            f"Also updated clean/{clean_tracks.name} and clean/{clean_eps.name}\n"
            if clean_tracks.is_file()
            else ""
        )
    )


if __name__ == "__main__":
    main()
