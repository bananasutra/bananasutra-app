import type { ChatMessage } from "./claude-client";
import type { LibraryInjects } from "./library-data";

type SongMeta = {
  title: string;
  summary: string;
  sutra: string;
  topic: string;
  intention: string;
  lightShadow: string;
  slug: string;
};

type TrackMeta = {
  count: number;
  moods: string[];
};

type VideoMeta = {
  count: number;
  featured: boolean;
};

type SupportSignal = {
  supportIntent: boolean;
  keywords: string[];
};

type IntentSignal = {
  funIntent: boolean;
  languageIntentFrench: boolean;
  hiddenGemIntent: boolean;
  exhaustiveListIntent: boolean;
};

const SUPPORT_PATTERNS: Array<{ pattern: RegExp; keyword: string }> = [
  { pattern: /\bhope\b/i, keyword: "hope" },
  { pattern: /\bheal(?:ing)?\b/i, keyword: "healing" },
  { pattern: /\banx(?:ious|iety)\b/i, keyword: "anxiety" },
  { pattern: /\bdepress(?:ed|ion)\b/i, keyword: "depression" },
  { pattern: /\bsad(?:ness)?\b/i, keyword: "sadness" },
  { pattern: /\blonely|alone\b/i, keyword: "loneliness" },
  { pattern: /\bpanic|afraid|scared\b/i, keyword: "fear" },
  { pattern: /\boverwhelm(?:ed)?\b/i, keyword: "overwhelm" },
  { pattern: /\blost\b/i, keyword: "lost" },
  { pattern: /\bgrief|grieving\b/i, keyword: "grief" },
];

const FUN_PATTERNS: RegExp[] = [/\bfun\b/i, /\bhumou?r\b/i, /\babsurd(?:ity)?\b/i, /\bplayful|silly|weird\b/i];

const splitPipe = (line: string): string[] => line.split("|").map((part) => part.trim());

const parseTrackCount = (raw: string): number => {
  const match = raw.match(/^(\d+)/);
  return match ? Number.parseInt(match[1] ?? "0", 10) : 0;
};

const parseSongs = (injects: LibraryInjects): SongMeta[] =>
  injects.songs
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = splitPipe(line);
      return {
        title: parts[0] ?? "",
        summary: parts[1] ?? "",
        sutra: (parts[2] ?? "").toUpperCase(),
        topic: parts[3] ?? "",
        intention: parts[4] ?? "",
        lightShadow: (parts[5] ?? "").toUpperCase(),
        slug: parts[6] ?? "",
      };
    })
    .filter((song) => Boolean(song.title && song.slug));

const parseTracks = (injects: LibraryInjects): Map<string, TrackMeta> => {
  const byTitle = new Map<string, TrackMeta>();
  for (const line of injects.tracks.split("\n").map((x) => x.trim()).filter(Boolean)) {
    const parts = splitPipe(line);
    const title = parts[0] ?? "";
    if (!title) continue;
    byTitle.set(title, {
      count: parseTrackCount(parts[1] ?? ""),
      moods: (parts[3] ?? "")
        .split(",")
        .map((m) => m.trim())
        .filter(Boolean),
    });
  }
  return byTitle;
};

const parseVideos = (injects: LibraryInjects): Map<string, VideoMeta> => {
  const byTitle = new Map<string, VideoMeta>();
  for (const line of injects.videos.split("\n").map((x) => x.trim()).filter(Boolean)) {
    const parts = splitPipe(line);
    const title = parts[0] ?? "";
    if (!title) continue;
    byTitle.set(title, {
      count: parseTrackCount(parts[1] ?? ""),
      featured: (parts[3] ?? "").toLowerCase() === "feat:yes",
    });
  }
  return byTitle;
};

const analyzeSupportIntent = (text: string): SupportSignal => {
  const keywords = SUPPORT_PATTERNS.filter(({ pattern }) => pattern.test(text)).map(({ keyword }) => keyword);
  return { supportIntent: keywords.length > 0, keywords };
};

const analyzeIntent = (text: string): IntentSignal => ({
  funIntent: FUN_PATTERNS.some((pattern) => pattern.test(text)),
  languageIntentFrench: /\bfrench|francais|français\b/i.test(text),
  hiddenGemIntent: /\bhidden\s+gems?\b|\bgems?\b/i.test(text),
  exhaustiveListIntent: /\b(all|every|full|complete)\b/i.test(text),
});

type RankedSong = {
  song: SongMeta;
  score: number;
  trackCount: number;
  videoCount: number;
  featured: boolean;
};

type SongbookMeta = {
  title: string;
  sutra: string;
  slug: string;
};

type ListeningRouteHint = {
  label: string;
  href: string;
  kind: "tracks" | "songbook";
};

const parseSongbooks = (injects: LibraryInjects): SongbookMeta[] =>
  injects.songbooks
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = splitPipe(line);
      return {
        title: parts[0] ?? "",
        sutra: (parts[2] ?? "").toUpperCase(),
        slug: parts[4] ?? "",
      };
    })
    .filter((row) => Boolean(row.title && row.slug));

