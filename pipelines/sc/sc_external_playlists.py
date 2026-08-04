#!/usr/bin/env python3
"""
sc_external_playlists.py
=========================
Finds every playlist — yours OR anyone else's — that contains each of your
SoundCloud tracks, and keeps a permanent, append-only log of when each
(track, external playlist) pairing was FIRST seen. SoundCloud does not
notify you when a stranger adds your track to their playlist; this is the
replacement for that missing notification.

Scope: the FULL scrape universe (pipelines/sc/outputs/AT-TRACKS-FULL-v4.csv,
~2,268 tracks) — deliberately NOT limited to the ~740-track official catalog,
per Banana's request, since a track's own play/like count says nothing about
whether an outside curator already found and added it.

HOW IT FINDS PLAYLIST MEMBERSHIP (please read before a full run)
------------------------------------------------------------------
I could not test this script against the live SoundCloud API from my sandbox
(no network egress to soundcloud.com there), so this uses the SAME two-phase
approach bananasutra_sc_export.py already proves works on your machine for a
different endpoint, rather than a fresh guess:

  Phase 1 — direct API call to the (unofficial, but widely used) endpoint
            GET /tracks/{id}/playlists_without_albums
            This mirrors the naming convention SC's own api-v2 already uses
            elsewhere in your pipeline (e.g. fetch_all_playlists).

  Phase 2 — if that fails or returns something unexpected, fall back to
            loading the track's public /sets page and reading the
            window.__sc_hydration JSON embedded in the page — the exact
            technique fetch_all_tracks() already uses successfully in
            bananasutra_sc_export.py. This is public data (no login/OAuth
            required), so no cookies are needed for this fallback either,
            but load_chrome_cookies() is still used for parity with the
            rest of the pipeline in case SC's bot detection wants a real
            session.

RUN THIS FIRST IN VALIDATION MODE:
    python3 sc_external_playlists.py --sample 15
Check the printed output + the CSV look right (real playlist names, real
owners, not empty / garbage). Only then run the full pass:
    python3 sc_external_playlists.py --all

Outputs (into pipelines/sc/outputs/, archived like the rest of the pipeline):
    SC-EXTERNAL-PLAYLISTS.csv       current snapshot. bananasutra's OWN
                                    playlists are filtered out entirely at
                                    collection time (that's already fully
                                    covered by sc_playlists — no point
                                    duplicating it in a file named
                                    "external"). Every row here is someone
                                    else's playlist.
    SC-EXTERNAL-PLAYLIST-LOG.csv    cumulative, append-only. Never
                                    overwritten — every run adds only the
                                    (track, external playlist) pairs never
                                    seen in a prior run, stamped with
                                    first_seen_date. THIS is your history.

EXTRA PLAYLIST/OWNER DATA (added per your request — confidence varies)
------------------------------------------------------------------------
Getting a playlist's ID from the track lookup only gives a "mini" object.
To get track_count / duration / likes_count / reposts_count / last-updated
date, this now makes ONE extra call per DISTINCT external playlist to
GET /playlists/{id} (the same endpoint fetch_full_set() already uses
successfully for your own playlists — so I'm reasonably confident it works
the same way for other people's public playlists). Deduped by playlist_id,
so a playlist that has 10 of your tracks in it only gets fetched once.

Owner follower count needs a further call to GET /users/{id}, deduped by
owner — also reasonably confident, this is a standard public profile field.

Playlist PLAY COUNT: I'm not adding this. SoundCloud does not track an
aggregate "plays" number for a playlist the way it does for a track — the
only way to approximate it would be summing the play counts of every track
inside every external playlist, which means fully scraping playlists that
aren't yours (unknown size, unknown track counts, a much bigger job for a
number that would only be an approximation anyway). Tell me if you still
want that and I'll scope it separately.

Every one of these extra fields is best-effort: if SoundCloud's response
doesn't have it, the script leaves it blank rather than guessing, and the
end-of-run summary tells you how many playlists/owners came back with each
field populated so you can see the actual hit rate, not just trust it blindly.

Resume: sc_ext_checkpoint.json (auto-saved every 50 tracks, deleted on success)
"""

import argparse
import csv
import json
import os
import re
import sys
import time
from datetime import date, datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bananasutra_sc_export as base  # reuses SESSION, get_client_id, api_get, cookies

_SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
_OUT_DIR = os.path.join(_SCRIPT_DIR, "outputs")
_ARCHIVE_DIR = os.path.join(_OUT_DIR, "archive", date.today().isoformat())
os.makedirs(_OUT_DIR, exist_ok=True)
os.makedirs(_ARCHIVE_DIR, exist_ok=True)

TRACKS_CSV = os.path.join(_OUT_DIR, "AT-TRACKS-FULL-v4.csv")
SNAPSHOT_CSV = os.path.join(_OUT_DIR, "SC-EXTERNAL-PLAYLISTS.csv")
LOG_CSV = os.path.join(_OUT_DIR, "SC-EXTERNAL-PLAYLIST-LOG.csv")
CHECKPOINT = os.path.join(os.path.dirname(TRACKS_CSV), "..", "raw", "sc_ext_checkpoint.json")
CHECKPOINT = os.path.normpath(CHECKPOINT)

OWNER_USERNAME = "bananasutra"
CALL_DELAY = 1.2
SAVE_EVERY = 50


def load_tracks():
    with open(TRACKS_CSV, encoding="utf-8-sig") as f:
        rows = list(csv.DictReader(f))
    out = []
    for r in rows:
        if r.get("track_id", "").strip() and r.get("sc_url", "").strip():
            out.append({
                "track_id": r["track_id"].strip(),
                "track_title": r["track_title"].strip(),
                "sc_url": r["sc_url"].strip(),
                "in_official_catalog": "Yes" if r.get("track_in_app", "").strip() == "checked" else "No",
            })
    return out


def _playlist_shaped(d):
    return isinstance(d, dict) and "permalink_url" in d and "/sets/" in (d.get("permalink_url") or "")


def _extract_playlists_from_collection(collection):
    out = []
    for pl in collection:
        if not _playlist_shaped(pl):
            continue
        user = pl.get("user") or {}
        owner_permalink = (user.get("permalink") or "").lower()
        if owner_permalink == OWNER_USERNAME:
            continue  # skip bananasutra's own playlists at collection time
        out.append({
            "playlist_id": pl.get("id"),
            "playlist_title": pl.get("title", ""),
            "playlist_url": pl.get("permalink_url", ""),
            "owner_id": user.get("id"),
            "owner_username": user.get("username", ""),
            "owner_permalink": owner_permalink,
            "owner_url": user.get("permalink_url", ""),
            "playlist_published_at": pl.get("created_at") or pl.get("last_modified") or "",
        })
    return out


def fetch_playlist_detail(playlist_id, client_id, cache):
    """One extra call per distinct external playlist — same GET /playlists/{id}
    endpoint fetch_full_set() already uses successfully for your own playlists.
    Returns a dict with whatever fields SC's response actually has; blanks for
    the rest rather than guessing."""
    if playlist_id in cache:
        return cache[playlist_id]
    detail = {"track_count": "", "duration_ms": "", "likes_count": "", "reposts_count": "",
              "last_updated_at": "", "genre": "", "owner_id_from_detail": "",
              "owner_followers_count": ""}
    try:
        url = f"https://api-v2.soundcloud.com/playlists/{playlist_id}?client_id={client_id}&representation=full"
        data = base.api_get(url, client_id)
        detail["track_count"] = data.get("track_count", data.get("tracks_count", ""))
        if detail["track_count"] == "" and isinstance(data.get("tracks"), list):
            detail["track_count"] = len(data["tracks"])
        detail["duration_ms"] = data.get("duration", "")
        detail["likes_count"] = data.get("likes_count", "")
        detail["reposts_count"] = data.get("reposts_count", "")
        detail["last_updated_at"] = data.get("last_modified", "") or data.get("created_at", "")
        detail["genre"] = data.get("genre", "")
        user = data.get("user") or {}
        detail["owner_id_from_detail"] = user.get("id", "")
        if "followers_count" in user:
            detail["owner_followers_count"] = user.get("followers_count", "")
    except Exception as e:
        print(f"    ⚠  playlist detail lookup failed for playlist {playlist_id} ({e})")
    cache[playlist_id] = detail
    return detail


def fetch_owner_followers(owner_id, client_id, cache):
    """One extra call per distinct external owner, only if the playlist detail
    call didn't already include followers_count inline."""
    if not owner_id:
        return ""
    if owner_id in cache:
        return cache[owner_id]
    followers = ""
    try:
        url = f"https://api-v2.soundcloud.com/users/{owner_id}?client_id={client_id}"
        data = base.api_get(url, client_id)
        followers = data.get("followers_count", "")
    except Exception as e:
        print(f"    ⚠  owner followers lookup failed for user {owner_id} ({e})")
    cache[owner_id] = followers
    return followers


