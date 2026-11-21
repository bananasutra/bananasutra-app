#!/usr/bin/env python3
"""
Fill local Airtable import CSVs from a cleaned snapshot.

The lyrics table is missing SoundCloud and YouTube descriptions, and the
video-link columns on lyrics / SoundCloud tracks / EPs are mostly empty,
because the free Airtable plan cannot link those tables. This script copies
the text and links across as ordinary fields and guesses which SoundCloud
version a video belongs to by comparing durations within the same lyrics_id.

It does not rebuild catalog JSON. Long descriptions stay off bananasutra.com.

Usage:
    python3 tools/clean_airtable_snapshot.py 2026-11-20
    python3 tools/enrich_airtable_media.py 2026-11-20

Writes AIRTABLE/snapshots/<date>/enrich/:
    lyrics-media-import.csv       merge on lyrics_id
    sc-tracks-video-import.csv    merge on track_id
    yt-videos-match-import.csv    merge on video_id
    sc-eps-video-import.csv       merge on ep_url
    match-review.csv              ambiguous, weak, and unpaired rows
    _MEDIA_ENRICH_REPORT.txt

Import the four *-import.csv files into the matching Airtable tables.
New columns to create as long text: _desc-sc, _desc-yt, _desc-bn,
vid_yturls, vid_ytplaylists, vid_song_urls. Single URL columns: vid_yturl,
sc_url. Checkboxes: vid_exist, yt_liked. _desc-bn stays blank until you
write it; a later enrich keeps whatever is already in that cell.
"""
from __future__ import annotations

import csv
import re
import sys
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path

from clean_airtable_snapshot import find_snapshot_folder

CHECKED = "checked"
CLOSE_SEC = 5
LOOSE_SEC = 15
WEAK_SEC = 30
AMBIGUOUS_GAP_SEC = 3

LABEL_RANK = {
    "exact": 0,
    "close": 1,
    "loose": 2,
    "ambiguous": 3,
    "weak": 4,
    "none": 5,
    "no_lyrics": 6,
    "song_only": 7,
}

LYRICS_FIELDS = [
    "lyrics_id",
    "song_title",
    "_desc-sc",
    "_desc-sc-from",
    "_desc-yt",
    "_desc-yt-from",
    "_desc-bn",
    "vid_exist",
    "vid_yturls",
    "vid_ytplaylists",
    "yt_like_max",
    "yt_liked",
    "yt_like_state",
]
TRACK_FIELDS = [
    "track_id",
    "track_title",
    "lyrics_id",
    "lyrics_title",
    "vid_exist",
    "vid_yturl",
    "vid_match",
    "vid_delta_sec",
    "vid_title",
    "vid_song_urls",
]
VIDEO_FIELDS = [
    "video_id",
    "title",
    "lyrics_id",
    "yt_liked",
    "yt_like_state",
    "sc_track_id",
    "sc_url",
    "sc_track_title",
    "vid_match",
    "vid_delta_sec",
]
EP_FIELDS = [
    "ep_url",
    "ep_title",
    "lyrics_id",
    "vid_exist",
    "vid_yturl",
    "vid_ytplaylist",
]
REVIEW_FIELDS = [
    "kind",
    "video_id",
    "title",
    "yt_url",
    "duration",
    "lyrics_id",
    "lyrics_title",
    "vid_match",
    "delta_sec",
    "second_delta_sec",
    "best_track_id",
    "best_track_title",
    "best_sc_url",
    "note",
]


@dataclass(frozen=True)
class TrackCand:
    seconds: int
    fav: bool
    in_app: bool
    plays: int
    track_id: str
    title: str
    url: str


@dataclass(frozen=True)
class DurationMatch:
    track: TrackCand
    delta: int
    second_delta: int | None
    band: str
    ambiguous: bool

    @property
    def label(self) -> str:
        if self.ambiguous and self.band in {"exact", "close", "loose"}:
            return "ambiguous"
        return self.band


def parse_duration_seconds(value: str | None) -> int | None:
    """Parse m:ss, h:mm:ss, or ISO-8601 PT#H#M#S into seconds."""
    text = (value or "").strip()
    if not text:
        return None
    iso = re.fullmatch(r"PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?", text)
    if iso and any(iso.groups()):
        hours, minutes, seconds = (int(part or 0) for part in iso.groups())
        return hours * 3600 + minutes * 60 + seconds
    parts = text.split(":")
    try:
        nums = [int(float(part)) for part in parts]
    except ValueError:
        return None
    if len(nums) == 2:
        return nums[0] * 60 + nums[1]
    if len(nums) == 3:
        return nums[0] * 3600 + nums[1] * 60 + nums[2]
    if len(nums) == 1:
        return nums[0]
    return None


