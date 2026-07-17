#!/usr/bin/env python3
"""Regression: compilation EP track ownership prefers SoundCloud track_title."""

from __future__ import annotations

import unittest

from build_artifacts import canonical_lyrics_id_from_ep_row


EP_SET = (
    "https://soundcloud.com/bananasutra/sets/"
    "the-conquest-of-happiness-according-to-bertrand-russel-2-songs-epx10-knowsutra"
)

LIDS_BY_EP = {
    EP_SET: ["L-393", "L-244"],
}

TITLES = {
    "L-393": "The Unhappiness Tango",
    "L-244": "The Conquest of Happiness",
}


class CompilationEpOwnershipTests(unittest.TestCase):
    def test_overrides_swapped_declared_lid_using_track_title(self) -> None:
        # Airtable says L-393 but SC title is Conquest → L-244
        row = {
            "ep_url": EP_SET,
            "track_title": (
                "Side B [05] EP Bertrand - The Conquest of Happiness - "
                "GROWsutra Sweet Waltz BURLESQUE"
            ),
            "lyrics_title": "The Unhappiness Tango",
        }
        self.assertEqual(
            canonical_lyrics_id_from_ep_row(row, "L-393", LIDS_BY_EP, TITLES),
            "L-244",
        )

    def test_dance_alias_maps_to_tango_song(self) -> None:
        # Catalog title is Tango; SC singles say Dance; declared wrongly as L-244
        row = {
            "ep_url": EP_SET,
            "track_title": (
                "Side A [05] EP Bertrand - The Unhappiness Dance - GROWsutra Indie JAZZ"
            ),
            "lyrics_title": "The Conquest of Happiness",
        }
        self.assertEqual(
            canonical_lyrics_id_from_ep_row(row, "L-244", LIDS_BY_EP, TITLES),
            "L-393",
        )

    def test_keeps_declared_when_track_title_matches_declared(self) -> None:
        row = {
            "ep_url": EP_SET,
            "track_title": (
                "Side A [01] EP Bertrand - The Unhappiness Dance - "
                "GROWsutra Jazzy BURLESQUE"
            ),
            "lyrics_title": "The Unhappiness Tango",
        }
        self.assertEqual(
            canonical_lyrics_id_from_ep_row(row, "L-393", LIDS_BY_EP, TITLES),
            "L-393",
        )

    def test_single_song_ep_always_wins(self) -> None:
        lids = {"https://soundcloud.com/bananasutra/sets/only-one": ["L-100"]}
        row = {
            "ep_url": "https://soundcloud.com/bananasutra/sets/only-one",
            "track_title": "Something else entirely",
        }
        self.assertEqual(
            canonical_lyrics_id_from_ep_row(row, "L-999", lids, {"L-100": "Only One"}),
            "L-100",
        )


if __name__ == "__main__":
    unittest.main()
