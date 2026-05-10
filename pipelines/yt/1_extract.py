"""
1_extract.py  —  v3
YouTube channel -> enriched CSV ready for lyrics_id matching + Airtable import

What this fetches:
  - All videos via uploads playlist (paginated)
  - Full metadata: title, dates, counts, description, tags, thumbnails, duration
  - Playlist membership (which channel playlists each video belongs to)
  - Caption flag (has_captions boolean)
  - Privacy status, embeddable, license, made_for_kids
  - YouTube topic categories
  - Smart pre-fill: sutra, content_type, language, series_info

Run:
  pip install requests python-dotenv
  python3 1_extract.py

Output (all under pipelines/yt/raw/):
  yt_videos_raw.csv      — full enriched CSV, lyrics_id column left blank
                           playlist_names uses cleaned names via name_mapping.csv
  yt_playlists_raw.csv   — all channel playlists with id, raw_title, url, thumbnail, count
  yt_raw_backup.json     — raw API response backup

Missing a new upload in yt_videos_raw.csv?
  • Re-run this script after the video is **Public** (scheduled/premiere/private/draft
    often do not appear with an API key alone — use OAuth as the channel owner if needed).
  • Confirm the video is listed under the channel’s **Uploads** tab on YouTube (not only
    inside a playlist if it were somehow omitted from uploads — rare).
  • Watch terminal output for **Batch error** during Step 4 or **WARNING** after Step 4:
    any batch failure used to skip all later batches (now retried via continue + gap report).
"""

import os, re, csv, json, time, requests
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

API_KEY         = os.getenv("YOUTUBE_API_KEY")
CHANNEL_ID      = os.getenv("YOUTUBE_CHANNEL_ID")
BASE            = "https://www.googleapis.com/youtube/v3"

SCRIPT_DIR      = Path(__file__).resolve().parent
RAW_DIR         = SCRIPT_DIR / "raw"
RAW_DIR.mkdir(parents=True, exist_ok=True)
NAME_MAP_FILE   = SCRIPT_DIR / "name_mapping.csv"

OUT_FILE        = str(RAW_DIR / "yt_videos_raw.csv")
PLAYLISTS_FILE  = str(RAW_DIR / "yt_playlists_raw.csv")
BACKUP_FILE     = str(RAW_DIR / "yt_raw_backup.json")

# Load raw-title → cleaned-name map so playlist_names in yt_videos_raw.csv is
# emitted in the canonical form that AT-PLAYLISTS-final.csv uses. Keeps VIDEOS
# and PLAYLISTS tables in sync without needing a post-pass.
PLAYLIST_NAME_MAP = {}
if NAME_MAP_FILE.exists():
    with open(NAME_MAP_FILE, encoding="utf-8-sig") as _f:
        PLAYLIST_NAME_MAP = {
            r["raw_yt_title"]: r["cleaned_name"]
            for r in csv.DictReader(_f)
            if r.get("raw_yt_title") and r.get("cleaned_name")
        }

if not API_KEY or not CHANNEL_ID:
    print("ERROR: Missing YOUTUBE_API_KEY or YOUTUBE_CHANNEL_ID in .env")
    exit(1)

# ── SUTRA DETECTION ──────────────────────────────────────────────────────────
SUTRA_PATTERNS = [
    "KNOWsutra","BLOWsutra","SHOWsutra","GROWsutra",
    "FLOWsutra","GLOWsutra","BOWsutra","QUACKsutra",
    "BANJOsutra","LOFIsutra","BURLESQUEsutra","DUBsutra",
    "WORLDsutra","MUSEsutra",
]

FRENCH_RE = re.compile(
    r"\b(le|la|les|un|une|des|du|de|je|tu|il|elle|nous|vous|ils|elles"
    r"|mon|ma|mes|son|sa|ses|leur|leurs|cette|cet|ces"
    r"|est|sont|french|fran.ais|fran.aise)\b",
    re.IGNORECASE
)

