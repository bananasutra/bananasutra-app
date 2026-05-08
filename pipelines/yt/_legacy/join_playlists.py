"""
join_playlists.py
Fills playlist_id, playlist_url, thumbnail_url into AT-YT-PLAYLISTS using:
  - yt_playlists_raw.csv   (output of 1_extract.py — raw API titles + IDs)
  - name_mapping.csv       (raw API title → your cleaned name)
  - AT-YT-PLAYLISTS-v1.csv (your playlist table with descriptions)

Output:
  AT-YT-PLAYLISTS-v2.csv  — same as v1 but with playlist_id, playlist_url, thumbnail_url filled

Run from the yt-pipeline folder:
  python3 join_playlists.py
"""

import csv, os

SCRIPT_DIR   = os.path.dirname(os.path.abspath(__file__))
RAW_FILE     = os.path.join(SCRIPT_DIR, "yt_playlists_raw.csv")
MAPPING_FILE = os.path.join(SCRIPT_DIR, "name_mapping.csv")
# Paths updated 2026-04-17: script moved from AIRTABLE/YOUTUBE/yt-pipeline/ to pipelines/yt/.
# Old refs used ../../../ (project root) but target CSVs actually live in AIRTABLE/YOUTUBE/yt-archived/.
PLAYLISTS_IN = os.path.join(SCRIPT_DIR, "..", "..", "AIRTABLE", "YOUTUBE", "yt-archived", "AT-YT-PLAYLISTS-v2.csv")
PLAYLISTS_OUT= os.path.join(SCRIPT_DIR, "..", "..", "AIRTABLE", "YOUTUBE", "yt-archived", "AT-YT-PLAYLISTS-v3.csv")

# Resolve paths
PLAYLISTS_IN  = os.path.normpath(PLAYLISTS_IN)
PLAYLISTS_OUT = os.path.normpath(PLAYLISTS_OUT)

# Load raw API playlist data: raw_title -> {playlist_id, playlist_url, thumbnail_url}
with open(RAW_FILE, "r", encoding="utf-8-sig") as f:
    raw_rows = list(csv.DictReader(f))

raw_by_title = {r["raw_title"]: r for r in raw_rows}
print(f"Raw playlists loaded: {len(raw_by_title)}")
print("Raw titles from API:")
for t in sorted(raw_by_title.keys()):
    print(f"  {repr(t)}")

# Load name mapping: raw_yt_title -> cleaned_name (and reverse)
with open(MAPPING_FILE, "r", encoding="utf-8-sig") as f:
    mapping_rows = list(csv.DictReader(f))

# Build: cleaned_name -> raw API data (via the mapping)
cleaned_to_raw = {}
for m in mapping_rows:
    raw_title   = m["raw_yt_title"].strip()
    cleaned     = m["cleaned_name"].strip()
    if not cleaned:
        continue
    api_data = raw_by_title.get(raw_title)
    if api_data:
        # If multiple raw titles map to same cleaned name (e.g. GOD Questions split),
        # take the first match (the real playlist, not the Etc...) fragment)
        if cleaned not in cleaned_to_raw:
            cleaned_to_raw[cleaned] = api_data
    else:
        # Raw title in mapping not found in this extract — playlist may be new/renamed
        print(f"  WARNING: '{raw_title}' not found in yt_playlists_raw.csv (may be new/renamed)")

print(f"Cleaned names resolvable: {len(cleaned_to_raw)}")

# Load AT-YT-PLAYLISTS-v1.csv and fill in the missing columns
with open(PLAYLISTS_IN, "r", encoding="utf-8-sig") as f:
    reader = csv.DictReader(f)
    pl_headers = reader.fieldnames
    pl_rows = list(reader)

filled = 0
not_found = []
for r in pl_rows:
    name = r.get("playlist_name", "").strip()
    api_data = cleaned_to_raw.get(name)
    if api_data:
        r["playlist_id"]   = api_data.get("playlist_id", "")
        r["playlist_url"]  = api_data.get("playlist_url", "")
        r["thumbnail_url"] = api_data.get("thumbnail_url", "")
        filled += 1
    else:
        not_found.append(name)

with open(PLAYLISTS_OUT, "w", encoding="utf-8", newline="") as f:
    writer = csv.DictWriter(f, fieldnames=pl_headers)
    writer.writeheader()
    writer.writerows(pl_rows)

print(f"\nDone!")
print(f"  Playlists filled : {filled} / {len(pl_rows)}")
print(f"  Output           : {PLAYLISTS_OUT}")

if not_found:
    print(f"\n  Could not match {len(not_found)} playlist(s) — add to name_mapping.csv if needed:")
    for n in not_found:
        print(f"    '{n}'")
else:
    print(f"\n  All playlists matched successfully.")
