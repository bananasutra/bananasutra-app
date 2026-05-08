import csv, re
from rapidfuzz import fuzz

# ── helpers ──────────────────────────────────────────────────────────────────
def norm(s):
    return re.sub(r'[^a-z0-9 ]', '', s.lower()).strip()

def read_csv(path, enc='utf-8-sig'):
    with open(path, newline='', encoding=enc) as f:
        return list(csv.DictReader(f)), csv.DictReader(open(path, newline='', encoding=enc)).fieldnames

def write_csv(path, rows, headers):
    with open(path, 'w', newline='', encoding='utf-8') as f:
        w = csv.DictWriter(f, fieldnames=headers, extrasaction='ignore')
        w.writeheader()
        w.writerows(rows)

# ── load LYRICS → title->ID map ───────────────────────────────────────────────
lyrics_rows, _ = read_csv('/sessions/jolly-beautiful-keller/mnt/uploads/LYRICS-with airtable ids.csv')

title_to_id = {}
for r in lyrics_rows:
    t = r.get('SONG TITLE', '').strip()
    lid = r.get('LYRICS ID', '').strip()
    if t and lid:
        key = norm(t)
        if key not in title_to_id:   # keep first match for duplicates (e.g. Kindness L-126)
            title_to_id[key] = lid

print(f"Title->ID map: {len(title_to_id)} entries")

def resolve_id(lyrics_title):
    lt = (lyrics_title or '').strip()
    if not lt:
        return ''
    # exact normalized match
    key = norm(lt)
    if key in title_to_id:
        return title_to_id[key]
    # fuzzy fallback
    best_score, best_id = 0, ''
    for k, lid in title_to_id.items():
        score = fuzz.token_sort_ratio(key, k)
        if score > best_score:
            best_score, best_id = score, lid
    if best_score >= 80:
        return best_id
    return ''

# ── INSTRUMENTS parser ────────────────────────────────────────────────────────
INSTRUMENTS = [
    'accordion', 'banjo', 'bass', 'cello', 'clarinet', 'drums', 'fiddle',
    'flute', 'guitar', 'harmonica', 'harp', 'keyboard', 'lute', 'mandolin',
    'oboe', 'organ', 'percussion', 'piano', 'saxophone', 'sax', 'synth',
    'theremin', 'trombone', 'trumpet', 'tuba', 'ukulele', 'viola', 'violin',
]
# normalize sax/saxophone → saxophone
SAX_NORM = {'sax': 'saxophone'}

def parse_instruments(title):
    t = title.lower()
    found = []
    for inst in INSTRUMENTS:
        if re.search(r'\b' + inst + r'\b', t):
            inst_norm = SAX_NORM.get(inst, inst)
            if inst_norm not in found:
                found.append(inst_norm)
    return ', '.join(sorted(found))

# ── GENRES inference for 4 blank EPs ─────────────────────────────────────────
BLANK_EP_GENRES = {
    "A Man's A Man for A' That - VOL. 01 - Revolution Forever": ('FOLK, INDIE', 'FOLK, INDIE'),
    "Some Truths (Are Harder to Swallow) EPx7":                 ('BLUES, INDIE, LOFI', 'BLUES, INDIE, LOFI'),
    "Tell the Truth EP x4 BLUESsutra":                         ('BANJO, BLUES, JAZZ', 'BANJO, BLUES, JAZZ'),
    "Where We Begin (Preakly Peaches) EPx4":                   ('BURLESQUE, DUB', 'BURLESQUE, DUB'),
}

# ══════════════════════════════════════════════════════════════════════════════
# EPs
# ══════════════════════════════════════════════════════════════════════════════
eps, ep_headers = read_csv('/sessions/jolly-beautiful-keller/mnt/uploads/EPs.csv', enc='utf-8')

# Drop cols user wants removed
drop_ep = {'lyrics_title', 'lyrics_match_conf'}
ep_out_headers = [h for h in ep_headers if h not in drop_ep]

ep_resolved = ep_unresolved = ep_genres_fixed = 0

