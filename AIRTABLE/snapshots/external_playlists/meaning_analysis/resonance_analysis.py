#!/usr/bin/env python3
"""Cross-reference external playlist adds with lyrics + track metadata.
Meaning-first resonance analysis for BANANASUTRA.
Deliberate picks only (mirrors + dumps excluded); sensitivity check with all rows.
"""
import csv, re, json
from collections import Counter, defaultdict

BASE = "/sessions/elegant-inspiring-cannon/mnt/BANANASUTRA-app/AIRTABLE/snapshots"

def norm(t):
    return re.sub(r"\s+", " ", (t or "").strip().lower())

def load(path):
    with open(path, encoding="utf-8-sig") as fh:
        return list(csv.DictReader(fh))

adds   = load(f"{BASE}/external_playlists/external_playlist_signal - All External Adds (Full Data).csv")
tracks = load(f"{BASE}/2026-07-11/SC TRACKs-2026-07-11.csv")
songs  = load(f"{BASE}/2026-07-11/SONGS (Lyrics)-2026-07-11.csv")

song_title_key = list(songs[0].keys())[0]  # BOM-prefixed 'song_title'
smap = {s["lyrics_id"]: s for s in songs if s.get("lyrics_id")}
tmap = {norm(t["track_title"]): t for t in tracks}

EXCLUDE_TIERS = {"Catalog Mirror (Superfan)", "Generic Dump (low signal)"}

def enrich(rows):
    out = []
    for r in rows:
        t = tmap.get(norm(r["Track Title"]))
        if not t:
            continue
        s = smap.get(t.get("lyrics_id", ""))
        out.append((r, t, s))
    return out

deliberate = [r for r in adds if r["Tier"] not in EXCLUDE_TIERS]
all_rows = adds

ed = enrich(deliberate)
ea = enrich(all_rows)

print(f"TOTAL adds rows: {len(adds)}")
print(f"Deliberate picks (mirrors+dumps excluded): {len(deliberate)}")
print(f"  joined to SC TRACKs+lyrics: {len(ed)} ({len(ed)/len(deliberate):.1%})")
print(f"All rows joined: {len(ea)} ({len(ea)/len(adds):.1%})")
print(f"Unjoined deliberate rows are mostly 'In Catalog?=No':",
      Counter(r['In Catalog?'] for r in deliberate if norm(r['Track Title']) not in tmap))

# ---------- helpers ----------
def multi(val):
    return [v.strip() for v in (val or "").split(",") if v.strip()]

def dim_counts(enriched, getter, is_multi=False):
    c = Counter()
    for r, t, s in enriched:
        v = getter(t, s)
        if is_multi:
            for x in multi(v): c[x] += 1
        else:
            if v and v.strip(): c[v.strip()] += 1
    return c

def library_counts(getter, is_multi=False, level="track"):
    """Baseline over the 747 catalog tracks (each track = one lottery ticket)."""
    c = Counter()
    for t in tracks:
        s = smap.get(t.get("lyrics_id",""))
        v = getter(t, s)
        if is_multi:
            for x in multi(v): c[x] += 1
        else:
            if v and v.strip(): c[v.strip()] += 1
    return c

DIMS = {
    "sutra":        (lambda t, s: (s or {}).get("sutra") or t.get("sutra"), False),
    "songbook":     (lambda t, s: (s or {}).get("songbook"), False),
    "light_shadow": (lambda t, s: (s or {}).get("light_shadow"), False),
    "topic":        (lambda t, s: (s or {}).get("topic"), True),
    "intention":    (lambda t, s: (s or {}).get("intention"), True),
    "lang":         (lambda t, s: (s or {}).get("lang"), False),
    "primary_genre":(lambda t, s: t.get("primary_genre"), False),
    "mood":         (lambda t, s: t.get("mood"), True),
    "tempo_feel":   (lambda t, s: t.get("tempo_feel"), False),
    "instruments":  (lambda t, s: t.get("instruments"), True),
}

report = {}
for name, (getter, is_multi) in DIMS.items():
    a = dim_counts(ed, getter, is_multi)
    b = library_counts(getter, is_multi)
    ta, tb = sum(a.values()), sum(b.values())
    rows = []
    for k in sorted(set(a) | set(b), key=lambda k: -a.get(k, 0)):
        sa = a.get(k, 0) / ta if ta else 0
        sb = b.get(k, 0) / tb if tb else 0
        lift = sa / sb if sb else None
        rows.append({"value": k, "adds": a.get(k, 0), "adds_share": round(sa, 4),
                     "library_tracks": b.get(k, 0), "lib_share": round(sb, 4),
                     "lift": round(lift, 2) if lift else None})
    report[name] = rows
    print(f"\n===== {name} (deliberate adds vs library-track baseline) =====")
    print(f"{'value':<28}{'adds':>6}{'add%':>8}{'lib':>6}{'lib%':>8}{'lift':>7}")
    for r in rows[:15]:
        print(f"{r['value'][:27]:<28}{r['adds']:>6}{r['adds_share']:>8.1%}{r['library_tracks']:>6}{r['lib_share']:>8.1%}{str(r['lift'] or '—'):>7}")

# ---------- song-level: distinct playlists & curators per SONG (all versions pooled) ----------
song_playlists = defaultdict(set)
song_curators = defaultdict(set)
song_adds = Counter()
for r, t, s in ed:
    title = (s or {}).get(song_title_key) or t.get("lyrics_title") or r["Track Title"]
    song_playlists[title].add((r["Owner"], r["Playlist Title"]))
    song_curators[title].add(r["Owner"])
    song_adds[title] += 1

# library: number of track versions per song
song_versions = Counter()
for t in tracks:
    s = smap.get(t.get("lyrics_id",""))
    title = (s or {}).get(song_title_key) or t.get("lyrics_title")
    if title: song_versions[title] += 1

print("\n===== TOP 25 SONGS by distinct curators (deliberate picks) =====")
print(f"{'song':<45}{'curators':>9}{'playlists':>10}{'adds':>6}{'versions':>9}{'adds/ver':>9}  sutra | light/shadow | topic")
top = sorted(song_curators.items(), key=lambda kv: -len(kv[1]))[:25]
for title, curs in top:
    s = next((s for s in songs if s.get(song_title_key) == title), None)
    meta = f"{(s or {}).get('sutra','?')} | {(s or {}).get('light_shadow','?')} | {(s or {}).get('topic','?')}"
    v = song_versions.get(title, 0)
    apv = song_adds[title]/v if v else 0
    print(f"{title[:44]:<45}{len(curs):>9}{len(song_playlists[title]):>10}{song_adds[title]:>6}{v:>9}{apv:>9.1f}  {meta}")

# ---------- KNOWsutra PEACE check ----------
peace = [x for x in ed if 'peace' in (x[1].get('track_title','').lower())]
print(f"\nKNOWsutra 'Peace Not War' rows in deliberate adds: {len(peace)}")

# ---------- sensitivity: sutra distribution with ALL rows ----------
print("\n===== SENSITIVITY: sutra, all 3449 rows joined =====")
a = dim_counts(ea, DIMS['sutra'][0])
ta = sum(a.values())
for k, v in a.most_common():
    print(f"{k:<15}{v:>6}{v/ta:>8.1%}")

with open("/sessions/elegant-inspiring-cannon/mnt/outputs/resonance_report.json", "w") as fh:
    json.dump(report, fh, indent=1)
print("\nJSON saved.")
