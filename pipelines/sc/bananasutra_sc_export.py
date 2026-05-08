#!/usr/bin/env python3
"""
bananasutra_sc_export.py
========================
Exports all SoundCloud tracks for soundcloud.com/bananasutra
including play count, like count, and full playlist membership.

Output: pipelines/sc/raw/bananasutra_sc_export.csv  (ALL tracks; + artwork_lg_url column)
        pipelines/sc/raw/sc_playlist_art_api.json   — playlist/set covers from SC API (dual sizes), consumed by build_sc_final_v4.py

        The 300 plays / 5 likes Airtable import filter is NOT applied here — it lives in
        build_sc_final_v4.py, which writes AT-TRACKS-v4.csv (import set) and
        AT-TRACKS-FULL-v4.csv (full scrape) from this file.

Resume: sc_checkpoint.json (auto-saved mid-run, deleted on success)

Run:
    python3 bananasutra_sc_export.py

Changes from previous version:
  - [NEW] Step 3.5: enrich_missing_dates() — for any track missing created_at,
      calls GET /tracks/{id} individually. The bulk endpoint returns partial
      metadata for ~70% of tracks; the individual endpoint is reliable.
  - [NEW] Step 3.6: fetch_user_likes() — fetches all track IDs the user has
      liked. Adds a `user_liked` boolean column to the CSV so the post-
      processing filter can include liked tracks regardless of play/like count.
  - [NEW] ep_created_at — extracted from the playlist object in build_indexes()
      and written to the CSV as ep_created_at. Used by build_final_v3.py to
      populate the EPS table's created_at field.
"""

import time
import csv
import json
import re
import os
import shutil
import sys
from datetime import datetime, date

from sc_sndcdn_artwork import sndcdn_artwork_sm_lg

try:
    from curl_cffi import requests
    CURL_CFFI = True
except ImportError:
    import requests
    CURL_CFFI = False

# ── CONFIG ────────────────────────────────────────────────────────────────────

SC_PROFILE_URL = "https://soundcloud.com/bananasutra"

# Write raw scrape + checkpoint into pipelines/sc/raw/ regardless of where
# this script is invoked from. build_sc_final_v4.py reads from the same
# location.
_SCRIPT_DIR    = os.path.dirname(os.path.abspath(__file__))
_RAW_DIR       = os.path.join(_SCRIPT_DIR, "raw")
os.makedirs(_RAW_DIR, exist_ok=True)
OUTPUT_CSV     = os.path.join(_RAW_DIR, "bananasutra_sc_export.csv")
OUTPUT_PLAYLIST_ART_API = os.path.join(_RAW_DIR, "sc_playlist_art_api.json")
CHECKPOINT     = os.path.join(_RAW_DIR, "sc_checkpoint.json")

# ── YOUR SOUNDCLOUD OAUTH TOKEN ───────────────────────────────────────────────
# SoundCloud now requires your personal login token to fetch track listings.
# This token is tied to your logged-in browser session.
#
# HOW TO GET IT (takes ~2 minutes):
#   1. Open soundcloud.com in Chrome — make sure you're logged in
#   2. Press Cmd+Option+I  →  click the "Network" tab
#   3. Type  api-v2  in the filter box
#   4. Refresh the page (Cmd+R) — requests will appear in the list
#   5. Click any request in the list
#   6. In the right panel, scroll to "Request Headers"
#   7. Find the line:  authorization: OAuth 2-XXXXXX-XXXXXXXXXX-XXXX...
#   8. Copy everything AFTER "OAuth " (the long alphanumeric string)
#   9. Paste it between the quotes below
#
# The token is valid for weeks. If the script starts getting 401 errors
# later, just grab a fresh one using the same steps.
#
SC_OAUTH_TOKEN = "2-310438-1415890611-FsDNuLBOgfRTh"

# Throttling: pause between every API call
CALL_DELAY     = 1.2   # seconds — conservative but safe