def detect_sutras(title, description=""):
    text = title + " " + (description or "")
    found = [s for s in SUTRA_PATTERNS if s.lower() in text.lower()]
    for c in re.findall(r"[A-Z]+\+[A-Z]+sutra", title, re.IGNORECASE):
        if c.upper() not in found:
            found.append(c.upper())
    return found

def detect_confidence(title, sutras):
    if not sutras: return "None"
    for s in sutras:
        if s.lower() in title.lower(): return "High"
    return "Low"

def detect_content_type(title, duration_sec):
    t = title.lower()
    if re.search(r"epx?\s*\d+", t, re.IGNORECASE): return "EP Compilation"
    if re.search(r"\(\d+/\d+\)|\b\d+/\d+\b", title): return "Part-of-Series"
    if duration_sec and duration_sec < 90: return "Short/Reel"
    if any(s.lower() in t for s in SUTRA_PATTERNS): return "Music Video"
    return "Commentary"

def detect_language(title, description=""):
    text = title + " " + (description or "")
    if FRENCH_RE.search(text):
        if re.search(r"\b(the|and|for|with|you|this|are|is)\b", text, re.IGNORECASE):
            return "Bilingual"
        return "French"
    return "English"

def detect_series_info(title):
    m = re.search(r"EP\s?x?\s?(\d+)", title, re.IGNORECASE)
    if m: return f"EPx{m.group(1)}"
    m = re.search(r"\((\d+/\d+)\)|(\d+/\d+)", title)
    if m: return m.group(1) or m.group(2)
    m = re.search(r"VOL\.?\s*(\d+)", title, re.IGNORECASE)
    if m: return f"Vol.{m.group(1)}"
    return ""

def parse_duration(iso):
    if not iso: return ""
    m = re.match(r"PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?", iso)
    if not m: return iso
    h, mins, secs = int(m.group(1) or 0), int(m.group(2) or 0), int(m.group(3) or 0)
    if h: return f"{h}:{mins:02d}:{secs:02d}"
    return f"{mins}:{secs:02d}"

def duration_seconds(iso):
    if not iso: return None
    m = re.match(r"PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?", iso)
    if not m: return None
    return int(m.group(1) or 0)*3600 + int(m.group(2) or 0)*60 + int(m.group(3) or 0)

def best_thumbnail(thumbs):
    for res in ["maxres","standard","high","medium","default"]:
        if res in thumbs: return thumbs[res]["url"]
    return ""

def paginate(endpoint, params):
    """Yield all items across paginated API responses."""
    token = None
    while True:
        p = dict(params)
        if token: p["pageToken"] = token
        r = requests.get(f"{BASE}/{endpoint}", params=p)
        data = r.json()
        if "error" in data:
            print(f"  API error: {data['error']['message']}")
            break
        for item in data.get("items", []):
            yield item
        token = data.get("nextPageToken")
        if not token: break
        time.sleep(0.1)

# ── STEP 1: channel info + uploads playlist ───────────────────────────────────
print("Step 1: Channel info...")
r = requests.get(f"{BASE}/channels", params={
    "part": "contentDetails,snippet", "id": CHANNEL_ID, "key": API_KEY
})
ch = r.json()
if "error" in ch:
    print("ERROR:", ch["error"]["message"]); exit(1)
ch_item = ch["items"][0]
uploads_id   = ch_item["contentDetails"]["relatedPlaylists"]["uploads"]
channel_name = ch_item["snippet"]["title"]
print(f"  Channel: {channel_name}  |  Uploads: {uploads_id}")

# ── STEP 2: all channel playlists -> video membership map ─────────────────────
print("\nStep 2: Building playlist membership map...")
playlist_map = {}   # video_id -> [playlist_title, ...]
playlist_index = [] # [{id, title, url}, ...]