const scoreSong = (
  song: SongMeta,
  tracksByTitle: Map<string, TrackMeta>,
  videosByTitle: Map<string, VideoMeta>,
  support: SupportSignal,
  intent: IntentSignal,
  queryLower: string,
): RankedSong => {
  const trackCount = tracksByTitle.get(song.title)?.count ?? 0;
  const trackMoods = tracksByTitle.get(song.title)?.moods ?? [];
  const video = videosByTitle.get(song.title);
  const videoCount = video?.count ?? 0;
  const featured = video?.featured ?? false;
  const hasPlayable = trackCount > 0 || videoCount > 0;
  const haystack = `${song.title} ${song.summary} ${song.topic} ${song.intention}`.toLowerCase();

  let score = 0;
  if (hasPlayable) score += 55;
  score += Math.min(trackCount, 10) * 1.2;
  score += Math.min(videoCount, 8) * 1.0;
  if (featured) score += 3;
  if (trackCount > 0 && videoCount > 0) score += 10;
  const playableCount = trackCount + videoCount;
  if (playableCount > 0 && playableCount <= 3) score += 6;

  if (support.supportIntent) {
    if (song.lightShadow === "LIGHT") score += 24;
    if (song.lightShadow === "SHADOW") score -= 12;
    for (const keyword of support.keywords) {
      if (haystack.includes(keyword)) score += 10;
    }
  }

  if (intent.funIntent) {
    if (song.sutra === "SHOWSUTRA") score += 30;
    else score -= 10;
    if (song.lightShadow === "SHADOW") score -= 18;
    if (song.lightShadow === "LIGHT") score += 8;
    if (/\bfun|silly|absurd|laugh|party|playful|cheeky\b/i.test(haystack)) score += 16;
    if (/\bfun\b/i.test(song.title)) score += 12;
  }

  if (intent.languageIntentFrench) {
    if (trackMoods.some((mood) => mood.toUpperCase() === "FRENCHY")) score += 26;
    if (/(french|francais|français|paris|camus)/i.test(haystack)) score += 16;
    else score -= 6;
  }

  if (intent.hiddenGemIntent) {
    if (hasPlayable) {
      if (playableCount <= 3) score += 12;
      else if (playableCount >= 10) score -= 8;
    } else {
      score -= 10;
    }
  }

  const words = queryLower
    .split(/[^a-z0-9]+/)
    .map((word) => word.trim())
    .filter((word) => word.length >= 4);
  for (const word of words.slice(0, 8)) {
    if (haystack.includes(word)) score += 2;
  }

  return { song, score, trackCount, videoCount, featured };
};

