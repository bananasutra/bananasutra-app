type JsonRecord = Record<string, unknown>;

export type VideoRecord = JsonRecord & {
  lyrics_id?: string;
  lyrics_title?: string;
  title?: string;
  url_slug?: string;
  publish_date?: string;
  sutra?: string;
  video_featured?: boolean;
};

export type SongRecord = JsonRecord & {
  lyrics_title?: string;
  sutra?: string;
  url_slug?: string;
  published_at?: string;
};

export const sanitize = (value: unknown): string =>
  String(value ?? "")
    .replace(/\r?\n+/g, " ")
    .replace(/\|/g, "/")
    .replace(/\s+/g, " ")
    .trim();

export const normalizeDate = (raw: unknown): string | null => {
  const value = sanitize(raw);
  if (!value) return null;
  const isoMatch = value.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoMatch?.[1]) return isoMatch[1];
  return null;
};

export type LatestDropRow = {
  title: string;
  sutra: string;
  slug: string;
  publishedDate: string;
};

/** One row per song (slug / lyrics_id), prefer featured then newest publish_date. */
export const pickLatestUniqueVideos = (
  videosByLyricsId: Record<string, VideoRecord[]>,
  limit = 3,
): LatestDropRow[] => {
  const bySongKey = new Map<string, LatestDropRow & { featured: boolean }>();

  for (const video of Object.values(videosByLyricsId).flat()) {
    const title = sanitize(video.lyrics_title) || sanitize(video.title);
    const publishedDate = normalizeDate(video.publish_date);
    const slug = sanitize(video.url_slug);
    const lyricsId = sanitize(video.lyrics_id);
    const songKey = slug || lyricsId || title;
    if (!title || !publishedDate || !songKey) continue;

    const candidate = {
      title,
      sutra: sanitize(video.sutra).toUpperCase(),
      slug,
      publishedDate,
      featured: Boolean(video.video_featured),
    };

    const prev = bySongKey.get(songKey);
    if (!prev) {
      bySongKey.set(songKey, candidate);
      continue;
    }
    if (candidate.publishedDate > prev.publishedDate) {
      bySongKey.set(songKey, candidate);
      continue;
    }
    if (candidate.publishedDate === prev.publishedDate && candidate.featured && !prev.featured) {
      bySongKey.set(songKey, candidate);
    }
  }

  return Array.from(bySongKey.values())
    .map(({ featured: _featured, ...row }) => row)
    .sort((a, b) => b.publishedDate.localeCompare(a.publishedDate))
    .slice(0, limit);
};

export const maxCatalogVideoPublishDate = (videosByLyricsId: Record<string, VideoRecord[]>): string | null => {
  const dates = Object.values(videosByLyricsId)
    .flat()
    .map((video) => normalizeDate(video.publish_date))
    .filter((date): date is string => Boolean(date))
    .sort((a, b) => b.localeCompare(a));
  return dates[0] ?? null;
};

/** Fail the build if LATEST_DROPS video dates lag behind youtube_by_lyrics_id.json. */
export const assertLatestVideosMatchCatalog = (
  videosByLyricsId: Record<string, VideoRecord[]>,
  latestDrops: string,
): void => {
  const maxCatalog = maxCatalogVideoPublishDate(videosByLyricsId);
  if (!maxCatalog) return;

  const videoSection = latestDrops.split("\nLatest videos:\n")[1];
  if (!videoSection?.trim()) {
    throw new Error("latestDrops missing Latest videos section");
  }

  const topInjectDate =
    videoSection
      .split("\n")
      .map((line) => line.match(/published (\d{4}-\d{2}-\d{2})/)?.[1])
      .find(Boolean) ?? null;

  if (topInjectDate && topInjectDate !== maxCatalog) {
    throw new Error(
      `latestDrops stale: newest catalog video is ${maxCatalog} but inject lists ${topInjectDate}. Re-run npm run catalog:data (build:library step).`,
    );
  }
};

export const buildLatestDrops = (songs: SongRecord[], videosByLyricsId: Record<string, VideoRecord[]>): string => {
  const latestSongs = songs
    .map((song) => ({
      title: sanitize(song.lyrics_title),
      sutra: sanitize(song.sutra).toUpperCase(),
      slug: sanitize(song.url_slug),
      publishedDate: normalizeDate(song.published_at),
    }))
    .filter((song) => song.title && song.slug && song.publishedDate)
    .sort((a, b) => (b.publishedDate ?? "").localeCompare(a.publishedDate ?? ""))
    .slice(0, 5);

  const latestVideos = pickLatestUniqueVideos(videosByLyricsId, 3);

  const refreshDate = new Date().toISOString().slice(0, 10);
  const lines = [`Refresh date: ${refreshDate}`, "Latest songs:"];

  for (const song of latestSongs) {
    lines.push(`- ${song.title} (${song.sutra || "UNKNOWN"}) - published ${song.publishedDate} - /songs/${song.slug}`);
  }

  lines.push("Latest videos:");
  for (const video of latestVideos) {
    const route = video.slug ? `/songs/${video.slug}` : "/videos";
    lines.push(`- ${video.title} (${video.sutra || "UNKNOWN"}) - published ${video.publishedDate} - ${route}`);
  }

  const text = lines.join("\n");
  assertLatestVideosMatchCatalog(videosByLyricsId, text);
  return text;
};
