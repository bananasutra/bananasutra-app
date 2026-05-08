"""SoundCloud CDN artwork URLs: derive standard (~500) and large (~1080) from any artworks-* URL."""

from __future__ import annotations

import re

# artworks-…-t500x500.jpg  →  swap tail size token
_SIZE_TAIL = re.compile(r"-t\d+x\d+(?=\.[a-z]+$)", re.I)


def sndcdn_artwork_sm_lg(raw: str) -> tuple[str, str]:
    """Return ``(artwork_url_sm, artwork_lg_url)`` for sndcdn artwork URLs.

    Non-sndcdn / empty strings are returned unchanged for both slots.
    """
    if not (raw or "").strip():
        return "", ""
    u = raw.strip()
    if "-large." in u:
        u = u.replace("-large.", "-t500x500.")
    if "sndcdn.com" not in u:
        return u, u
    sm = _SIZE_TAIL.sub("-t500x500", u, count=1)
    lg = _SIZE_TAIL.sub("-t1080x1080", u, count=1)
    if sm == u and "-t" not in u:
        return u, u
    return sm, lg
