"""
fix_piano.py — one-time fix for the PIANOsutra mapping entry.
Removes the stale entry with Latin œ, adds correct one with Armenian օ.
"""
import csv, os

SCRIPT_DIR   = os.path.dirname(os.path.abspath(__file__))
MAPPING_FILE = os.path.join(SCRIPT_DIR, "name_mapping.csv")
RAW_FILE     = os.path.join(SCRIPT_DIR, "yt_playlists_raw.csv")

# Get the exact piano raw title from the API output
with open(RAW_FILE, "r", encoding="utf-8-sig") as f:
    raw_rows = list(csv.DictReader(f))

piano_raw = next(
    (r["raw_title"] for r in raw_rows
     if "\u0584\u0268\u01df\u057c" in r["raw_title"]),   # Armenian chars
    None
)
print(f"Piano raw title from API: {repr(piano_raw)}")

# Read mapping, drop ALL piano-related entries (both old and new), add correct one
with open(MAPPING_FILE, "r", encoding="utf-8-sig") as f:
    rows = list(csv.DictReader(f))

# Keep everything except piano entries
filtered = [r for r in rows if "\u0584" not in r["raw_yt_title"] and "\u0153" not in r["raw_yt_title"]]
print(f"Removed {len(rows) - len(filtered)} stale piano entries")

# Add the correct one
if piano_raw:
    filtered.append({"raw_yt_title": piano_raw, "cleaned_name": "PIANOsutra"})
    print(f"Added: {repr(piano_raw)} → PIANOsutra")

with open(MAPPING_FILE, "w", encoding="utf-8", newline="") as f:
    writer = csv.writer(f)
    writer.writerow(["raw_yt_title", "cleaned_name"])
    for r in filtered:
        writer.writerow([r["raw_yt_title"], r["cleaned_name"]])

print(f"Saved {len(filtered)} rows. Now run: python3 join_playlists.py")