for pl in paginate("playlists", {
    "part":"snippet,contentDetails", "channelId":CHANNEL_ID, "maxResults":50, "key":API_KEY
}):
    pl_id    = pl["id"]
    pl_title = pl["snippet"]["title"]
    pl_url   = f"https://www.youtube.com/playlist?list={pl_id}"
    pl_thumb = best_thumbnail(pl["snippet"].get("thumbnails", {}))
    pl_count = pl.get("contentDetails", {}).get("itemCount", "")
    playlist_index.append({
        "playlist_id":    pl_id,
        "raw_title":      pl_title,
        "playlist_url":   pl_url,
        "thumbnail_url":  pl_thumb,
        "item_count":     pl_count,
    })
    for item in paginate("playlistItems", {
        "part":"contentDetails","playlistId":pl_id,"maxResults":50,"key":API_KEY
    }):
        vid = item["contentDetails"]["videoId"]
        playlist_map.setdefault(vid, [])
        if pl_title not in playlist_map[vid]:
            playlist_map[vid].append(pl_title)
    print(f"  Playlist: {pl_title[:55]}  ({len(playlist_map)} videos mapped so far)")

print(f"  Total playlists: {len(playlist_index)} | Videos with playlist: {len(playlist_map)}")

# Write playlist metadata CSV
pl_fields = ["playlist_id", "raw_title", "playlist_url", "thumbnail_url", "item_count"]
with open(PLAYLISTS_FILE, "w", encoding="utf-8", newline="") as f:
    w = csv.DictWriter(f, fieldnames=pl_fields)
    w.writeheader()
    w.writerows(playlist_index)
print(f"  Playlist metadata saved: {PLAYLISTS_FILE}")

# ── STEP 3: all video IDs from uploads ───────────────────────────────────────
print("\nStep 3: Collecting all video IDs...")
video_ids = [
    item["contentDetails"]["videoId"]
    for item in paginate("playlistItems", {
        "part":"contentDetails","playlistId":uploads_id,"maxResults":50,"key":API_KEY
    })
]
print(f"  Total videos: {len(video_ids)}")

# ── STEP 4: batch enrich (50 at a time) ──────────────────────────────────────
print("\nStep 4: Enriching metadata...")
raw_videos = []
batch_errors = []
for i in range(0, len(video_ids), 50):
    batch = video_ids[i:i+50]
    r = requests.get(f"{BASE}/videos", params={
        "part": "snippet,contentDetails,statistics,status,topicDetails",
        "id":   ",".join(batch),
        "key":  API_KEY
    })
    data = r.json()
    if "error" in data:
        msg = data["error"].get("message", str(data["error"]))
        print(f"  Batch error at offset {i} (videos.list): {msg}")
        batch_errors.append((i, msg))
        time.sleep(0.5)
        continue
    items = data.get("items", [])
    raw_videos.extend(items)
    if len(items) < len(batch):
        got = {it["id"] for it in items}
        missing_in_batch = [vid for vid in batch if vid not in got]
        print(f"  ⚠  Batch at {i}: API returned {len(items)}/{len(batch)} rows "
              f"(dropped IDs may be deleted/private/inaccessible): {missing_in_batch[:5]}"
              f"{'…' if len(missing_in_batch) > 5 else ''}")
    print(f"  Enriched {len(raw_videos)}/{len(video_ids)}...")
    time.sleep(0.1)

fetched_ids = {v["id"] for v in raw_videos}
missing_ids = [vid for vid in video_ids if vid not in fetched_ids]
if missing_ids:
    print(f"\n  ⚠  WARNING: {len(missing_ids)} upload playlist ID(s) never appeared in "
          f"videos.list output (quota/errors/partials above). Example IDs: {missing_ids[:8]}")
if batch_errors:
    print(f"\n  ⚠  {len(batch_errors)} batch(es) failed — fix quota/API errors and re-run")

with open(BACKUP_FILE,"w",encoding="utf-8") as f:
    json.dump(raw_videos, f, ensure_ascii=False, indent=2)
print(f"  Raw backup saved: {BACKUP_FILE}")

