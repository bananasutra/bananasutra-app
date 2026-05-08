"""
Airtable long-text fields in CSV exports often use Unicode line / paragraph separators
(U+2028 LINE SEPARATOR, U+2029 PARAGRAPH SEPARATOR) immediately before a physical newline.

`clean_airtable_snapshot.normalize_cell` mapped each separator to ``\\n``, which turned a
single visual line break in Airtable into ``\\n\\n`` in plain text (blank line in ``<pre>``).

Collapse separator + following/ preceding CR/LF to a single ``\\n`` first; remaining lone
separators are still normalized elsewhere (e.g. ``\\u2028`` → ``\\n``).
"""

from __future__ import annotations

import re

_U2028_BEFORE_NL = re.compile(r"\u2028(?:\r\n|\r|\n)")
_U2028_AFTER_NL = re.compile(r"(?:\r\n|\r|\n)\u2028")
_U2029_BEFORE_NL = re.compile(r"\u2029(?:\r\n|\r|\n)")
_U2029_AFTER_NL = re.compile(r"(?:\r\n|\r|\n)\u2029")


def collapse_airtable_separator_newlines(s: str) -> str:
    """Turn ``U+2028/U+2029`` paired with a physical line break into a single newline."""
    if not s:
        return s
    t = _U2028_BEFORE_NL.sub("\n", s)
    t = _U2028_AFTER_NL.sub("\n", t)
    t = _U2029_BEFORE_NL.sub("\n", t)
    t = _U2029_AFTER_NL.sub("\n", t)
    return t