for r in eps:
    # ── lyrics_id ────────────────────────────────────────────────────────────
    if not r.get('lyrics_id', '').strip():
        lt = r.get('lyrics_title', '').strip()
        new_id = resolve_id(lt) if lt else ''
        r['lyrics_id'] = new_id
        if new_id:
            ep_resolved += 1
        else:
            ep_unresolved += 1

    # ── genres_full: fill blanks from genres, infer for fully empty EPs ──────
    ep_title = r.get('ep_title', '')
    if ep_title in BLANK_EP_GENRES:
        g, gf = BLANK_EP_GENRES[ep_title]
        if not r.get('genres', '').strip():
            r['genres'] = g
        if not r.get('genres_full', '').strip():
            r['genres_full'] = gf
        ep_genres_fixed += 1
    elif r.get('genres', '').strip() and not r.get('genres_full', '').strip():
        r['genres_full'] = r['genres']   # mirror genres → genres_full as baseline

write_csv('/sessions/jolly-beautiful-keller/mnt/BANANASUTRA/AT-EPS-v3.csv', eps, ep_out_headers)
print(f"\nEPs: resolved {ep_resolved} lyrics_ids, {ep_unresolved} still blank (SONGBOOK EPs), {ep_genres_fixed} genres inferred")

# verify unresolved
still_blank = [r for r in eps if not r.get('lyrics_id','').strip()]
print(f"  Still blank lyrics_id: {len(still_blank)}")
for r in still_blank:
    print(f"    {r['ep_title'][:70]} | conf={r.get('lyrics_match_conf','')}")

# ══════════════════════════════════════════════════════════════════════════════
# TRACKS
# ══════════════════════════════════════════════════════════════════════════════
tracks, t_headers = read_csv('/sessions/jolly-beautiful-keller/mnt/uploads/TRACKS-c36150e5.csv', enc='utf-8')

# Rename instrument field, drop unneeded cols
INST_OLD = 'Instruments (NEW multiselect FIELD, please: pase value out of track titke when possible, e.g cello, accordion, piano, banjo, etc)'
INST_NEW = 'instruments'
drop_t   = {'lyrics_match_conf', INST_OLD, ''}   # drop empty-named col too

# Build output headers: replace old inst col with 'instruments', drop others
t_out_headers = []
for h in t_headers:
    if h in drop_t:
        continue
    if h == INST_OLD:
        t_out_headers.append(INST_NEW)
    else:
        t_out_headers.append(h)
if INST_NEW not in t_out_headers:
    t_out_headers.append(INST_NEW)

t_resolved = t_unresolved = t_inst_found = 0

for r in tracks:
    # ── lyrics_id ────────────────────────────────────────────────────────────
    lid = r.get('lyrics_id', '').strip()
    if not lid or lid == '?':
        lt = r.get('lyrics_title', '').strip()
        new_id = resolve_id(lt) if lt else ''
        r['lyrics_id'] = new_id
        if new_id:
            t_resolved += 1
        else:
            t_unresolved += 1

    # ── instruments ──────────────────────────────────────────────────────────
    title = r.get('track title', '')
    inst = parse_instruments(title)
    r[INST_NEW] = inst
    if inst:
        t_inst_found += 1

write_csv('/sessions/jolly-beautiful-keller/mnt/BANANASUTRA/AT-TRACKS-v3.csv', tracks, t_out_headers)
print(f"\nTRACKS: resolved {t_resolved} lyrics_ids, {t_unresolved} blank, instruments found in {t_inst_found} tracks")

# breakdown of unresolved tracks
blank_t = [r for r in tracks if not r.get('lyrics_id','').strip()]
print(f"  Blank lyrics_id tracks ({len(blank_t)}):")
for r in blank_t[:10]:
    print(f"    '{r.get('track title','')[:60]}' | lyrics_title='{r.get('lyrics_title','')}'")

# ══════════════════════════════════════════════════════════════════════════════
# PLAYLISTS — pass through as-is
# ══════════════════════════════════════════════════════════════════════════════
import shutil
shutil.copy(
    '/sessions/jolly-beautiful-keller/mnt/uploads/PLAYLISTS-43c880a2.csv',
    '/sessions/jolly-beautiful-keller/mnt/BANANASUTRA/AT-PLAYLISTS-v3.csv'
)
print("\nPLAYLISTS: copied through unchanged")