def is_checked(value: str | None) -> bool:
    return (value or "").strip().lower() in {"checked", "true", "yes", "1"}


def parse_int(value: str | None) -> int | None:
    text = (value or "").strip()
    if not text:
        return None
    try:
        return int(float(text))
    except ValueError:
        return None


def like_state(count: int | None) -> str:
    if count is None:
        return "unknown"
    if count >= 1:
        return "liked"
    return "none"


def normalize_desc(text: str) -> str:
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def choose_description(rows: list[dict], rank_key) -> tuple[str, str]:
    """Pick one description. Identical text (ignoring spacing) collapses.

    rank_key(row) returns a tuple that sorts best-first.
    The stored text is the original cell, not the normalized form.
    """
    populated = [row for row in rows if normalize_desc(row.get("_text") or "")]
    if not populated:
        return "", ""
    groups: dict[str, list[dict]] = defaultdict(list)
    for row in populated:
        groups[normalize_desc(row["_text"])].append(row)
    if len(groups) == 1:
        longest = max(populated, key=lambda row: len(row.get("_text") or ""))
        noun = longest.get("_noun") or "rows"
        return (longest.get("_text") or "").strip(), f"shared by {len(populated)} {noun}"
    chosen = sorted(populated, key=rank_key)[0]
    source = (chosen.get("_source") or "").strip() or "chosen row"
    return (chosen.get("_text") or "").strip(), f"{source} ({len(groups)} variants)"


def match_band(delta: int) -> str:
    if delta == 0:
        return "exact"
    if delta <= CLOSE_SEC:
        return "close"
    if delta <= LOOSE_SEC:
        return "loose"
    if delta <= WEAK_SEC:
        return "weak"
    return "none"


def best_duration_match(video_sec: int, tracks: list[TrackCand]) -> DurationMatch | None:
    if not tracks:
        return None
    ranked = sorted(
        tracks,
        key=lambda track: (
            abs(track.seconds - video_sec),
            0 if track.fav else 1,
            0 if track.in_app else 1,
            -track.plays,
            track.track_id,
        ),
    )
    best = ranked[0]
    delta = abs(best.seconds - video_sec)
    second_delta = abs(ranked[1].seconds - video_sec) if len(ranked) > 1 else None
    band = match_band(delta)
    ambiguous = False
    if second_delta is not None and band in {"exact", "close", "loose"}:
        other = abs(ranked[1].seconds - video_sec)
        ambiguous = other <= delta + AMBIGUOUS_GAP_SEC and other <= LOOSE_SEC
    return DurationMatch(best, delta, second_delta, band, ambiguous)


def ambiguous_tracks(video_sec: int, tracks: list[TrackCand], match: DurationMatch) -> list[TrackCand]:
    """Every version close enough that the winner is not a safe single guess."""
    if not match.ambiguous:
        return [match.track]
    near: list[TrackCand] = []
    for track in tracks:
        delta = abs(track.seconds - video_sec)
        if delta <= match.delta + AMBIGUOUS_GAP_SEC and delta <= LOOSE_SEC:
            near.append(track)
    near.sort(key=lambda track: (0 if track.fav else 1, 0 if track.in_app else 1, -track.plays, track.track_id))
    return near or [match.track]


def split_ids(value: str | None) -> list[str]:
    parts = re.split(r"[\s,]+", (value or "").strip())
    return [part for part in parts if part]


def split_playlist_names(value: str | None) -> list[str]:
    return [part.strip() for part in (value or "").split(", ") if part.strip()]


def join_lines(values: list[str]) -> str:
    seen: list[str] = []
    for value in values:
        if value and value not in seen:
            seen.append(value)
    return "\n".join(seen)


def load_csv(path: Path) -> list[dict]:
    with path.open(encoding="utf-8-sig", newline="") as handle:
        rows = []
        for row in csv.DictReader(handle):
            rows.append({(key or "").lstrip("\ufeff"): value for key, value in row.items()})
        return rows


def write_csv(path: Path, fields: list[str], rows: list[dict]) -> None:
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields, extrasaction="ignore", lineterminator="\n")
        writer.writeheader()
        for row in rows:
            writer.writerow({field: row.get(field, "") for field in fields})