def fetch_playlists_for_track(track_id, sc_url, client_id):
    """Two-phase lookup: direct api-v2 endpoint, then hydration-JSON fallback
    from the public /sets page. Returns (playlists, method_used)."""

    # Phase 1: direct API
    try:
        url = (
            f"https://api-v2.soundcloud.com/tracks/{track_id}/playlists_without_albums"
            f"?limit=200&client_id={client_id}"
        )
        results = []
        next_href = url
        pages = 0
        while next_href and pages < 10:
            data = base.api_get(next_href, client_id)
            collection = data.get("collection")
            if collection is None:
                raise ValueError("no 'collection' key — endpoint shape unexpected")
            results.extend(_extract_playlists_from_collection(collection))
            next_href = data.get("next_href")
            if next_href and "client_id" not in next_href:
                next_href = f"{next_href}&client_id={client_id}"
            pages += 1
        return results, "direct_api"
    except Exception as e:
        print(f"    ⚠  direct API failed for track {track_id} ({e}) — trying page hydration...")

    # Phase 2: hydration JSON from the public /sets page
    try:
        sets_url = sc_url.rstrip("/") + "/sets"
        r = base.SESSION.get(sets_url, timeout=25, headers={
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Sec-Fetch-Dest": "document", "Sec-Fetch-Mode": "navigate",
        })
        if r.status_code != 200:
            return [], f"failed_http_{r.status_code}"
        m = re.search(r'window\.__sc_hydration\s*=\s*(\[.+?\]);\s*(?:</script>|window\.)', r.text, re.DOTALL)
        if not m:
            return [], "failed_no_hydration"
        hydration = json.loads(m.group(1))
        results = []
        for item in hydration:
            data = item.get("data")
            if isinstance(data, dict) and isinstance(data.get("collection"), list):
                results.extend(_extract_playlists_from_collection(data["collection"]))
            elif isinstance(data, list):
                results.extend(_extract_playlists_from_collection(data))
        return results, "hydration_fallback"
    except Exception as e:
        print(f"    ⚠  hydration fallback also failed for track {track_id} ({e})")
        return [], "failed_both"


def save_checkpoint(data):
    os.makedirs(os.path.dirname(CHECKPOINT), exist_ok=True)
    with open(CHECKPOINT, "w", encoding="utf-8") as f:
        json.dump(data, f)
    print(f"  💾 Progress saved → {CHECKPOINT}")


def load_checkpoint():
    if os.path.exists(CHECKPOINT):
        with open(CHECKPOINT, encoding="utf-8") as f:
            return json.load(f)
    return None


def clear_checkpoint():
    if os.path.exists(CHECKPOINT):
        os.remove(CHECKPOINT)


