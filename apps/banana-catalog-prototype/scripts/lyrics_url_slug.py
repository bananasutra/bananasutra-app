"""Shared slug rules: keep in sync with src/catalog/slugify.ts (lyricsTitleToUrlSlug)."""

from __future__ import annotations

import re
import unicodedata


def lyrics_title_to_url_slug(title: str) -> str:
    decomposed = unicodedata.normalize("NFKD", title)
    no_marks = "".join(
        c for c in decomposed if unicodedata.category(c)[0] != "M"
    )
    base = no_marks.lower()
    base = re.sub(r"[^a-z0-9]+", "-", base)
    base = re.sub(r"^-+|-+$", "", base)
    base = base[:72]
    return base if base else "song"