# Retry logic on rate-limit (429) or server errors (5xx)
RETRY_MAX      = 6
RETRY_BACKOFF  = 2.0   # delay multiplier per retry: 10s, 20s, 40s, 80s...

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/122.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json, text/javascript, */*; q=0.01",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": "https://soundcloud.com/",
    "Origin": "https://soundcloud.com",
}

# Extra query params appended to every API call.
# Populated during Step 1 — do not edit manually.
SC_EXTRA = {
    "app_locale": "en",
    # app_version added at runtime
}

# Persistent session — impersonates Chrome's TLS fingerprint so SC's
# bot detection sees a real browser, not a Python script.
if CURL_CFFI:
    SESSION = requests.Session(impersonate="chrome120")
else:
    print("⚠  curl-cffi not found — falling back to requests (may still get 403s).")
    print("   Run:  pip3 install curl-cffi  for best results.")
    SESSION = requests.Session()

SESSION.headers.update(HEADERS)
if SC_OAUTH_TOKEN:
    SESSION.headers["Authorization"] = f"OAuth {SC_OAUTH_TOKEN}"

# ── STEP 1a: LOAD CHROME COOKIES ─────────────────────────────────────────────

def load_chrome_cookies():
    """
    Load SoundCloud cookies directly from your Chrome browser profile.
    Since you're already logged into SC in Chrome, this gives the script
    the same session cookies Chrome uses — bypassing SC's bot detection.
    Chrome does NOT need to be closed.
    """
    try:
        import browser_cookie3
        print("  Loading SoundCloud cookies from Chrome...")
        cookies = browser_cookie3.chrome(domain_name=".soundcloud.com")
        count = 0
        for c in cookies:
            SESSION.cookies.set(c.name, c.value, domain=c.domain, path=getattr(c, "path", "/"))
            count += 1
        if count > 0:
            print(f"  ✓ Loaded {count} cookies from Chrome for soundcloud.com")
            return True
        else:
            print("  ⚠  No SoundCloud cookies found in Chrome — are you logged in there?")
            return False
    except ImportError:
        print("  ❌  browser-cookie3 not installed.")
        print("      Run:  pip3 install browser-cookie3  then try again.")
        sys.exit(1)
    except Exception as e:
        print(f"  ⚠  Could not read Chrome cookies: {e}")
        print("      Try closing Chrome completely and re-running the script.")
        return False


# ── STEP 1b: EXTRACT CLIENT_ID ────────────────────────────────────────────────

def get_client_id():
    """
    Extract SoundCloud's client_id AND app_version from their JavaScript.

    Both are required for API calls to succeed:
    - client_id   : authenticates the request
    - app_version : SC blocks requests that don't include this (returns 403)

    Returns (client_id, app_version). Also populates SC_EXTRA so api_get
    appends app_version + app_locale automatically to every request.
    """
    print("\n[Step 1] Extracting client_id + app_version from SoundCloud...")

    try:
        r = SESSION.get("https://soundcloud.com/", timeout=20)
        r.raise_for_status()
    except Exception as e:
        raise RuntimeError(f"Could not load soundcloud.com: {e}")

    app_version = None
    for av_pattern in [
        r'"app_version"\s*:\s*"?(\d{10,})"?',
        r'window\.__sc_version\s*=\s*"(\d+)"',
        r'app_version=(\d{10,})',
    ]:
        m = re.search(av_pattern, r.text)
        if m:
            app_version = m.group(1)
            break

    scripts = re.findall(
        r'<script[^>]+src="(https://a-v2\.sndcdn\.com/assets/[^"]+\.js)"',
        r.text
    )
    if not scripts:
        scripts = re.findall(r'<script[^>]+src="(https?://[^"]+\.js)"', r.text)
    if not scripts:
        raise RuntimeError(
            "No scripts found on soundcloud.com. SC may have changed their page structure."
        )

    print(f"  Found {len(scripts)} script(s). Searching for client_id + app_version...")

    client_id = None

    for script_url in reversed(scripts[-8:]):
        try:
            time.sleep(0.5)
            rs = SESSION.get(script_url, timeout=20)
            if rs.status_code != 200:
                continue

            if not client_id:
                for pattern in [
                    r'client_id:"([a-zA-Z0-9]{20,})"',
                    r'"client_id","([a-zA-Z0-9]{20,})"',
                    r'client_id=([a-zA-Z0-9]{20,})[^a-zA-Z0-9]',
                ]:
                    m = re.search(pattern, rs.text)
                    if m:
                        client_id = m.group(1)
                        break

            if not app_version:
                for pattern in [
                    r'app_version:"(\d{10,})"',
                    r'"app_version"\s*:\s*"(\d{10,})"',
                    r'app_version=(\d{10,})[^0-9]',
                ]:
                    m = re.search(pattern, rs.text)
                    if m:
                        app_version = m.group(1)
                        break

            if client_id and app_version:
                break

        except Exception:
            continue

    if not client_id:
        raise RuntimeError(
            "Could not extract client_id from SoundCloud's JS.\n"
            "Try again in a few minutes."
        )

    if not app_version:
        app_version = "1741680000"
        print(f"  ⚠  app_version not found — using fallback: {app_version}")

    SC_EXTRA["app_version"] = app_version

    print(f"  ✓ client_id:   {client_id[:8]}...{client_id[-4:]}")
    print(f"  ✓ app_version: {app_version}")
    return client_id, app_version


# ── CORE: API GET WITH RETRY ──────────────────────────────────────────────────

def api_get(url, client_id, attempt=0):
    """
    GET a SoundCloud API URL with:
    - Automatic client_id injection
    - Configurable delay between calls
    - Exponential backoff on rate limits (429) and server errors (5xx)
    - Timeout handling with retry
    """
    if "client_id" not in url:
        sep = "&" if "?" in url else "?"
        url = f"{url}{sep}client_id={client_id}"

    for key, val in SC_EXTRA.items():
        if key not in url:
            url = f"{url}&{key}={val}"

    time.sleep(CALL_DELAY)

    try:
        r = SESSION.get(url, timeout=25)

        if r.status_code == 429:
            wait = (RETRY_BACKOFF ** attempt) * 10
            print(f"  ⚠  Rate limited (429). Waiting {wait:.0f}s... "
                  f"[retry {attempt + 1}/{RETRY_MAX}]")
            time.sleep(wait)
            if attempt < RETRY_MAX:
                return api_get(url, client_id, attempt + 1)
            raise RuntimeError("Hit max retries on rate limit. Try again later.")

        if r.status_code in (500, 502, 503, 504):
            wait = (RETRY_BACKOFF ** attempt) * 5
            print(f"  ⚠  Server error ({r.status_code}). Waiting {wait:.0f}s... "
                  f"[retry {attempt + 1}/{RETRY_MAX}]")
            time.sleep(wait)
            if attempt < RETRY_MAX:
                return api_get(url, client_id, attempt + 1)

        if r.status_code == 401:
            raise RuntimeError(
                "Got 401 Unauthorized — client_id may have expired. "
                "Delete sc_checkpoint.json and re-run to get a fresh one."
            )

        r.raise_for_status()
        return r.json()

    except requests.exceptions.Timeout:
        wait = (RETRY_BACKOFF ** attempt) * 3
        print(f"  ⚠  Timeout. Waiting {wait:.0f}s... [retry {attempt + 1}/{RETRY_MAX}]")
        time.sleep(wait)
        if attempt < RETRY_MAX:
            return api_get(url, client_id, attempt + 1)
        raise

    except requests.exceptions.ConnectionError:
        wait = (RETRY_BACKOFF ** attempt) * 5
        print(f"  ⚠  Connection error. Waiting {wait:.0f}s... [retry {attempt + 1}/{RETRY_MAX}]")
        time.sleep(wait)
        if attempt < RETRY_MAX:
            return api_get(url, client_id, attempt + 1)
        raise


# ── STEP 2: RESOLVE USER ID ───────────────────────────────────────────────────

def resolve_user(client_id, profile_url):
    """
    Converts a profile URL like soundcloud.com/bananasutra
    into the internal numeric user_id that all other API calls need.
    """
    print(f"\n[Step 2] Resolving user ID for {profile_url}...")
    url  = f"https://api-v2.soundcloud.com/resolve?url={profile_url}&client_id={client_id}"
    data = api_get(url, client_id)

    user_id      = data["id"]
    username     = data.get("username", "?")
    track_count  = data.get("track_count", "?")
    followers    = data.get("followers_count", "?")

    print(f"  ✓ Username:  {username}")
    print(f"  ✓ User ID:   {user_id}")
    print(f"  ✓ Tracks:    {track_count}")
    print(f"  ✓ Followers: {followers}")
    return user_id


# ── STEP 3: FETCH ALL TRACKS ──────────────────────────────────────────────────

def fetch_all_tracks(client_id, user_id):
    """
    Fetches every track using a two-phase approach:

    Phase 1 — Page hydration:
        Loads soundcloud.com/bananasutra/tracks as a real web page.
        SC embeds the first batch of tracks as JSON in the page HTML
        (window.__sc_hydration). This also sets the session cookies
        that SC requires before allowing API pagination calls.

    Phase 2 — API pagination:
        Follows the next_href URL from the hydration data to fetch
        subsequent pages via the API (now works because cookies are set).
    """
    print(f"\n[Step 3] Fetching all tracks...")

    username  = SC_PROFILE_URL.rstrip("/").split("/")[-1]
    tracks    = []
    next_href = None

    # ── Phase 0: try direct API first (curl-cffi + cookies + OAuth) ──
    print("  Trying direct API endpoint...")
    direct_url = (
        f"https://api-v2.soundcloud.com/users/{user_id}/tracks"
        f"?representation=&limit=20&linked_partitioning=1&client_id={client_id}"
    )
    try:
        data  = api_get(direct_url, client_id)
        batch = data.get("collection", [])
        if batch is not None:
            print(f"  ✓ Direct API works! Fetching all pages...")
            tracks.extend(batch)
            next_href = data.get("next_href")
            page = 2
            while next_href:
                print(f"  Page {page:2d}  —  {len(tracks)} tracks so far...")
                if "client_id" not in next_href:
                    next_href = f"{next_href}&client_id={client_id}"
                data      = api_get(next_href, client_id)
                tracks.extend(data.get("collection", []))
                next_href = data.get("next_href")
                page     += 1
            print(f"  ✓ Total tracks fetched: {len(tracks)}")
            return tracks
    except Exception as e:
        print(f"  ⚠  Direct API failed ({e}) — trying page hydration...")

    # ── Phase 1: load tracks page with browser-like navigation headers ──
    page_url = f"https://soundcloud.com/{username}/tracks"
    print(f"  Loading {page_url}...")
    r = SESSION.get(
        page_url,
        timeout=25,
        headers={
            "Accept": (
                "text/html,application/xhtml+xml,application/xml;"
                "q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8"
            ),
            "Sec-Fetch-Dest": "document",
            "Sec-Fetch-Mode": "navigate",
            "Sec-Fetch-Site": "none",
            "Sec-Fetch-User": "?1",
            "Cache-Control": "max-age=0",
            "Upgrade-Insecure-Requests": "1",
        }
    )

    if r.status_code != 200:
        raise RuntimeError(f"Could not load tracks page: HTTP {r.status_code}")

    match = re.search(
        r'window\.__sc_hydration\s*=\s*(\[.+?\]);\s*(?:</script>|window\.)',
        r.text, re.DOTALL
    )

    if match:
        try:
            hydration = json.loads(match.group(1))
            for item in hydration:
                if item.get("hydratable") == "userTracks":
                    data      = item.get("data", {})
                    batch     = data.get("collection", [])
                    next_href = data.get("next_href")
                    tracks.extend(batch)
                    print(f"  Got {len(batch)} tracks from page (hydration)")
                    break
        except (json.JSONDecodeError, Exception) as e:
            print(f"  ⚠  Could not parse hydration JSON: {e}")

    if not tracks:
        print("  ⚠  Hydration empty — falling back to direct API...")
        next_href = (
            f"https://api-v2.soundcloud.com/users/{user_id}/tracks"
            f"?representation=&limit=200&linked_partitioning=1"
            f"&client_id={client_id}&app_version={SC_EXTRA.get('app_version','')}"
            f"&app_locale=en"
        )

    page = 2
    while next_href:
        print(f"  Page {page:2d}  —  {len(tracks)} tracks so far...")
        if "client_id" not in next_href:
            next_href = f"{next_href}&client_id={client_id}"
        data      = api_get(next_href, client_id)
        batch     = data.get("collection", [])
        tracks.extend(batch)
        next_href = data.get("next_href")
        page     += 1

    print(f"  ✓ Total tracks fetched: {len(tracks)}")
    return tracks


# ── STEP 3.5: ENRICH PARTIAL METADATA ────────────────────────────────────────

# Fields we copy from the individual /tracks/{id} response when enriching a
# partial bulk-response. Only overwrite if the individual value is truthy,
# so we never stomp on a real value with a missing/empty one.
ENRICH_FIELDS = (
    "created_at",
    "playback_count",
    "likes_count",
    "reposts_count", "repost_count",   # SC has used both names historically
    "comment_count", "comments_count",
    "duration",
    "artwork_url",
    "waveform_url",
    "genre",
    "tag_list",
    "license",
    "bpm",
    "purchase_url",
    "download_url",
    "description",
    "kind",
    "public",
)


def _is_partial_track(t):
    """
    Decide whether a track object looks like it came back partial from the
    bulk /users/{id}/tracks endpoint. Two signals:

      1. No created_at   — the original partial-metadata symptom.
      2. All four activity counters (plays, likes, reposts, comments) are
         exactly zero. A few tracks are legitimately zero — brand-new
         uploads — but the SC bulk endpoint has a known issue where it
         zeroes out these fields for tracks from certain older EPs even
         though the individual endpoint returns real numbers. Re-fetching
         is cheap and idempotent, so false positives cost us one API call
         per actually-zero track, no data damage.
    """
    if not (t.get("created_at") or "").strip():
        return True
    def _i(k):
        try: return int(t.get(k) or 0)
        except (TypeError, ValueError): return 0
    return (_i("playback_count") + _i("likes_count")
            + _i("reposts_count") + _i("repost_count")
            + _i("comment_count") + _i("comments_count")) == 0


def enrich_partial_tracks(tracks, client_id):
    """
    Fix-up pass for tracks where the bulk endpoint returned partial data.

    The /users/{id}/tracks bulk endpoint sometimes returns track objects
    missing created_at, or with all four activity counters zeroed, even
    when the track is public and has real plays/likes. The individual
    /tracks/{id} endpoint reliably returns full metadata.

    This re-fetches any track that looks partial and merges missing fields
    (without stomping on values that are already populated).

    One API call per partial track at CALL_DELAY seconds each. The retry/
    throttle logic is shared with everything else, so it's safe to run.
    """
    partial = [t for t in tracks if _is_partial_track(t)]
    total   = len(partial)

    if total == 0:
        print(f"\n[Step 3.5] All tracks have full metadata — skipping enrichment.")
        return tracks

    no_date = sum(1 for t in partial if not (t.get("created_at") or "").strip())
    zero_metrics = total - no_date
    print(f"\n[Step 3.5] Enriching {total} tracks with partial metadata...")
    print(f"  ({no_date} missing created_at, {zero_metrics} with all-zero activity)")
    print(f"  (~{total} API calls at {CALL_DELAY}s each — "
          f"est. {total * CALL_DELAY / 60:.1f} min)")

    dates_filled = metrics_healed = 0
    for i, t in enumerate(partial):
        tid = t.get("id")
        if not tid:
            continue
        try:
            data = api_get(
                f"https://api-v2.soundcloud.com/tracks/{tid}", client_id
            )
        except Exception as e:
            print(f"  ⚠  Could not enrich track {tid}: {e}")
            continue

        if not (t.get("created_at") or "").strip() and (data.get("created_at") or "").strip():
            dates_filled += 1
        # Snapshot the zero-metric state before we merge, to count heals
        def _sum_activity(obj):
            tot = 0
            for k in ("playback_count", "likes_count", "reposts_count",
                      "repost_count", "comment_count", "comments_count"):
                try: tot += int(obj.get(k) or 0)
                except (TypeError, ValueError): pass
            return tot
        before_activity = _sum_activity(t)

        for k in ENRICH_FIELDS:
            if k not in data:
                continue
            v = data.get(k)
            # Numeric fields: only overwrite if the new value is larger
            # (plays only grow; zero-to-nonzero is the whole point of this
            # enrichment pass)
            if k in ("playback_count", "likes_count", "reposts_count",
                     "repost_count", "comment_count", "comments_count",
                     "duration", "bpm"):
                try:
                    new = int(v or 0)
                    old = int(t.get(k) or 0)
                    if new > old:
                        t[k] = new
                except (TypeError, ValueError):
                    pass
            else:
                # String / other fields: only fill if currently empty
                if not (t.get(k) or "") and v:
                    t[k] = v

        if before_activity == 0 and _sum_activity(t) > 0:
            metrics_healed += 1

        if (i + 1) % 50 == 0:
            print(f"  ...{i+1}/{total} checked  "
                  f"(dates filled: {dates_filled}, metrics healed: {metrics_healed})")

    print(f"  ✓ Dates filled:    {dates_filled}/{no_date}")
    print(f"  ✓ Metrics healed:  {metrics_healed}/{zero_metrics}")
    still_no_date = sum(1 for t in tracks if not (t.get("created_at") or "").strip())
    if still_no_date:
        print(f"  ⚠  {still_no_date} tracks still have no date "
              f"(may be private or deleted on SC)")
    return tracks


# Backward-compat alias: checkpoints written by earlier runs may reference
# this name. Safe to remove in a future version.
enrich_missing_dates = enrich_partial_tracks


# ── STEP 3.6: FETCH USER'S LIKED TRACKS ──────────────────────────────────────

def fetch_user_likes(client_id, user_id):
    """
    Fetch all track IDs the user has liked on SoundCloud.

    Used to add a `user_liked` boolean column to the CSV, so the post-
    processing filter can include liked tracks regardless of play/like count.

    Current filter in build_final_v3.py:
        play_count >= 300 OR like_count >= 5

    With user_liked, the filter becomes:
        play_count >= 300 OR like_count >= 5 OR user_liked == "yes"

    The /users/{id}/likes endpoint returns both tracks and playlists.
    We only collect track IDs.
    """
    print(f"\n[Step 3.6] Fetching user's liked tracks...")
    liked_ids = set()
    url = (
        f"https://api-v2.soundcloud.com/users/{user_id}/likes"
        f"?limit=200&linked_partitioning=1&client_id={client_id}"
    )
    page = 1

    while url:
        try:
            data = api_get(url, client_id)
        except Exception as e:
            print(f"  ⚠  Could not fetch likes page {page}: {e}. Stopping likes fetch.")
            break

        for item in data.get("collection", []):
            # SC wraps likes differently depending on the endpoint version:
            # Format A: item IS the track (has "playback_count" key)
            # Format B: item has a "track" key with the track object
            if "playback_count" in item:
                tid = item.get("id")
            elif isinstance(item.get("track"), dict):
                tid = item["track"].get("id")
            else:
                tid = None
            if tid:
                liked_ids.add(tid)

        url = data.get("next_href")
        if url and "client_id" not in url:
            url = f"{url}&client_id={client_id}"
        page += 1

    print(f"  ✓ {len(liked_ids)} liked tracks found")
    return liked_ids


# ── STEP 4: FETCH ALL PLAYLISTS ───────────────────────────────────────────────

def fetch_all_playlists(client_id, user_id):
    """
    Fetches every playlist ("set") from the account.
    Each playlist object includes its track list (may be partial).
    """
    print(f"\n[Step 4] Fetching all playlists...")
    playlists = []
    url = (
        f"https://api-v2.soundcloud.com/users/{user_id}/playlists"
        f"?limit=50&linked_partitioning=1&client_id={client_id}"
    )
    page = 1

    while url:
        print(f"  Page {page}  —  {len(playlists)} playlists fetched so far...")
        data  = api_get(url, client_id)
        batch = data.get("collection", [])
        playlists.extend(batch)

        url = data.get("next_href")
        if url and "client_id" not in url:
            url = f"{url}&client_id={client_id}"
        page += 1

    print(f"  ✓ Total playlists fetched: {len(playlists)}")
    return playlists


# ── STEP 5: BUILD INVERTED INDEXES (track → EPs and track → playlists) ───────

EP_TYPES = {"ep", "album", "single"}

def is_ep(pl):
    """Return True if this SC set is an EP, album, or single (not a plain playlist)."""
    set_type = (pl.get("set_type") or "").lower().strip()
    is_album = pl.get("is_album", False)
    return set_type in EP_TYPES or is_album


def fetch_full_set(pl_id, client_id):
    """Fetch a playlist/EP by ID to get its full track list."""
    url = f"https://api-v2.soundcloud.com/playlists/{pl_id}?client_id={client_id}"
    data = api_get(url, client_id)
    return data.get("tracks", [])


def get_track_list(pl, client_id):
    """
    Return the track list for a playlist/EP.
    Fetches from API if the inline track list is missing or incomplete.
    """
    pl_id      = pl.get("id")
    track_list = pl.get("tracks", [])

    needs_full_fetch = (
        not track_list or
        (track_list and isinstance(track_list[0], dict) and "id" not in track_list[0])
    )

    if needs_full_fetch:
        try:
            track_list = fetch_full_set(pl_id, client_id)
        except Exception as e:
            print(f"    ⚠  Could not fetch full set data: {e}. Skipping.")
            return []

    return track_list


def write_playlist_art_api_json(playlists, path):
    """Persist playlist/set covers from SC API objects as dual-size URLs for build_sc_final_v4.py."""
    by_name: dict = {}
    by_url: dict = {}
    for pl in playlists:
        title = (pl.get("title") or "Untitled").strip()
        purl = (pl.get("permalink_url") or "").strip()
        raw_art = pl.get("artwork_url") or ""
        sm, lg = sndcdn_artwork_sm_lg(raw_art)
        entry = {"artwork_url": sm, "artwork_lg_url": lg}
        if title:
            by_name[title] = entry
        if purl:
            by_url[purl] = entry
    payload = {"by_name": by_name, "by_url": by_url}
    with open(path, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, ensure_ascii=False)
    print(f"  ✓ Playlist art API manifest: {path}  ({len(by_name)} sets)")


def build_indexes(playlists, client_id):
    """
    Build two inverted indexes from the full playlist/EP list:

    ep_index:
        track_id → {
            "ep_title":        str,
            "ep_url":          str,
            "ep_track_number": int,
            "ep_total_tracks": int,
            "ep_created_at":   str,   ← EP creation timestamp from SC API [NEW]
        }

    playlist_index:
        track_id → [(playlist_name, playlist_url), ...]
    """
    print(f"\n[Step 5] Building track → EP and track → playlist indexes...")

    ep_index       = {}
    playlist_index = {}
    ep_count = 0
    pl_count = 0

    for i, pl in enumerate(playlists):
        pl_name    = pl.get("title", "Untitled")
        pl_url     = pl.get("permalink_url", "")
        pl_count_t = pl.get("track_count", "?")

        label = "EP/Album" if is_ep(pl) else "Playlist"
        print(f"  [{i + 1:3d}/{len(playlists)}]  [{label:8s}]  \"{pl_name}\"  ({pl_count_t} tracks)")

        track_list = get_track_list(pl, client_id)
        if not track_list:
            continue

        total = len(track_list)

        if is_ep(pl):
            ep_count += 1

            # Extract EP-level created_at from the playlist object [NEW]
            ep_created_at = (
                (pl.get("created_at") or "")
                .replace("T", " ").replace("Z", "").strip()
            )

            for pos, track in enumerate(track_list, start=1):
                tid = track.get("id") if isinstance(track, dict) else track
                if not tid:
                    continue
                if tid in ep_index:
                    print(f"    ⚠  Track {tid} already assigned to EP "
                          f"\"{ep_index[tid]['ep_title']}\" — keeping first assignment.")
                    continue
                ep_index[tid] = {
                    "ep_title":        pl_name,
                    "ep_url":          pl_url,
                    "ep_track_number": pos,
                    "ep_total_tracks": total,
                    "ep_created_at":   ep_created_at,   # [NEW]
                }
        else:
            pl_count += 1
            for track in track_list:
                tid = track.get("id") if isinstance(track, dict) else track
                if not tid:
                    continue
                if tid not in playlist_index:
                    playlist_index[tid] = []
                playlist_index[tid].append((pl_name, pl_url))

    pl_memberships = sum(len(v) for v in playlist_index.values())
    print(f"\n  ✓ EPs/Albums processed:  {ep_count}")
    print(f"  ✓ Playlists processed:   {pl_count}")
    print(f"  ✓ Tracks with EP data:   {len(ep_index)}")
    print(f"  ✓ Tracks in playlists:   {len(playlist_index)}  ({pl_memberships} total links)")
    return ep_index, playlist_index


# ── DURATION HELPERS ─────────────────────────────────────────────────────────

def fmt_track(ms):
    """mm:ss for individual tracks (e.g. 3:42)"""
    secs = round((ms or 0) / 1000)
    m, s = divmod(secs, 60)
    return f"{m}:{s:02d}"

def fmt_total(ms):
    """hh:mm:ss for EP / playlist totals (e.g. 1:12:05)"""
    secs = round((ms or 0) / 1000)
    h, rem = divmod(secs, 3600)
    m, s   = divmod(rem, 60)
    return f"{h}:{m:02d}:{s:02d}"


# ── STEP 6: EXPORT TO CSV ─────────────────────────────────────────────────────

def export_csv(tracks, ep_index, playlist_index, liked_ids, output_path):
    """
    Write the final CSV. One row per track.

    New columns vs. previous version:
        user_liked    — "yes" if the authenticated user liked this track
        ep_created_at — the EP's own created_at from the SC playlist object
    """
    print(f"\n[Step 6] Writing CSV...")

    fieldnames = [
        "track_id",
        "title",
        "sc_url",
        "artwork_url",
        "artwork_lg_url",
        "waveform_url",
        "play_count",
        "like_count",
        "repost_count",
        "comment_count",
        "duration",
        "created_at",
        "user_liked",         # [NEW] "yes" if authenticated user liked this track
        "genre",
        "tags",
        "license",
        "track_type",
        "bpm",
        "purchase_url",
        "download_url",
        "description",
        # EP membership
        "ep_title",
        "ep_url",
        "ep_track_number",
        "ep_total_tracks",
        "ep_created_at",      # [NEW] EP's own created_at from SC playlist object
        # Regular playlist membership
        "playlist_count",
        "playlist_names",
        "playlist_urls",
    ]

    with open(output_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()

        for t in tracks:
            tid         = t.get("id")
            ep          = ep_index.get(tid, {})
            memberships = playlist_index.get(tid, [])
            duration_ms = t.get("duration", 0) or 0
            tag_list    = t.get("tag_list", "") or ""

            created = t.get("created_at", "") or ""
            created = created.replace("T", " ").replace("Z", "").strip()

            desc = (t.get("description", "") or "").replace("\n", " ").replace("\r", "").strip()

            raw_art = t.get("artwork_url") or t.get("user", {}).get("avatar_url", "")
            artwork_sm, artwork_lg = sndcdn_artwork_sm_lg(raw_art)

            writer.writerow({
                "track_id":          tid,
                "title":             t.get("title", ""),
                "sc_url":            t.get("permalink_url", ""),
                "artwork_url":       artwork_sm,
                "artwork_lg_url":    artwork_lg,
                "waveform_url":      t.get("waveform_url", "") or "",
                "play_count":        t.get("playback_count", 0) or 0,
                "like_count":        t.get("likes_count", 0) or 0,
                "repost_count":      t.get("reposts_count", 0) or 0,
                "comment_count":     t.get("comment_count", 0) or 0,
                "duration":          fmt_track(duration_ms),
                "created_at":        created,
                "user_liked":        "yes" if tid in liked_ids else "",  # [NEW]
                "genre":             t.get("genre", "") or "",
                "tags":              tag_list,
                "license":           t.get("license", "") or "",
                "track_type":        t.get("track_type", "") or "",
                "bpm":               t.get("bpm", "") or "",
                "purchase_url":      t.get("purchase_url", "") or "",
                "download_url":      t.get("download_url", "") or "",
                "description":       desc,
                "ep_title":          ep.get("ep_title", ""),
                "ep_url":            ep.get("ep_url", ""),
                "ep_track_number":   ep.get("ep_track_number", ""),
                "ep_total_tracks":   ep.get("ep_total_tracks", ""),
                "ep_created_at":     ep.get("ep_created_at", ""),  # [NEW]
                "playlist_count":    len(memberships),
                "playlist_names":    " | ".join(name for name, _   in memberships),
                "playlist_urls":     " | ".join(url  for _,    url in memberships),
            })

    print(f"  ✓ CSV written: {output_path}")
    print(f"  ✓ {len(tracks)} rows")

    in_ep       = sum(1 for t in tracks if t.get("id") in ep_index)
    in_playlist = sum(1 for t in tracks if t.get("id") in playlist_index)
    liked_count = sum(1 for t in tracks if t.get("id") in liked_ids)
    has_date    = sum(1 for t in tracks if (t.get("created_at") or "").strip())
    pct         = 100 * has_date / len(tracks) if tracks else 0

    print(f"  ✓ {in_ep} tracks linked to an EP/Album")
    print(f"  ✓ {len(tracks) - in_ep} tracks with no EP")
    print(f"  ✓ {in_playlist} tracks in at least one playlist")
    print(f"  ✓ {liked_count} tracks marked user_liked=yes")
    print(f"  ✓ created_at coverage: {has_date}/{len(tracks)} ({pct:.0f}%)")


# ── CHECKPOINT HELPERS ────────────────────────────────────────────────────────

def save_checkpoint(data):
    # Sets aren't JSON-serializable — convert liked_ids to list
    if "liked_ids" in data and isinstance(data["liked_ids"], set):
        data = {**data, "liked_ids": list(data["liked_ids"])}
    with open(CHECKPOINT, "w", encoding="utf-8") as f:
        json.dump(data, f)
    print(f"  💾 Progress saved → {CHECKPOINT}  (re-run to resume if interrupted)")

def load_checkpoint():
    if os.path.exists(CHECKPOINT):
        with open(CHECKPOINT, "r", encoding="utf-8") as f:
            return json.load(f)
    return None

def clear_checkpoint():
    if os.path.exists(CHECKPOINT):
        os.remove(CHECKPOINT)


# ── MAIN ──────────────────────────────────────────────────────────────────────

def main():
    print("=" * 60)
    print("  BananaSutra — SoundCloud Full Export")
    print(f"  {datetime.now().strftime('%Y-%m-%d  %H:%M')}")
    print("=" * 60)

    load_chrome_cookies()

    if not SC_OAUTH_TOKEN:
        print("\n❌  SC_OAUTH_TOKEN is not set.")
        print("    Open bananasutra_sc_export.py in a text editor,")
        print("    find the SC_OAUTH_TOKEN line near the top, and")
        print("    paste your token between the quotes.")
        print("\n    See the instructions in the CONFIG section for")
        print("    how to copy the token from Chrome DevTools.")
        sys.exit(1)

    checkpoint  = load_checkpoint()
    client_id   = None
    user_id     = None
    tracks      = None
    playlists   = None
    liked_ids   = None

    if checkpoint:
        ts = checkpoint.get("timestamp", "unknown time")
        print(f"\n⚡ Checkpoint found (saved at {ts})")
        answer = input("   Resume from checkpoint? [y/n]: ").strip().lower()
        if answer == "y":
            client_id   = checkpoint.get("client_id")
            user_id     = checkpoint.get("user_id")
            tracks      = checkpoint.get("tracks")
            playlists   = checkpoint.get("playlists")
            app_version = checkpoint.get("app_version")
            # liked_ids stored as list in JSON — restore as set
            liked_raw   = checkpoint.get("liked_ids")
            liked_ids   = set(liked_raw) if liked_raw is not None else None
            if app_version:
                SC_EXTRA["app_version"] = app_version
            print("  Loaded checkpoint data.")
        else:
            print("  Starting fresh.")

    # ── Step 1: client_id + app_version ──
    if not client_id:
        client_id, app_version = get_client_id()
    else:
        app_version = SC_EXTRA.get("app_version", "unknown")

    # ── Step 2: user_id ──
    if not user_id:
        user_id = resolve_user(client_id, SC_PROFILE_URL)

    # ── Step 3: tracks ──
    if not tracks:
        tracks = fetch_all_tracks(client_id, user_id)

        # ── Step 3.5: enrich missing created_at via individual track calls ──
        tracks = enrich_missing_dates(tracks, client_id)

        save_checkpoint({
            "timestamp":   datetime.now().isoformat(),
            "client_id":   client_id,
            "app_version": app_version,
            "user_id":     user_id,
            "tracks":      tracks,
            "playlists":   None,
            "liked_ids":   None,
        })
    else:
        print(f"\n[Step 3] ✓ Using {len(tracks)} tracks from checkpoint")
        # Run enrichment if checkpoint has partial tracks (missing date OR
        # zeroed activity counters — the latter is the newer symptom we hunt).
        partial_count = sum(1 for t in tracks if _is_partial_track(t))
        if partial_count > 0:
            print(f"  Checkpoint has {partial_count} partial tracks — enriching...")
            tracks = enrich_partial_tracks(tracks, client_id)

    # ── Step 3.6: liked tracks ──
    if liked_ids is None:
        liked_ids = fetch_user_likes(client_id, user_id)
        save_checkpoint({
            "timestamp":   datetime.now().isoformat(),
            "client_id":   client_id,
            "app_version": app_version,
            "user_id":     user_id,
            "tracks":      tracks,
            "playlists":   None,
            "liked_ids":   liked_ids,
        })
    else:
        print(f"\n[Step 3.6] ✓ Using {len(liked_ids)} liked track IDs from checkpoint")

    # ── Step 4: playlists ──
    if not playlists:
        playlists = fetch_all_playlists(client_id, user_id)
        save_checkpoint({
            "timestamp":   datetime.now().isoformat(),
            "client_id":   client_id,
            "app_version": app_version,
            "user_id":     user_id,
            "tracks":      tracks,
            "playlists":   playlists,
            "liked_ids":   liked_ids,
        })
    else:
        print(f"\n[Step 4] ✓ Using {len(playlists)} playlists from checkpoint")

    # ── Step 5: inverted indexes ──
    ep_index, playlist_index = build_indexes(playlists, client_id)

    write_playlist_art_api_json(playlists, OUTPUT_PLAYLIST_ART_API)

    # ── Step 6: CSV export ──
    export_csv(tracks, ep_index, playlist_index, liked_ids, OUTPUT_CSV)

    # Archival fingerprint: drop a dated sibling next to OUTPUT_CSV so every
    # scrape leaves a permanent record. Matches the dated-copy convention
    # used by build_sc_final_v4.py (e.g. AT-TRACKS-2026-04-18.csv).
    base, ext = os.path.splitext(OUTPUT_CSV)
    dated_path = f"{base}-{date.today().isoformat()}{ext}"
    shutil.copy2(OUTPUT_CSV, dated_path)
    print(f"  + dated copy: {dated_path}")

    clear_checkpoint()
    print("\n" + "=" * 60)
    print("  ✅  COMPLETE")
    print(f"  Open: {OUTPUT_CSV}")
    print(f"  Dated archive: {dated_path}")
    print("=" * 60)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n⚠  Interrupted by user.")
        print("   A checkpoint was saved — re-run the script and choose 'y' to resume.")
        sys.exit(0)
    except Exception as e:
        print(f"\n\n❌  Error: {e}")
        print("   If a checkpoint exists, re-run and choose 'y' to resume from where it stopped.")
        sys.exit(1)