def checked_or_blank(flag: bool) -> str:
    return CHECKED if flag else ""


def existing_banana_desc(row: dict) -> str:
    """Keep a hand-written _desc-bn across re-enrich. The other desc columns are derived."""
    return (row.get("desc_bn") or row.get("_desc-bn") or "").strip()


def _clean_file(clean_dir: Path, prefix: str, date_stamp: str) -> Path:
    path = clean_dir / f"{prefix}-{date_stamp}.csv"
    if not path.exists():
        raise SystemExit(
            f"ERROR: {path} missing. Run python3 tools/clean_airtable_snapshot.py {date_stamp} first."
        )
    return path


def _track_rank(row: dict) -> tuple:
    plays = parse_int(row.get("play_count")) or 0
    return (
        0 if is_checked(row.get("fav_track")) else 1,
        0 if is_checked(row.get("track_in_app")) else 1,
        -plays,
        -len(row.get("_text") or ""),
        row.get("track_id") or "",
    )


def _video_rank(row: dict) -> tuple:
    likes = parse_int(row.get("like_count"))
    rating = parse_int(row.get("rating"))
    return (
        -(likes if likes is not None else -1),
        -(rating if rating is not None else -1),
        -len(row.get("_text") or ""),
        row.get("video_id") or "",
    )


def _rollup_like_state(states: list[str]) -> str:
    if any(state == "liked" for state in states):
        return "liked"
    if any(state == "none" for state in states):
        return "none"
    if states:
        return "unknown"
    return ""


