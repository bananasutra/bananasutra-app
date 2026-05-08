"""
Curated SC track genre tokens (primary_genre + secondary_genres on SC TRACKs).

Used by validate_snapshot.py and audit_genres.py so new Airtable vocabulary
stays explicit: add a token here when you introduce it in SC, then re-run
`npm run catalog:data` (or the two scripts alone).

Facet chips for secondary genres come from facets.json (dynamic counts);
this set only gates QA / integrity warnings.
"""

from __future__ import annotations

ALLOWED_TRACK_GENRE_TOKENS: frozenset[str] = frozenset(
    {
        "BANJO",
        "BLUES",
        "BURLESQUE",
        "COUNTRY",
        "DUB",
        "FLAMENCO",
        "FOLK",
        "GIPSY",
        "INDIE",
        "JAZZ",
        "LOFI",
        "MANTRA",
        "MOTORIK",
        "PSYCHEDELIC",
        "PUNK",
        "RAGGA",
        "ROCK",
        "TECHNO",
        "WORLD",
    }
)
