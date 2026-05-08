import csv
import re
from collections import defaultdict

SC_EXPORT = 'bananasutra_sc_export.csv'
CONFIRMED_EPS = '../../AIRTABLE/SOUNDCLOUD/sc-archived/confirmed/CONFIRMED-EPS-4-15-26.csv'

def read_csv(path):
    with open(path, encoding='utf-8-sig', newline='') as f:
        return list(csv.DictReader(f))

def clean_ep_title(t):
    """Matches the script's clean_ep_title: replace commas with middots."""
    return re.sub(r',\s*', ' - ', (t or '').strip()).replace(' - ', ' \u00b7 ')

# Actually simpler: mirror the exact regex from the script
def clean_ep_title(t):
    return re.sub(r',\s*', ' \u00b7 ', (t or '').strip())

raw = read_csv(SC_EXPORT)
conf = read_csv(CONFIRMED_EPS)

raw_by_url = defaultdict(set)         # after clean_ep_title
raw_original_by_url = defaultdict(set) # before cleaning, for display
for r in raw:
    url = (r.get('ep_url') or '').strip()
    title_orig = (r.get('ep_title') or '').strip()
    if url and title_orig:
        raw_by_url[url].add(clean_ep_title(title_orig))
        raw_original_by_url[url].add(title_orig)

conf_by_url = {}          # after clean_ep_title
conf_original_by_url = {} # before cleaning
for r in conf:
    url = (r.get('ep_url') or '').strip()
    title_orig = (r.get('ep_title') or '').strip()
    if url:
        conf_by_url[url] = clean_ep_title(title_orig)
        conf_original_by_url[url] = title_orig

# Find URL matches where cleaned titles still diverge — these are the real duplicates
real_diverges = []
for url, raw_cleaned_titles in raw_by_url.items():
    conf_cleaned = conf_by_url.get(url)
    if not conf_cleaned:
        continue
    if conf_cleaned not in raw_cleaned_titles:
        real_diverges.append((
            url,
            sorted(raw_cleaned_titles),
            conf_cleaned,
            sorted(raw_original_by_url[url]),
            conf_original_by_url[url],
        ))

print("After applying clean_ep_title (commas -> middots):")
print("  Total URL-matched EPs:        ", sum(1 for url in raw_by_url if url in conf_by_url))
print("  Real duplicates in output:    ", len(real_diverges))
print("  (These are the ones causing doubled rows in AT-EPS-v4.csv)")
print()

if real_diverges:
    print("=" * 80)
    print("Actual duplicate-row cases (cleaned titles still differ):")
    print("=" * 80)
    for i, (url, raw_cleaned, conf_cleaned, raw_orig, conf_orig) in enumerate(real_diverges, 1):
        slug = url.rsplit('/', 1)[-1]
        print()
        print("[%d] %s" % (i, slug))
        for rt in raw_orig:
            print("    RAW (live on SC):   " + repr(rt))
        print("    CONFIRMED (yours):  " + repr(conf_orig))
