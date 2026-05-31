import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

type JsonRecord = Record<string, unknown>;

interface SongRecord extends JsonRecord {
  lyrics_title?: string;
  summary_short?: string;
  lyrics_extract?: string;
  sutra?: string;
  topic?: string;
  intention?: string;
  light_shadow?: string;
  url_slug?: string;
  cover?: boolean;
  public_domain?: boolean;
}

interface TrackRecord extends JsonRecord {
  lyrics_title?: string;
  genres?: string[];
  primary_genre?: string;
  mood?: string;
  tempo_feel?: string;
  instruments?: string[];
}

interface TrackFacetCounts {
  mood: Record<string, number>;
  primary_genre: Record<string, number>;
  genre: Record<string, number>;
  instrument: Record<string, number>;
}

interface VideoRecord extends JsonRecord {
  lyrics_title?: string;
  genre_primary?: string;
  genre_secondary?: string;
  video_featured?: boolean;
}

interface SongbookRecord extends JsonRecord {
  songbook?: string;
  description?: string;
  sutras?: string;
  topics_primary?: string;
  url_slug_songbook?: string;
}

interface QuoteRecord extends JsonRecord {
  quote?: string;
  muse?: string;
  primary_sutra?: string;
}

interface MuseRecord extends JsonRecord {
  muse?: string;
  type_category?: string;
  core_sutra?: string;
  themes?: string;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");
const generatedRoot = path.join(repoRoot, "apps", "banana-catalog-prototype", "src", "data", "generated");
const outputFile = path.join(repoRoot, "bbb-api", "src", "library-data.ts");

const sanitize = (value: unknown): string =>
  String(value ?? "")
    .replace(/\r?\n+/g, " ")
    .replace(/\|/g, "/")
    .replace(/\s+/g, " ")
    .trim();

const toSetList = (values: Iterable<string>): string =>
  Array.from(new Set(Array.from(values).map(sanitize).filter(Boolean)))
    .sort((a, b) => a.localeCompare(b))
    .join(",");

const readJsonFile = async <T>(relativePath: string): Promise<T> => {
  const absolutePath = path.join(generatedRoot, relativePath);
  const raw = await readFile(absolutePath, "utf8").catch(() => {
    throw new Error(`Missing required generated file: ${absolutePath}`);
  });
  return JSON.parse(raw) as T;
};

const buildSongLines = (songs: SongRecord[]): string[] =>
  songs
    .map((song) =>
      [
        sanitize(song.lyrics_title),
        sanitize(song.summary_short),
        sanitize(song.sutra),
        sanitize(song.topic),
        sanitize(song.intention),
        sanitize(song.light_shadow),
        sanitize(song.url_slug),
        sanitize(song.lyrics_extract),
        sanitize(song.cover ? "true" : "false"),
        sanitize(song.public_domain ? "true" : "false"),
      ].join(" | "),
    )
    .filter((line) => line.split(" | ").some((part) => part.length > 0))
    .sort((a, b) => a.localeCompare(b));

const buildTrackLines = (tracks: TrackRecord[]): string[] => {
  const grouped = new Map<
    string,
    { count: number; genres: Set<string>; moods: Set<string>; tempos: Set<string>; instruments: Set<string> }
  >();

  for (const track of tracks) {
    const title = sanitize(track.lyrics_title);
    if (!title) continue;
    const current = grouped.get(title) ?? {
      count: 0,
      genres: new Set<string>(),
      moods: new Set<string>(),
      tempos: new Set<string>(),
      instruments: new Set<string>(),
    };
    current.count += 1;
    for (const genre of track.genres ?? []) current.genres.add(sanitize(genre));
    current.moods.add(sanitize(track.mood));
    current.tempos.add(sanitize(track.tempo_feel));
    for (const instrument of track.instruments ?? []) current.instruments.add(sanitize(instrument));
    grouped.set(title, current);
  }

  return Array.from(grouped.entries())
    .map(([title, data]) =>
      [
        title,
        `${data.count}trk`,
        toSetList(data.genres),
        toSetList(data.moods),
        toSetList(data.tempos),
        toSetList(data.instruments),
      ].join(" | "),
    )
    .sort((a, b) => a.localeCompare(b));
};

const buildTrackFacetCounts = (tracks: TrackRecord[]): TrackFacetCounts => {
  const mood: Record<string, number> = {};
  const primary_genre: Record<string, number> = {};
  const genre: Record<string, number> = {};
  const instrument: Record<string, number> = {};

  for (const track of tracks) {
    const moodKey = sanitize(track.mood).toUpperCase();
    if (moodKey) mood[moodKey] = (mood[moodKey] ?? 0) + 1;

    const primaryGenre = sanitize(track.primary_genre).toUpperCase();
    if (primaryGenre) primary_genre[primaryGenre] = (primary_genre[primaryGenre] ?? 0) + 1;

    for (const value of track.genres ?? []) {
      const key = sanitize(value).toUpperCase();
      if (!key) continue;
      genre[key] = (genre[key] ?? 0) + 1;
    }

    for (const value of track.instruments ?? []) {
      const key = sanitize(value).toUpperCase();
      if (!key) continue;
      instrument[key] = (instrument[key] ?? 0) + 1;
    }
  }

  return { mood, primary_genre, genre, instrument };
};

const buildVideoLines = (videosByLyricsId: Record<string, VideoRecord[]>): string[] => {
  const lines: string[] = [];
  for (const entries of Object.values(videosByLyricsId)) {
    if (!entries.length) continue;
    const title = sanitize(entries[0].lyrics_title);
    if (!title) continue;
    const genres = new Set<string>();
    let hasFeatured = false;
    for (const video of entries) {
      genres.add(sanitize(video.genre_primary));
      const secondary = sanitize(video.genre_secondary);
      if (secondary) secondary.split(",").map((item) => genres.add(sanitize(item)));
      hasFeatured ||= Boolean(video.video_featured);
    }
    lines.push([title, `${entries.length}vid`, toSetList(genres), `feat:${hasFeatured ? "yes" : "no"}`].join(" | "));
  }
  return lines.sort((a, b) => a.localeCompare(b));
};

const buildSongbookLines = (songbooks: SongbookRecord[]): string[] =>
  songbooks
    .map((songbook) =>
      [
        sanitize(songbook.songbook),
        sanitize(songbook.description),
        sanitize(songbook.sutras),
        sanitize(songbook.topics_primary),
        sanitize(songbook.url_slug_songbook),
      ].join(" | "),
    )
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));