export const buildRecommendationContext = (messages: ChatMessage[], injects: LibraryInjects): string => {
  const latestUser = [...messages].reverse().find((message) => message.role === "user")?.content?.trim();
  if (!latestUser) return "";
  const hasPriorAssistantTurn = messages.slice(0, -1).some((message) => message.role === "assistant");

  const queryLower = latestUser.toLowerCase();
  const support = analyzeSupportIntent(latestUser);
  const intent = analyzeIntent(latestUser);
  if (!support.supportIntent && !intent.funIntent && !/\bsong|listen|track|music|video|recommend|suggest\b/i.test(latestUser)) {
    return "";
  }

  const songs = parseSongs(injects);
  const tracksByTitle = parseTracks(injects);
  const videosByTitle = parseVideos(injects);
  const songbooks = parseSongbooks(injects);
  const ranked = songs
    .map((song) => scoreSong(song, tracksByTitle, videosByTitle, support, intent, queryLower))
    .sort((a, b) => b.score - a.score || a.song.title.localeCompare(b.song.title));

  const playable = ranked.filter((row) => row.trackCount > 0 || row.videoCount > 0);
  const lyricsOnly = ranked.filter((row) => row.trackCount === 0 && row.videoCount === 0);

  const shortlist: RankedSong[] = [];
  shortlist.push(...playable.slice(0, 4));
  if (lyricsOnly.length > 0) shortlist.push(lyricsOnly[0]);
  shortlist.push(...playable.slice(4));
  const topRanked = (shortlist.length ? shortlist : lyricsOnly).slice(0, 6);
  if (topRanked.length === 0) return "";

  const lines = topRanked.map((row, idx) => {
    const availability =
      row.trackCount > 0 && row.videoCount > 0
        ? "audio+video"
        : row.trackCount > 0
          ? "audio-only"
          : row.videoCount > 0
            ? "video-only"
            : "lyrics-only";
    const details = `availability:${availability}, tracks:${row.trackCount}, videos:${row.videoCount}${row.featured ? ", featured:yes" : ""}`;
    return `${idx + 1}. ${row.song.title} | ${row.song.slug} | ${row.song.lightShadow || "n/a"} | ${details}`;
  });

  const queryTokens = queryLower
    .split(/[^a-z0-9]+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 4);

  const moodPool = new Set<string>();
  for (const track of tracksByTitle.values()) {
    for (const mood of track.moods) moodPool.add(mood);
  }

  const moodCandidates = Array.from(moodPool)
    .filter((mood) => {
      const moodLower = mood.toLowerCase();
      return queryTokens.some((token) => moodLower.includes(token) || token.includes(moodLower));
    })
    .slice(0, 2);

  if (intent.funIntent && Array.from(moodPool).includes("CHEEKY") && !moodCandidates.includes("CHEEKY")) {
    moodCandidates.unshift("CHEEKY");
  }
  if (intent.languageIntentFrench && Array.from(moodPool).includes("FRENCHY") && !moodCandidates.includes("FRENCHY")) {
    moodCandidates.unshift("FRENCHY");
  }

  const songbookCandidates = songbooks
    .filter((book) => {
      const hay = `${book.title} ${book.slug}`.toLowerCase();
      return queryTokens.some((token) => hay.includes(token));
    })
    .slice(0, 2);
  if (intent.funIntent) {
    const broadShowBooks = songbooks.filter(
      (book) =>
        book.sutra === "SHOWSUTRA" &&
        !/\bb\.?j\b|banana jokes/i.test(book.title) &&
        !/\bb\.?j\b|banana-jokes/i.test(book.slug),
    );
    for (const book of broadShowBooks.slice(0, 2)) {
      if (!songbookCandidates.some((candidate) => candidate.slug === book.slug)) {
        songbookCandidates.unshift(book);
      }
    }
  }
  if (intent.languageIntentFrench) {
    const langFrench = songbooks.find((book) => book.slug === "lang-french");
    if (langFrench && !songbookCandidates.some((book) => book.slug === langFrench.slug)) {
      songbookCandidates.unshift(langFrench);
    }
  }

  const listeningRoutes: ListeningRouteHint[] = [];
  for (const mood of moodCandidates.slice(0, 1)) {
    const href = `/tracks/?mood=${encodeURIComponent(mood)}&tsort=likes`;
    const label = mood === "CHEEKY" ? "Cheeky Mood Tracks" : `${mood} Mood Tracks`;
    listeningRoutes.push({ label, href, kind: "tracks" });
  }
  for (const book of songbookCandidates.slice(0, 1)) {
    listeningRoutes.push({
      label: `${book.title} Songbook`,
      href: `/songbooks/${book.slug}`,
      kind: "songbook",
    });
  }
  if (!listeningRoutes.length) {
    listeningRoutes.push({ label: "Top Tracks", href: "/tracks/?tsort=likes", kind: "tracks" });
  }

  return [
    "Dynamic recommendation guidance (apply to this reply):",
    "- Prioritize this ranked shortlist before any lower-ranked songs.",
    "- Keep recommendations emotionally aligned with user intent.",
    "- Meaning-first beats popularity-first. Use popularity only as a soft tie-breaker, and keep room for hidden gems.",
    "- Prefer richer listening options (audio+video) when available, but do not exclude lyrics-only songs if they are meaningful matches.",
    "- Use titled markdown links like [Song Title](/songs/slug).",
    support.supportIntent
      ? "- Because user is in a support/hope context, prefer LIGHT options first unless they explicitly request darker material."
      : "- Prefer playable songs first, then broader exploration options.",
    '- For each recommended song, include one concise "why this might help right now" reason.',
    "- Begin with one short natural sentence that names the sutra angle and links the specific sutra page when known (for example [GLOWsutra](/about/glowsutra)).",
    intent.funIntent
      ? "- This user asked for fun/absurd energy: anchor the lens on [SHOWsutra](/about/showsutra) and say that clearly."
      : "- Name the likely sutra lens clearly.",
    "- Do not repeat your identity intro if it already appeared earlier in this chat.",
    hasPriorAssistantTurn
      ? '- This is not the first turn. Start with one short natural acknowledgement of the ask (for example "Great fun question"), then continue directly. No identity re-intro and no generic greeting opener like "Welcome" or "Hey".'
      : "- If this is the first turn, keep the opening intro concise.",
    '- Do not assume profile/history facts you cannot know. Never claim "first visit", "first time here", or "new user" unless the user explicitly says it.',
    '- Keep it conversational and concise with short natural sentences, not label-style blocks like "Sutra lens:".',
    "- Keep the distinction explicit in plain language: one short segue sentence introducing the song picks, then one separate listening-flow sentence.",
    "- In the listening-flow sentence, explain briefly that songbooks are topic-led collections and tracks are mood-led continuous listening.",
    "- Do not reuse the same individual song links in the listening-flow sentence; use /tracks or /songbooks routes for continuous listening.",
    "- Never show raw route text in prose. Use titled markdown links for songs and listening routes.",
    intent.exhaustiveListIntent
      ? "- User asked for all relevant songs, so provide a broader concise list from this ranked shortlist (up to 8), not only 2-3."
      : "- Keep it concise: 3-5 short bullets max, no long paragraphs.",
    "- Offer an optional follow-up to explore all relevant songs if user wants more.",
    listeningRoutes.length
      ? `- When useful, include one listening-first route option from: ${listeningRoutes
          .map((route) => `[${route.label}](${route.href})`)
          .join(" or ")}`
      : "- When useful, include one listening-first route option from /tracks (mood+sort) or a relevant /songbooks/{slug} page.",
    "",
    "Ranked shortlist:",
    ...lines,
  ].join("\n");
};
