"""
yt_audit.py
Audit YT VIDEOS snapshot for lyrics_id integrity and alignment with LYRICS.

Checks:
  1. Empty lyrics_id rows (expected for Commentary / Short-Reel content)
  2. Invalid lyrics_id (points to an L-N that doesn't exist in LYRICS)
  3. Title mismatches (YT lyrics_title vs LYRICS song_title)
  4. Sutra mismatches (YT sutra vs LYRICS SUTRA -- LYRICS is the source of truth;
     `build_yt_final.py` enforces parity on every build, so mismatches here
     only indicate the snapshot was exported BEFORE the last build was imported)

Usage:
  python3 pipelines/yt/yt_audit.py
  python3 pipelines/yt/yt_audit.py --snapshot 2026-04-17

Auto-picks the latest AIRTABLE/snapshots/ folder if --snapshot is not given.
Expects YTvideos-YYYY-MM-DD.csv and SONGS (Lyrics)-YYYY-MM-DD.csv in that folder.
"""
import csv
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
SNAPSHOTS_ROOT = REPO_ROOT / "AIRTABLE" / "snapshots"

SUTRA_TOKENS = ['KNOW', 'BLOW', 'SHOW', 'GROW', 'FLOW', 'GLOW', 'BOW', 'QUACK']


def normlid(v):
    v = (v or '').strip()
    if v.startswith('L-'):
        try:
            return f"L-{int(v[2:])}"
        except ValueError:
            return v
    return v


def load(path):
    with open(path, encoding='utf-8-sig') as f:
        return [{k.lstrip('\ufeff'): v for k, v in r.items()}
                for r in csv.DictReader(f)]


def find_sutras_in_text(text):
    t = text.upper()
    return sorted({f'{s}sutra' for s in SUTRA_TOKENS
                   if re.search(rf'\b{s}SUTRA\b', t)})


def pick_snapshot(arg):
    """Return the snapshot folder to audit."""
    if arg:
        p = SNAPSHOTS_ROOT / arg
        if not p.is_dir():
            print(f"ERROR: {p} not found")
            sys.exit(1)
        return p
    dated = sorted(
        p for p in SNAPSHOTS_ROOT.iterdir()
        if p.is_dir() and re.match(r"^\d{4}-\d{2}-\d{2}$", p.name)
    )
    if not dated:
        print(f"ERROR: no dated snapshot folders in {SNAPSHOTS_ROOT}")
        sys.exit(1)
    return dated[-1]


def pick_file(folder, prefix):
    """Return the single file in folder starting with prefix, or None."""
    matches = sorted(folder.glob(f"{prefix}*.csv"))
    return matches[0] if matches else None


def main():
    arg = sys.argv[1].replace("--snapshot=", "").replace("--snapshot", "") \
        if len(sys.argv) > 1 and sys.argv[1].startswith("--snapshot") else None
    if len(sys.argv) > 2 and sys.argv[1] == "--snapshot":
        arg = sys.argv[2]

    snap = pick_snapshot(arg)
    print(f"Auditing snapshot: {snap.name}")

    yt_file = pick_file(snap, "YTvideos-")
    ly_file = pick_file(snap, "SONGS (Lyrics)-")
    if not yt_file or not ly_file:
        print(f"ERROR: missing YTvideos-*.csv or SONGS (Lyrics)-*.csv in {snap}")
        sys.exit(1)

    yt = load(yt_file)
    lyrics = load(ly_file)
    lyrics_idx = {normlid(r['lyrics_id']): r for r in lyrics if r.get('lyrics_id')}

    print(f"YT videos (total):     {len(yt)}")
    print(f"LYRICS entries:        {len(lyrics)} ({len(lyrics_idx)} with lyrics_id)")

    empty, invalid, title_mis, sutra_mis = [], [], [], []

    for r in yt:
        lid_raw = r.get('lyrics_id', '').strip()
        vid = r.get('video_id', '').strip()
        title = r.get('title', '').strip()
        canon = r.get('lyrics_title', '').strip()
        sutra = r.get('sutra', '').strip()
        ct = r.get('content_type', '').strip()

        if not lid_raw:
            empty.append({'video_id': vid, 'title': title, 'content_type': ct})
            continue

        lid = normlid(lid_raw)
        if lid not in lyrics_idx:
            invalid.append({'video_id': vid, 'title': title, 'lyrics_id': lid_raw})
            continue

        le = lyrics_idx[lid]
        lyrics_song_title = (le.get('song_title') or le.get('SONG TITLE') or '').strip()
        if canon and canon.lower() != lyrics_song_title.lower():
            title_mis.append({
                'video_id': vid, 'lyrics_id': lid_raw,
                'yt_lyrics_title': canon,
                'lyrics_title': lyrics_song_title,
            })

        yt_s = {s.strip().lower() for s in sutra.split(',') if s.strip()}
        ly_s = {
            s.strip().lower()
            for s in (le.get('sutra') or le.get('SUTRA') or '').split(',')
            if s.strip()
        }
        if yt_s != ly_s:
            hashtags = find_sutras_in_text(title + ' ' + r.get('description', ''))
            yt_in_title = all(s in {h.lower() for h in hashtags} for s in yt_s) if yt_s else False
            sutra_mis.append({
                'video_id': vid, 'lyrics_id': lid_raw, 'title': title,
                'yt_sutra': sutra,
                'lyrics_sutra': (le.get('sutra') or le.get('SUTRA') or '').strip(),
                'verdict': 'likely intentional' if yt_in_title else 'likely drift',
            })

    print()
    print(f"Empty lyrics_id:       {len(empty)}   (expected: Commentary/Short-Reel rows)")
    print(f"Invalid lyrics_id:     {len(invalid)}   (must be 0)")
    print(f"Title mismatches:      {len(title_mis)}   (must be 0)")
    print(f"Sutra mismatches:      {len(sutra_mis)}   (variant-specific; see below)")

    if invalid:
        print("\n--- INVALID lyrics_id (FIX THESE) ---")
        for r in invalid:
            print(f"  {r['video_id']} / {r['lyrics_id']}: {r['title'][:70]}")

    if title_mis:
        print("\n--- TITLE MISMATCHES (FIX THESE) ---")
        for r in title_mis:
            print(f"  {r['lyrics_id']} ({r['video_id']})")
            print(f"    YT title     : {r['yt_lyrics_title']}")
            print(f"    LYRICS title : {r['lyrics_title']}")

    if sutra_mis:
        drift = [r for r in sutra_mis if r['verdict'] == 'likely drift']
        intent = [r for r in sutra_mis if r['verdict'] == 'likely intentional']
        print(f"\n--- SUTRA divergences: {len(intent)} likely intentional, "
              f"{len(drift)} likely drift ---")
        print("  LYRICS is the source of truth; build_yt_final.py enforces parity.")
        print("  Mismatches here just mean the snapshot predates the last build import.")
        print("  After importing AT-VIDEOS-final.csv and re-exporting, this should be 0.")


if __name__ == '__main__':
    main()
