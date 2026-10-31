import assert from "node:assert/strict";
import { test } from "node:test";
import {
  assertLatestVideosMatchCatalog,
  buildLatestDrops,
  pickLatestUniqueVideos,
  type VideoRecord,
} from "./library-latest-drops.ts";

test("pickLatestUniqueVideos dedupes by slug and keeps newest date", () => {
  const videos: Record<string, VideoRecord[]> = {
    L1: [
      { lyrics_title: "Same Song", url_slug: "same-song", publish_date: "2026-10-26", sutra: "KNOWsutra" },
      { lyrics_title: "Same Song", url_slug: "same-song", publish_date: "2026-10-20", sutra: "KNOWsutra" },
    ],
    L2: [{ lyrics_title: "Older", url_slug: "older", publish_date: "2026-09-30", sutra: "GROWsutra" }],
  };
  const picked = pickLatestUniqueVideos(videos, 3);
  assert.equal(picked.length, 2);
  assert.equal(picked[0]?.title, "Same Song");
  assert.equal(picked[0]?.publishedDate, "2026-10-26");
});

test("assertLatestVideosMatchCatalog rejects stale inject dates", () => {
  const videos: Record<string, VideoRecord[]> = {
    L1: [{ lyrics_title: "Fresh", publish_date: "2026-10-26", url_slug: "fresh" }],
  };
  const stale = "Refresh date: 2026-10-31\nLatest songs:\nLatest videos:\n- Old (GROW) - published 2026-09-30 - /songs/old";
  assert.throws(() => assertLatestVideosMatchCatalog(videos, stale), /latestDrops stale/);
});

test("buildLatestDrops passes freshness check for aligned catalog", () => {
  const songs = [{ lyrics_title: "Song A", url_slug: "song-a", published_at: "2026-10-28", sutra: "BOWsutra" }];
  const videos: Record<string, VideoRecord[]> = {
    L1: [{ lyrics_title: "Video A", url_slug: "song-a", publish_date: "2026-10-26", sutra: "BOWsutra" }],
  };
  const text = buildLatestDrops(songs, videos);
  assert.match(text, /Latest videos:/);
  assert.match(text, /2026-10-26/);
});