def load_previous_log():
    seen = set()
    if not os.path.exists(LOG_CSV):
        return seen
    with open(LOG_CSV, encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            seen.add((row["track_id"], row["playlist_id"]))
    return seen


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--sample", type=int, default=None,
                     help="Only process the first N tracks (validation run)")
    ap.add_argument("--all", action="store_true", help="Process the full track universe")
    args = ap.parse_args()

    if not args.sample and not args.all:
        print("Specify --sample N (validation run) or --all (full run). Exiting.")
        sys.exit(1)

    if not os.path.exists(TRACKS_CSV):
        print(f"Missing {TRACKS_CSV} — run build_sc_final_v4.py first.")
        sys.exit(1)

    tracks = load_tracks()
    if args.sample:
        tracks = tracks[:args.sample]
    print(f"Loaded {len(tracks)} tracks to check.")

    checkpoint = load_checkpoint()
    start_idx = 0
    all_rows = []
    if checkpoint and checkpoint.get("total") == len(tracks):
        ans = input(f"Resume from checkpoint at track {checkpoint['idx']}/{len(tracks)}? [y/n]: ").strip().lower()
        if ans == "y":
            start_idx = checkpoint["idx"]
            all_rows = checkpoint["rows"]

    print("\n[Step 1] Getting client_id...")
    base.load_chrome_cookies()
    client_id, app_version = base.get_client_id()

    playlist_cache = {}
    owner_cache = {}
    method_counts = {}
    for i in range(start_idx, len(tracks)):
        t = tracks[i]
        print(f"  [{i+1}/{len(tracks)}] {t['track_title'][:60]}")
        playlists, method = fetch_playlists_for_track(t["track_id"], t["sc_url"], client_id)
        method_counts[method] = method_counts.get(method, 0) + 1
        for pl in playlists:
            detail = fetch_playlist_detail(pl["playlist_id"], client_id, playlist_cache)
            followers = detail["owner_followers_count"]
            if followers == "":
                followers = fetch_owner_followers(
                    pl["owner_id"] or detail["owner_id_from_detail"], client_id, owner_cache)
            all_rows.append({
                "track_id": t["track_id"], "track_title": t["track_title"], "sc_url": t["sc_url"],
                "in_official_catalog": t["in_official_catalog"],
                "playlist_id": pl["playlist_id"], "playlist_title": pl["playlist_title"],
                "playlist_url": pl["playlist_url"], "owner_username": pl["owner_username"],
                "owner_url": pl["owner_url"],
                "playlist_published_at": pl["playlist_published_at"],
                "playlist_last_updated_at": detail["last_updated_at"],
                "playlist_track_count": detail["track_count"],
                "playlist_duration_ms": detail["duration_ms"],
                "playlist_likes_count": detail["likes_count"],
                "playlist_reposts_count": detail["reposts_count"],
                "owner_followers_count": followers,
                "scrape_date": date.today().isoformat(), "lookup_method": method,
            })
        time.sleep(CALL_DELAY)
        if (i + 1) % SAVE_EVERY == 0:
            save_checkpoint({"idx": i + 1, "total": len(tracks), "rows": all_rows})

    clear_checkpoint()
    print(f"\nLookup methods used: {method_counts}")

    n_ext_playlists = len({r["playlist_id"] for r in all_rows})
    for field, label in [("playlist_track_count", "track count"), ("playlist_duration_ms", "duration"),
                          ("playlist_likes_count", "likes"), ("playlist_reposts_count", "reposts"),
                          ("playlist_last_updated_at", "last-updated date"),
                          ("owner_followers_count", "owner followers")]:
        hit = len({r["playlist_id"] for r in all_rows if str(r.get(field, "")).strip() != ""})
        print(f"  Field hit rate — {label}: {hit}/{n_ext_playlists} distinct playlists")

    # ---- write current snapshot ----
    snap_headers = ["track_id", "track_title", "sc_url", "in_official_catalog", "playlist_id",
                     "playlist_title", "playlist_url", "owner_username", "owner_url",
                     "playlist_published_at", "playlist_last_updated_at", "playlist_track_count",
                     "playlist_duration_ms", "playlist_likes_count", "playlist_reposts_count",
                     "owner_followers_count", "scrape_date", "lookup_method"]
    with open(SNAPSHOT_CSV, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=snap_headers)
        w.writeheader()
        w.writerows(all_rows)
    with open(os.path.join(_ARCHIVE_DIR, "SC-EXTERNAL-PLAYLISTS.csv"), "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=snap_headers)
        w.writeheader()
        w.writerows(all_rows)
    print(f"✓ Wrote {len(all_rows)} rows → {SNAPSHOT_CSV}")

    # ---- diff against cumulative log, append only new (track, playlist) pairs ----
    # (every row here is already an external playlist — filtered at collection time)
    previously_seen = load_previous_log()
    new_events = []
    for row in all_rows:
        key = (row["track_id"], row["playlist_id"])
        if key in previously_seen:
            continue
        previously_seen.add(key)
        new_events.append({**row, "first_seen_date": date.today().isoformat()})

    log_headers = snap_headers + ["first_seen_date"]
    log_exists = os.path.exists(LOG_CSV)
    with open(LOG_CSV, "a", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=log_headers)
        if not log_exists:
            w.writeheader()
        w.writerows(new_events)

    print(f"✓ {len(new_events)} NEW external playlist addition(s) since last run → appended to {LOG_CSV}")
    if new_events:
        print("\nNew external additions this run:")
        for e in new_events:
            print(f"  • '{e['track_title'][:50]}' added to \"{e['playlist_title']}\" "
                  f"by {e['owner_username']} — {e['playlist_url']}")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n⚠  Interrupted. A checkpoint was saved if you'd passed the first 50 tracks — re-run to resume.")
