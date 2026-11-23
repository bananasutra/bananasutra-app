#!/usr/bin/env python3
"""Unit tests for the local Airtable media enrich step."""
from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import enrich_airtable_media as media


def track(seconds: int, track_id: str, fav: bool = False, plays: int = 0) -> media.TrackCand:
    return media.TrackCand(
        seconds=seconds,
        fav=fav,
        in_app=False,
        plays=plays,
        track_id=track_id,
        title=track_id,
        url=f"https://soundcloud.com/bananasutra/{track_id}",
    )


class DurationParseTests(unittest.TestCase):
    def test_clock_and_iso(self) -> None:
        self.assertEqual(media.parse_duration_seconds("3:45"), 225)
        self.assertEqual(media.parse_duration_seconds("1:02:03"), 3723)
        self.assertEqual(media.parse_duration_seconds("PT1M30S"), 90)
        self.assertEqual(media.parse_duration_seconds("PT4M"), 240)
        self.assertIsNone(media.parse_duration_seconds(""))
        self.assertIsNone(media.parse_duration_seconds("nope"))


class BananaDescTests(unittest.TestCase):
    def test_keeps_hand_written_copy(self) -> None:
        self.assertEqual(media.existing_banana_desc({"desc_bn": "  longer site copy  "}), "longer site copy")
        self.assertEqual(media.existing_banana_desc({"_desc-bn": "from the import name"}), "from the import name")
        self.assertEqual(media.existing_banana_desc({}), "")


class FullTableTests(unittest.TestCase):
    def test_original_columns_stay_first_and_untouched(self) -> None:
        headers = ["song_title", "lyrics_id", "lyrics", "vid_exist"]
        raw = [{"song_title": "Hold The Mic", "lyrics_id": "L-1", "lyrics": "full text", "vid_exist": ""}]
        updates = {"L-1": {"_desc-sc": "the essay", "_desc-bn": "", "vid_exist": "checked", "lyrics": "WIPED"}}
        fields, rows = media.assemble_full_table(
            headers,
            raw,
            updates,
            "lyrics_id",
            ["_desc-sc", "_desc-bn"],
            {"vid_exist"},
            {"_desc-bn"},
        )
        self.assertEqual(fields[:4], headers)
        self.assertEqual(fields[4:], ["_desc-sc", "_desc-bn"])
        self.assertEqual(rows[0]["lyrics"], "full text")
        self.assertEqual(rows[0]["song_title"], "Hold The Mic")
        self.assertEqual(rows[0]["vid_exist"], "checked")
        self.assertEqual(rows[0]["_desc-sc"], "the essay")

    def test_existing_airtable_column_is_not_recalculated(self) -> None:
        headers = ["song_title", "lyrics_id", "redux_status"]
        raw = [{"song_title": "Hey, You (Creepers)", "lyrics_id": "L-98", "redux_status": "redux"}]
        fields, rows = media.assemble_full_table(
            headers,
            raw,
            {"L-98": {"redux_status": ""}},
            "lyrics_id",
            ["redux_status"],
            set(),
            set(),
        )
        self.assertEqual(fields, headers)
        self.assertEqual(rows[0]["redux_status"], "redux")

    def test_nonempty_cell_is_not_replaced(self) -> None:
        self.assertEqual(media.keep_if_filled("already written", "new guess"), "already written")
        self.assertEqual(media.keep_if_filled("", "new guess"), "new guess")


class ReduxStatusTests(unittest.TestCase):
    def test_published_song_is_not_a_redux(self) -> None:
        self.assertEqual(media.redux_status_for("PUBLISHED", [{"ep_url": "https://sc/sets/old"}], []), "")

    def test_existing_ep_or_single_is_redux(self) -> None:
        self.assertEqual(media.redux_status_for("LANDR", [{"ep_url": "https://sc/sets/blessed"}], []), "redux")
        self.assertEqual(media.redux_status_for("LANDR", [], [{"ep_url": ""}]), "redux")
        self.assertEqual(media.redux_status_for("LANDR", [{"ep_volume": "2"}], []), "redux")

    def test_no_release_is_blank(self) -> None:
        self.assertEqual(media.redux_status_for("NEW", [], []), "")


class LikeStateTests(unittest.TestCase):
    def test_blank_is_unknown_not_a_fail(self) -> None:
        self.assertEqual(media.like_state(None), "unknown")
        self.assertEqual(media.like_state(0), "none")
        self.assertEqual(media.like_state(1), "liked")


class DescriptionChoiceTests(unittest.TestCase):
    def test_shared_text_collapses(self) -> None:
        rows = [
            {"_text": "Hello   there", "_source": "a", "_noun": "tracks", "fav_track": ""},
            {"_text": "Hello there", "_source": "b", "_noun": "tracks", "fav_track": "checked"},
        ]
        text, source = media.choose_description(rows, media._track_rank)
        self.assertEqual(text, "Hello   there")
        self.assertEqual(source, "shared by 2 tracks")

    def test_variants_prefer_fav_track(self) -> None:
        rows = [
            {
                "_text": "short",
                "_source": "plain",
                "_noun": "tracks",
                "fav_track": "",
                "track_in_app": "",
                "play_count": "999",
                "track_id": "a",
            },
            {
                "_text": "the fav essay",
                "_source": "fav version",
                "_noun": "tracks",
                "fav_track": "checked",
                "track_in_app": "",
                "play_count": "1",
                "track_id": "b",
            },
        ]
        text, source = media.choose_description(rows, media._track_rank)
        self.assertEqual(text, "the fav essay")
        self.assertIn("fav version", source)
        self.assertIn("2 variants", source)


class MatchTests(unittest.TestCase):
    def test_exact(self) -> None:
        match = media.best_duration_match(200, [track(200, "a"), track(240, "b")])
        assert match is not None
        self.assertEqual(match.label, "exact")
        self.assertEqual(match.track.track_id, "a")
        self.assertFalse(match.ambiguous)

    def test_close_within_five(self) -> None:
        match = media.best_duration_match(132, [track(130, "a"), track(180, "b")])
        assert match is not None
        self.assertEqual(match.label, "close")

    def test_ambiguous_near_tie_keeps_both(self) -> None:
        tracks = [track(199, "slow"), track(200, "fast", fav=True)]
        match = media.best_duration_match(200, tracks)
        assert match is not None
        self.assertEqual(match.label, "ambiguous")
        near = media.ambiguous_tracks(200, tracks, match)
        self.assertEqual({item.track_id for item in near}, {"slow", "fast"})

    def test_weak_and_none(self) -> None:
        weak = media.best_duration_match(200, [track(220, "a")])
        assert weak is not None
        self.assertEqual(weak.label, "weak")
        none = media.best_duration_match(200, [track(260, "a")])
        assert none is not None
        self.assertEqual(none.label, "none")

    def test_fav_wins_a_real_tie(self) -> None:
        match = media.best_duration_match(180, [track(180, "plain", plays=50), track(180, "fav", fav=True, plays=1)])
        assert match is not None
        self.assertEqual(match.track.track_id, "fav")
        self.assertEqual(match.label, "ambiguous")


if __name__ == "__main__":
    unittest.main()