def enrich(snap: Path) -> dict:
    date_stamp = snap.name
    clean_dir = snap / "clean"
    lyrics = load_csv(_clean_file(clean_dir, "lyrics", date_stamp))
    tracks = load_csv(_clean_file(clean_dir, "sc_tracks", date_stamp))
    videos = load_csv(_clean_file(clean_dir, "yt_videos", date_stamp))
    eps = load_csv(_clean_file(clean_dir, "sc_eps", date_stamp))
    playlists = load_csv(_clean_file(clean_dir, "yt_playlists", date_stamp))

    playlist_url = {
        (row.get("playlist_name") or "").strip(): (row.get("playlist_url") or "").strip()
        for row in playlists
        if (row.get("playlist_name") or "").strip()
    }
    lyrics_by_id = {(row.get("lyrics_id") or "").strip(): row for row in lyrics}
    known_ids = set(lyrics_by_id)

    tracks_by_song: dict[str, list[dict]] = defaultdict(list)
    for track in tracks:
        song_id = (track.get("lyrics_id") or "").strip()
        if song_id:
            tracks_by_song[song_id].append(track)

    videos_by_song: dict[str, list[dict]] = defaultdict(list)
    for video in videos:
        song_id = (video.get("lyrics_id") or "").strip()
        if song_id and song_id in known_ids:
            videos_by_song[song_id].append(video)

    def song_videos(song_id: str) -> list[dict]:
        return sorted(
            videos_by_song.get(song_id, []),
            key=lambda row: ((row.get("publish_date") or ""), (row.get("video_id") or "")),
        )

    # Duration guess: video -> one or more tracks of the same song.
    video_links: dict[str, dict] = {}
    track_hits: dict[str, list[dict]] = defaultdict(list)
    review: list[dict] = []

    for video in videos:
        video_id = (video.get("video_id") or "").strip()
        song_id = (video.get("lyrics_id") or "").strip()
        title = (video.get("title") or "").strip()
        yt_url = (video.get("yt_url") or "").strip()
        seconds = parse_duration_seconds(video.get("duration"))
        likes = parse_int(video.get("like_count"))
        state = like_state(likes)
        if not song_id:
            match_label = "no_lyrics"
        elif song_id not in known_ids:
            match_label = "unknown_lyrics"
        else:
            match_label = "none"
        base = {
            "video_id": video_id,
            "title": title,
            "lyrics_id": song_id,
            "yt_liked": checked_or_blank(state == "liked"),
            "yt_like_state": state,
            "sc_track_id": "",
            "sc_url": "",
            "sc_track_title": "",
            "vid_match": match_label,
            "vid_delta_sec": "",
        }
        if not song_id or song_id not in known_ids:
            video_links[video_id] = base
            review.append(
                {
                    "kind": "orphan_video" if not song_id else "unknown_lyrics_id",
                    "video_id": video_id,
                    "title": title,
                    "yt_url": yt_url,
                    "duration": (video.get("duration") or "").strip(),
                    "lyrics_id": song_id,
                    "lyrics_title": (video.get("lyrics_title") or "").strip(),
                    "vid_match": base["vid_match"],
                    "delta_sec": "",
                    "second_delta_sec": "",
                    "best_track_id": "",
                    "best_track_title": "",
                    "best_sc_url": "",
                    "note": (
                        "No lyrics_id on this video, so duration was not used across the catalog."
                        if not song_id
                        else "lyrics_id is not on the lyrics table, so no track was guessed."
                    ),
                }
            )
            continue

        if seconds is None:
            base["vid_match"] = "no_duration"
            video_links[video_id] = base
            continue

        cands: list[TrackCand] = []
        for track in tracks_by_song.get(song_id, []):
            track_sec = parse_duration_seconds(track.get("duration"))
            if track_sec is None:
                continue
            cands.append(
                TrackCand(
                    seconds=track_sec,
                    fav=is_checked(track.get("fav_track")),
                    in_app=is_checked(track.get("track_in_app")),
                    plays=parse_int(track.get("play_count")) or 0,
                    track_id=(track.get("track_id") or "").strip(),
                    title=(track.get("track_title") or "").strip(),
                    url=(track.get("sc_url") or "").strip(),
                )
            )
        if not cands:
            base["vid_match"] = "no_track"
            video_links[video_id] = base
            continue

        match = best_duration_match(seconds, cands)
        if match is None:
            video_links[video_id] = base
            continue

        label = match.label
        base["vid_match"] = label
        base["vid_delta_sec"] = str(match.delta)
        attach = label in {"exact", "close", "loose", "ambiguous", "weak"}
        targets = ambiguous_tracks(seconds, cands, match) if label == "ambiguous" else [match.track]
        if attach:
            chosen = targets[0]
            base["sc_track_id"] = chosen.track_id
            base["sc_url"] = chosen.url
            base["sc_track_title"] = chosen.title
            for track in targets:
                track_hits[track.track_id].append(
                    {
                        "label": label,
                        "delta": match.delta if track.track_id == match.track.track_id else abs(track.seconds - seconds),
                        "likes": likes if likes is not None else -1,
                        "yt_url": yt_url,
                        "title": title,
                        "video_id": video_id,
                    }
                )
        video_links[video_id] = base
        if label in {"ambiguous", "weak", "none"}:
            song = lyrics_by_id.get(song_id, {})
            review.append(
                {
                    "kind": label,
                    "video_id": video_id,
                    "title": title,
                    "yt_url": yt_url,
                    "duration": (video.get("duration") or "").strip(),
                    "lyrics_id": song_id,
                    "lyrics_title": (song.get("song_title") or video.get("lyrics_title") or "").strip(),
                    "vid_match": label,
                    "delta_sec": str(match.delta),
                    "second_delta_sec": "" if match.second_delta is None else str(match.second_delta),
                    "best_track_id": match.track.track_id,
                    "best_track_title": match.track.title,
                    "best_sc_url": match.track.url,
                    "note": (
                        "Every version inside that 3s window stays linked and flagged ambiguous."
                        if label == "ambiguous"
                        else "Closest version is only a weak guess (16–30s)."
                        if label == "weak"
                        else "Closest version is more than 30s off. No track link was written."
                    ),
                }
            )

    lyrics_rows: list[dict] = []
    desc_sc_filled = desc_yt_filled = 0
    sc_variants = yt_variants = 0
    songs_with_video = 0
    manual_kept = 0

    for song in lyrics:
        song_id = (song.get("lyrics_id") or "").strip()
        song_tracks = tracks_by_song.get(song_id, [])
        song_vids = song_videos(song_id)
        sc_text, sc_from = choose_description(
            [
                {
                    **track,
                    "_text": track.get("description") or "",
                    "_source": (track.get("track_title") or "").strip(),
                    "_noun": "tracks",
                }
                for track in song_tracks
            ],
            _track_rank,
        )
        yt_text, yt_from = choose_description(
            [
                {
                    **video,
                    "_text": video.get("description") or "",
                    "_source": (video.get("title") or "").strip(),
                    "_noun": "videos",
                }
                for video in song_vids
            ],
            _video_rank,
        )
        if sc_text:
            desc_sc_filled += 1
        if yt_text:
            desc_yt_filled += 1
        if "variants" in sc_from:
            sc_variants += 1
        if "variants" in yt_from:
            yt_variants += 1

        urls = [(video.get("yt_url") or "").strip() for video in song_vids]
        playlist_lines = []
        for video in song_vids:
            for name in split_playlist_names(video.get("playlist_names")):
                url = playlist_url.get(name, "")
                playlist_lines.append(f"{name} | {url}" if url else name)
        like_values = [parse_int(video.get("like_count")) for video in song_vids]
        known_likes = [count for count in like_values if count is not None]
        states = [like_state(count) for count in like_values]
        has_video = bool(song_vids)
        manual = is_checked(song.get("vid_exist"))
        if manual and not has_video:
            manual_kept += 1
            review.append(
                {
                    "kind": "manual_vid_without_video",
                    "video_id": "",
                    "title": "",
                    "yt_url": "",
                    "duration": "",
                    "lyrics_id": song_id,
                    "lyrics_title": (song.get("song_title") or "").strip(),
                    "vid_match": "",
                    "delta_sec": "",
                    "second_delta_sec": "",
                    "best_track_id": "",
                    "best_track_title": "",
                    "best_sc_url": "",
                    "note": "vid_exist was already checked and no YouTube row shares this lyrics_id. Left checked.",
                }
            )
        if has_video:
            songs_with_video += 1
        lyrics_rows.append(
            {
                "lyrics_id": song_id,
                "song_title": (song.get("song_title") or "").strip(),
                "_desc-sc": sc_text,
                "_desc-sc-from": sc_from,
                "_desc-yt": yt_text,
                "_desc-yt-from": yt_from,
                "_desc-bn": existing_banana_desc(song),
                "vid_exist": checked_or_blank(has_video or manual),
                "vid_yturls": join_lines(urls),
                "vid_ytplaylists": join_lines(playlist_lines),
                "yt_like_max": "" if not known_likes else str(max(known_likes)),
                "yt_liked": checked_or_blank(any(state == "liked" for state in states)),
                "yt_like_state": _rollup_like_state(states),
            }
        )

    track_rows: list[dict] = []
    tracks_linked = 0
    for track in tracks:
        song_id = (track.get("lyrics_id") or "").strip()
        track_id = (track.get("track_id") or "").strip()
        hits = track_hits.get(track_id, [])
        song_vids = song_videos(song_id)
        urls = join_lines((video.get("yt_url") or "").strip() for video in song_vids)
        if hits:
            hits_sorted = sorted(hits, key=lambda hit: (LABEL_RANK[hit["label"]], hit["delta"], -hit["likes"], hit["video_id"]))
            best = hits_sorted[0]
            tracks_linked += 1
            match_label = best["label"]
            match_url = best["yt_url"]
            match_title = best["title"]
            match_delta = str(best["delta"])
        else:
            match_label = "song_only" if song_vids else ""
            match_url = ""
            match_title = ""
            match_delta = ""
        track_rows.append(
            {
                "track_id": track_id,
                "track_title": (track.get("track_title") or "").strip(),
                "lyrics_id": song_id,
                "lyrics_title": (track.get("lyrics_title") or "").strip(),
                "vid_exist": checked_or_blank(bool(song_vids)),
                "vid_yturl": match_url,
                "vid_match": match_label,
                "vid_delta_sec": match_delta,
                "vid_title": match_title,
                "vid_song_urls": urls,
            }
        )

    video_rows = [video_links[(video.get("video_id") or "").strip()] for video in videos]

    ep_rows: list[dict] = []
    eps_with_video = 0
    for ep in eps:
        song_ids = split_ids(ep.get("lyrics_id"))
        urls: list[str] = []
        playlist_lines: list[str] = []
        for song_id in song_ids:
            for video in song_videos(song_id):
                urls.append((video.get("yt_url") or "").strip())
                for name in split_playlist_names(video.get("playlist_names")):
                    url = playlist_url.get(name, "")
                    playlist_lines.append(f"{name} | {url}" if url else name)
        has_video = bool([url for url in urls if url])
        if has_video:
            eps_with_video += 1
        ep_rows.append(
            {
                "ep_url": (ep.get("ep_url") or "").strip(),
                "ep_title": (ep.get("ep_title") or "").strip(),
                "lyrics_id": (ep.get("lyrics_id") or "").strip(),
                "vid_exist": checked_or_blank(has_video),
                "vid_yturl": join_lines(urls),
                "vid_ytplaylist": join_lines(playlist_lines),
            }
        )

    out_dir = snap / "enrich"
    out_dir.mkdir(exist_ok=True)
    write_csv(out_dir / "lyrics-media-import.csv", LYRICS_FIELDS, lyrics_rows)
    write_csv(out_dir / "sc-tracks-video-import.csv", TRACK_FIELDS, track_rows)
    write_csv(out_dir / "yt-videos-match-import.csv", VIDEO_FIELDS, video_rows)
    write_csv(out_dir / "sc-eps-video-import.csv", EP_FIELDS, ep_rows)
    write_csv(out_dir / "match-review.csv", REVIEW_FIELDS, review)

    like_states = [row["yt_like_state"] for row in video_rows]
    match_counts: dict[str, int] = defaultdict(int)
    for row in video_rows:
        match_counts[row["vid_match"]] += 1

    summary = {
        "date": date_stamp,
        "lyrics": len(lyrics_rows),
        "tracks": len(track_rows),
        "videos": len(video_rows),
        "eps": len(ep_rows),
        "desc_sc_filled": desc_sc_filled,
        "desc_yt_filled": desc_yt_filled,
        "sc_variants": sc_variants,
        "yt_variants": yt_variants,
        "songs_with_video": songs_with_video,
        "tracks_linked": tracks_linked,
        "eps_with_video": eps_with_video,
        "manual_kept": manual_kept,
        "review_rows": len(review),
        "like_liked": like_states.count("liked"),
        "like_none": like_states.count("none"),
        "like_unknown": like_states.count("unknown"),
        "match_counts": dict(match_counts),
        "out_dir": str(out_dir),
    }
    report = _report(summary)
    (out_dir / "_MEDIA_ENRICH_REPORT.txt").write_text(report, encoding="utf-8")
    print(report)
    return summary