# ── STEP 5: process + pre-fill ───────────────────────────────────────────────
print("\nStep 5: Pre-fill pass...")
rows = []
no_sutra = 0

for v in raw_videos:
    vid_id  = v["id"]
    sn      = v.get("snippet",{})
    cd      = v.get("contentDetails",{})
    st      = v.get("statistics",{})
    status  = v.get("status",{})
    topics  = v.get("topicDetails",{})

    title   = sn.get("title","")
    desc    = sn.get("description","")
    pub     = sn.get("publishedAt","")[:10]
    iso_dur = cd.get("duration","")
    thumbs  = sn.get("thumbnails",{})
    yt_tags = sn.get("tags",[])

    # topic categories: strip Wikipedia URLs to readable labels
    raw_topics = topics.get("topicCategories",[])
    topic_labels = []
    for url in raw_topics:
        label = url.split("/")[-1].replace("_"," ")
        topic_labels.append(label)

    dur_str  = parse_duration(iso_dur)
    dur_secs = duration_seconds(iso_dur)
    sutras   = detect_sutras(title, desc)
    if not sutras: no_sutra += 1

    pl_titles = playlist_map.get(vid_id, [])
    # Map raw YouTube playlist titles to the cleaned names used by AT-PLAYLISTS
    pl_titles_clean = [PLAYLIST_NAME_MAP.get(t, t) for t in pl_titles]

    rows.append({
        "video_id":            vid_id,
        "title":               title,
        "yt_url":              f"https://www.youtube.com/watch?v={vid_id}",
        "publish_date":        pub,
        "duration":            dur_str,
        "view_count":          st.get("viewCount",""),
        "like_count":          st.get("likeCount",""),
        "comment_count":       st.get("commentCount",""),
        "thumbnail_url":       best_thumbnail(thumbs),
        "description":         desc,
        "yt_tags":             ", ".join(yt_tags),
        "sutra":               ", ".join(sutras),
        "category_confidence": detect_confidence(title, sutras),
        "content_type":        detect_content_type(title, dur_secs),
        "series_info":         detect_series_info(title),
        "language":            detect_language(title, desc),
        "playlist_names":      ", ".join(pl_titles_clean),
        "playlist_count":      str(len(pl_titles_clean)),
        "has_captions":        str(cd.get("caption","false")).upper(),
        "privacy_status":      status.get("privacyStatus",""),
        "embeddable":          str(status.get("embeddable",True)).upper(),
        "license":             status.get("license",""),
        "made_for_kids":       str(status.get("madeForKids",False)).upper(),
        "topic_categories":    ", ".join(topic_labels),
        "lyrics_id":           "",
        "status":              "New",
        "ytvideo_in_app":      "FALSE",
        "notes":               "",
    })

# ── STEP 6: write CSV ─────────────────────────────────────────────────────────
FIELDS = [
    "video_id","title","yt_url","publish_date","duration",
    "view_count","like_count","comment_count","thumbnail_url",
    "description","yt_tags",
    "sutra","category_confidence","content_type","series_info","language",
    "playlist_names","playlist_count",
    "has_captions","privacy_status","embeddable","license","made_for_kids",
    "topic_categories",
    "lyrics_id","status","ytvideo_in_app","notes",
]

with open(OUT_FILE,"w",encoding="utf-8",newline="") as f:
    w = csv.DictWriter(f, fieldnames=FIELDS)
    w.writeheader()
    w.writerows(rows)

print(f"\nDone!")
print(f"  Total rows:           {len(rows)}")
print(f"  With sutra detected:  {len(rows)-no_sutra}")
print(f"  No sutra (review):    {no_sutra}")
print(f"  Videos output:        {OUT_FILE}")
print(f"  Playlists output:     {PLAYLISTS_FILE}  ({len(playlist_index)} playlists)")
print(f"\n  Next steps:")
print(f"    python3 build_yt_final.py          # reconcile VIDEOS")
print(f"    python3 build_playlists_final.py   # publish PLAYLISTS")