const buildQuoteLines = (quotes: QuoteRecord[]): string[] =>
  quotes
    .map((quote) => [sanitize(quote.quote), sanitize(quote.muse), sanitize(quote.primary_sutra)].join(" | "))
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));

const buildMuseLines = (muses: MuseRecord[]): string[] =>
  muses
    .map((muse) => [sanitize(muse.muse), sanitize(muse.type_category), sanitize(muse.core_sutra), sanitize(muse.themes)].join(" | "))
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));

const lineTitle = (line: string): string => line.split(" | ")[0]?.trim() ?? "";

const main = async (): Promise<void> => {
  const songs = await readJsonFile<SongRecord[]>("song_catalog.json");
  const tracks = await readJsonFile<TrackRecord[]>("track_catalog.json");
  const videos = await readJsonFile<Record<string, VideoRecord[]>>("youtube_by_lyrics_id.json");
  const songbooks = await readJsonFile<SongbookRecord[]>("songbook_catalog.json");
  const quotes = await readJsonFile<QuoteRecord[]>("quotes_wall.json");
  const muses = await readJsonFile<MuseRecord[]>("muses_catalog.json");

  const songLines = buildSongLines(songs);
  const trackLines = buildTrackLines(tracks);
  const videoLines = buildVideoLines(videos);
  const songTitles = new Set(songLines.map(lineTitle).filter(Boolean));
  const missingTrackTitles = trackLines.map(lineTitle).filter((title) => title && !songTitles.has(title));
  const missingVideoTitles = videoLines.map(lineTitle).filter((title) => title && !songTitles.has(title));
  if (missingTrackTitles.length || missingVideoTitles.length) {
    const uniq = (values: string[]) => Array.from(new Set(values));
    const detail = [
      missingTrackTitles.length ? `track titles missing from songs: ${uniq(missingTrackTitles).join(", ")}` : "",
      missingVideoTitles.length ? `video titles missing from songs: ${uniq(missingVideoTitles).join(", ")}` : "",
    ]
      .filter(Boolean)
      .join(" | ");
    throw new Error(`Song title join assertion failed: ${detail}`);
  }

  const payload = {
    songs: songLines.join("\n"),
    tracks: trackLines.join("\n"),
    trackFacetCounts: JSON.stringify(buildTrackFacetCounts(tracks)),
    videos: videoLines.join("\n"),
    songbooks: buildSongbookLines(songbooks).join("\n"),
    quotes: buildQuoteLines(quotes).join("\n"),
    muses: buildMuseLines(muses).join("\n"),
  };

  const content =
    `export interface LibraryInjects {\n` +
    `  songs: string;\n` +
    `  tracks: string;\n` +
    `  trackFacetCounts?: string;\n` +
    `  videos: string;\n` +
    `  songbooks: string;\n` +
    `  quotes: string;\n` +
    `  muses: string;\n` +
    `}\n\n` +
    `// AUTO-GENERATED by scripts/build-library-data.ts. Do not hand-edit.\n` +
    `export const LIBRARY_INJECTS: LibraryInjects = ${JSON.stringify(payload, null, 2)};\n`;

  await writeFile(outputFile, content, "utf8");
  process.stdout.write(`Generated library injects at ${outputFile}\n`);
};

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