def _report(summary: dict) -> str:
    counts = summary["match_counts"]
    lines = [
        f"AIRTABLE MEDIA ENRICH — {summary['date']}",
        "=" * 70,
        "",
        "Local import CSVs only. Catalog JSON was not rebuilt.",
        "_desc-bn is present and empty so the column exists for later site copy.",
        "",
        f"Lyrics rows                 {summary['lyrics']}",
        f"  _desc-sc filled           {summary['desc_sc_filled']}  (variants: {summary['sc_variants']})",
        f"  _desc-yt filled           {summary['desc_yt_filled']}  (variants: {summary['yt_variants']})",
        f"  songs with a video link   {summary['songs_with_video']}",
        f"  manual vid_exist kept     {summary['manual_kept']}",
        f"SC tracks                   {summary['tracks']}",
        f"  tracks with a guessed URL {summary['tracks_linked']}",
        f"SC EPs with a video link    {summary['eps_with_video']} / {summary['eps']}",
        f"YouTube videos              {summary['videos']}",
        f"  yt_like_state liked       {summary['like_liked']}",
        f"  yt_like_state none        {summary['like_none']}",
        f"  yt_like_state unknown     {summary['like_unknown']}",
        "Duration match (videos):",
    ]
    for label in ("exact", "close", "loose", "ambiguous", "weak", "none", "no_track", "no_duration", "no_lyrics", "unknown_lyrics"):
        lines.append(f"  {label:18} {counts.get(label, 0)}")
    lines.extend(
        [
            "",
            f"Review rows                 {summary['review_rows']}",
            f"Output                      {summary['out_dir']}",
            "",
            "Airtable import: merge lyrics on lyrics_id, tracks on track_id,",
            "videos on video_id, EPs on ep_url. Do not publish these description",
            "columns to the website from this step.",
            "",
            "Match labels: exact 0s, close 1–5s, loose 6–15s, weak 16–30s,",
            "ambiguous = another version within 3s of the best and still ≤15s,",
            "none = closest version is >30s off (no track URL written).",
            "vid_exist on a track means the song has a video. vid_yturl is the",
            "duration guess for that version. vid_song_urls lists every video.",
            "",
            "yt_liked is checked only when YouTube returned like_count >= 1.",
            "unknown means the API omitted likeCount (views were still returned).",
            "That is not stored as a fail.",
            "",
        ]
    )
    return "\n".join(lines)


def main() -> int:
    arg = sys.argv[1] if len(sys.argv) > 1 else None
    if arg == "--self-test":
        raise SystemExit("Run python3 tools/test_enrich_airtable_media.py")
    enrich(find_snapshot_folder(arg))
    return 0


if __name__ == "__main__":
    sys.exit(main())
