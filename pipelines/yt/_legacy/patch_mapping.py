"""
patch_mapping.py
Fixes the 6 broken entries in name_mapping.csv without touching working ones.
Run once from the yt-pipeline folder, then delete this file.
"""
import csv, os

SCRIPT_DIR   = os.path.dirname(os.path.abspath(__file__))
MAPPING_FILE = os.path.join(SCRIPT_DIR, "name_mapping.csv")
RAW_FILE     = os.path.join(SCRIPT_DIR, "yt_playlists_raw.csv")

# Load the raw API titles so we can find exact strings by keyword
with open(RAW_FILE, "r", encoding="utf-8-sig") as f:
    raw_rows = list(csv.DictReader(f))

raw_titles = {r["raw_title"]: r for r in raw_rows}

# Find the exact raw strings we need by keyword (avoids encoding guesswork)
def find_raw(keyword):
    matches = [t for t in raw_titles if keyword.lower() in t.lower()]
    return matches[0] if len(matches) == 1 else (matches if matches else None)

unavailable_raw = find_raw("UNAVAILABLE")
god_raw         = find_raw("GOD (Questions")
rock_raw        = find_raw("ROCK")
piano_raw       = find_raw("\u0584\u0268\u01df\u057c")   # Armenian chars from API

print("Resolved raw titles:")
print(f"  UNAVAILABLE : {repr(unavailable_raw)}")
print(f"  GOD         : {repr(god_raw)}")
print(f"  ROCK        : {repr(rock_raw)}")
print(f"  PIANO       : {repr(piano_raw)}")

# Load existing mapping
with open(MAPPING_FILE, "r", encoding="utf-8-sig") as f:
    rows = list(csv.DictReader(f))

# Build a dict we can patch: raw_title -> cleaned_name
mapping = {}
for r in rows:
    mapping[r["raw_yt_title"]] = r["cleaned_name"]

# Apply patches
patches = {}

# 1. UNAVAILABLE — re-key to exact API string, cleaned name keeps our display version
if unavailable_raw:
    old_unavail = [k for k in mapping if "UNAVAILABLE" in k]
    for old in old_unavail:
        del mapping[old]
    mapping[unavailable_raw] = '\u201cUNAVAILABLE\u201d Content said YouTube Music\u2026 Who knew? Not me!'
    patches["UNAVAILABLE"] = "fixed"

# 2. GROWsutra GOD — replace fragment with full title
if god_raw:
    old_god = [k for k in mapping if "GOD (Questions" in k]
    for old in old_god:
        del mapping[old]
    mapping[god_raw] = "GROWsutra : GOD (Questions Etc...)"
    patches["GOD"] = "fixed"

# 3. ROCK — update cleaned_name to ROCKsutra
if rock_raw and rock_raw in mapping:
    mapping[rock_raw] = "ROCKsutra"
    patches["ROCK"] = "fixed"

# 4. PIANO — update cleaned_name to PIANOsutra (using exact API string)
if piano_raw and piano_raw in mapping:
    mapping[piano_raw] = "PIANOsutra"
    patches["PIANO"] = "fixed"

# 5. GLOWsutra — update cleaned_name from '6 : GLOWsutra' to 'GLOWsutra'
glow_raw = find_raw("6 : GLOWsutra")
if glow_raw and glow_raw in mapping:
    mapping[glow_raw] = "GLOWsutra"
    patches["GLOW"] = "fixed"

# 6. MA❔A Saga — update both MA entries to unified cleaned name
for raw_key in list(mapping.keys()):
    if "MA" in raw_key and ("Saga" in raw_key or "dream" in raw_key or "MA_A" in raw_key):
        mapping[raw_key] = "BLOWsutra : MA\u2754A Saga"
        patches["MA"] = "fixed"

print(f"\nPatches applied: {patches}")

# Write updated mapping
with open(MAPPING_FILE, "w", encoding="utf-8", newline="") as f:
    writer = csv.writer(f)
    writer.writerow(["raw_yt_title", "cleaned_name"])
    for raw, cleaned in mapping.items():
        writer.writerow([raw, cleaned])

print(f"Saved {len(mapping)} rows to name_mapping.csv")
print("\nNow run:  python3 join_playlists.py")
