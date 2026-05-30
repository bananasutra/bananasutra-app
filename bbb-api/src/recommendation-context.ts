import type { ChatMessage } from "./claude-client";
import type { LibraryInjects } from "./library-data";

export type BbbPageContext = {
  pathname: string;
  search?: string;
};

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
  primaryGenres: string[];
  instruments: string[];
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
  { pattern: /\b(?:lonely|alone)\b/i, keyword: "loneliness" },
  { pattern: /\b(?:panic|afraid|scared)\b/i, keyword: "fear" },
  { pattern: /\boverwhelm(?:ed)?\b/i, keyword: "overwhelm" },
  { pattern: /\blost\b/i, keyword: "lost" },
  { pattern: /\b(?:grief|grieving)\b/i, keyword: "grief" },
];

const FUN_PATTERNS: RegExp[] = [/\bfun\b/i, /\bhumou?r\b/i, /\babsurd(?:ity)?\b/i, /\bplayful|silly|weird\b/i];
const SUPPORT_STABILIZING_PATTERNS: RegExp[] = [
  /\b(?:hope|heal(?:ing)?|steady|calm|peace|kind(?:ness)?|gentle|trust|courage|light|breathe|prayer|grace)\b/i,
];
// NOTE: intentional editorial bias in support ranking; keep this list explicit and review periodically.
const SUPPORT_AVOID_TOPICAL = ["maga", "trump", "felon"] as const;
const SUPPORT_AGITATING_PATTERNS: RegExp[] = [
  new RegExp(`\\b(?:panic|war|outrage|rage|doom|nightmare|anxiety|${SUPPORT_AVOID_TOPICAL.join("|")})\\b`, "i"),
];
const SUPPORT_PREFERRED_MOODS = ["KINDLY", "HOLY", "PEACHY", "RAINY"];
// Manual maintenance list until explicit-content metadata is added to the source catalog.
const EXPLICIT_CONTENT_SLUGS = new Set(["freee-la-fille"]);
const EXPLICIT_INTENT_PATTERN = /\bexplicit|nsfw|adult|dirty|raw|edgy|sexual|breakup|dark\b/i;
const BROAD_SOUND_PATTERN = /\b(texture|textural|vibe|sonic|soundscape|layer(?:ed|ing)?)\b/i;
const SURPRISE_PATTERN = /\b(surprise me|i dunno|i don't know|you choose|anything)\b/i;

const splitPipe = (line: string): string[] => line.split("|").map((part) => part.trim());
const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const parseTrackCount = (raw: string): number => {
  const match = raw.match(/^(\d+)/);
  return match ? Number.parseInt(match[1] ?? "0", 10) : 0;
};

const hashSeed = (seed: string): number => {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0);
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
      primaryGenres: (parts[2] ?? "")
        .split(",")
        .map((g) => g.trim().toUpperCase())
        .filter(Boolean),
      moods: (parts[3] ?? "")
        .split(",")
        .map((m) => m.trim())
        .filter(Boolean),
      instruments: (parts[5] ?? "")
        .split(",")
        .map((i) => i.trim().toUpperCase())
        .filter(Boolean),
    });
  }
  return byTitle;
};

const detectRequestedTrackFacets = (queryLower: string, tracksByTitle: Map<string, TrackMeta>): TrackFacetIntent => {
  const moods = new Set<string>();
  const primaryGenres = new Set<string>();
  const instruments = new Set<string>();

  const moodPool = new Set<string>();
  const genrePool = new Set<string>();
  const instrumentPool = new Set<string>();
  for (const track of tracksByTitle.values()) {
    for (const mood of track.moods) moodPool.add(mood.toUpperCase());
    for (const genre of track.primaryGenres) genrePool.add(genre.toUpperCase());
    for (const instrument of track.instruments) instrumentPool.add(instrument.toUpperCase());
  }

  for (const mood of moodPool) {
    if (new RegExp(`\\b${escapeRegExp(mood.toLowerCase())}\\b`, "i").test(queryLower)) moods.add(mood);
  }
  for (const genre of genrePool) {
    if (new RegExp(`\\b${escapeRegExp(genre.toLowerCase())}\\b`, "i").test(queryLower)) primaryGenres.add(genre);
  }
  for (const instrument of instrumentPool) {
    if (new RegExp(`\\b${escapeRegExp(instrument.toLowerCase())}\\b`, "i").test(queryLower)) instruments.add(instrument);
  }

  return { moods, primaryGenres, instruments };
};

const parseTrackFacetCounts = (injects: LibraryInjects): TrackFacetCounts | null => {
  if (!injects.trackFacetCounts?.trim()) return null;
  try {
    const parsed = JSON.parse(injects.trackFacetCounts) as Partial<TrackFacetCounts>;
    if (!parsed || typeof parsed !== "object") return null;
    return {
      mood: parsed.mood ?? {},
      primary_genre: parsed.primary_genre ?? {},
      genre: parsed.genre ?? {},
      instrument: parsed.instrument ?? {},
    };
  } catch {
    return null;
  }
};

const getFacetCount = (
  facetCounts: TrackFacetCounts | null,
  facet: keyof TrackFacetCounts,
  key: string | undefined,
): number | undefined => {
  if (!facetCounts || !key) return undefined;
  const normalized = key.toUpperCase();
  const value = facetCounts[facet][normalized];
  return typeof value === "number" && value > 0 ? value : undefined;
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
  trackCount?: number;
};

type TrackFacetIntent = {
  moods: Set<string>;
  primaryGenres: Set<string>;
  instruments: Set<string>;
};

type TrackFacetCounts = {
  mood: Record<string, number>;
  primary_genre: Record<string, number>;
  genre: Record<string, number>;
  instrument: Record<string, number>;
};

const inferPageType = (pageContext?: BbbPageContext): "tracks" | "songbook" | "song" | "other" => {
  const pathname = pageContext?.pathname ?? "";
  if (pathname.startsWith("/tracks")) return "tracks";
  if (pathname.startsWith("/songbooks")) return "songbook";
  if (pathname.startsWith("/songs")) return "song";
  return "other";
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
  requestedTrackFacets: TrackFacetIntent,
): RankedSong => {
  const trackMeta = tracksByTitle.get(song.title);
  const trackCount = trackMeta?.count ?? 0;
  const trackMoods = trackMeta?.moods.map((mood) => mood.toUpperCase()) ?? [];
  const trackPrimaryGenres = trackMeta?.primaryGenres ?? [];
  const trackInstruments = trackMeta?.instruments ?? [];
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
    if (SUPPORT_STABILIZING_PATTERNS.some((pattern) => pattern.test(haystack))) score += 12;
    if (SUPPORT_AGITATING_PATTERNS.some((pattern) => pattern.test(haystack))) score -= 16;
    if (song.sutra === "FLOWSUTRA" || song.sutra === "GROWSUTRA") score += 10;
    if (song.sutra === "GLOWSUTRA") score += 4;
    if (song.sutra === "KNOWSUTRA" || song.sutra === "SHOWSUTRA") score -= 2;
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
    if (trackMoods.includes("FRENCHY")) score += 26;
    if (/(french|francais|français|paris|camus)/i.test(haystack)) score += 16;
    else score -= 6;
  }

  if (
    requestedTrackFacets.moods.size ||
    requestedTrackFacets.primaryGenres.size ||
    requestedTrackFacets.instruments.size
  ) {
    for (const mood of requestedTrackFacets.moods) {
      if (trackMoods.includes(mood)) score += 14;
    }
    for (const genre of requestedTrackFacets.primaryGenres) {
      if (trackPrimaryGenres.includes(genre)) score += 12;
    }
    for (const instrument of requestedTrackFacets.instruments) {
      if (trackInstruments.includes(instrument)) score += 10;
    }
  }

  if (!EXPLICIT_INTENT_PATTERN.test(queryLower) && EXPLICIT_CONTENT_SLUGS.has(song.slug)) {
    score -= 18;
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

export const buildRecommendationContext = (
  messages: ChatMessage[],
  injects: LibraryInjects,
  pageContext?: BbbPageContext,
  diversitySeed?: string,
): string => {
  const latestUser = [...messages].reverse().find((message) => message.role === "user")?.content?.trim();
  if (!latestUser) return "";
  const hasPriorAssistantTurn = messages.slice(0, -1).some((message) => message.role === "assistant");
  const pageType = inferPageType(pageContext);
  const pageRoute = `${pageContext?.pathname ?? ""}${pageContext?.search ?? ""}`.trim();
  const pageSearch = pageContext?.search ?? "";
  const pageParams = new URLSearchParams(pageSearch.startsWith("?") ? pageSearch.slice(1) : pageSearch);
  const currentMood = (pageParams.get("mood") ?? "").trim().toUpperCase();
  const isAlreadyFrenchTracks = pageType === "tracks" && currentMood === "FRENCHY";

  const queryLower = latestUser.toLowerCase();
  const broadSoundIntent = BROAD_SOUND_PATTERN.test(queryLower);
  const surpriseIntent = SURPRISE_PATTERN.test(queryLower);
  const trackExplorationIntent = /\b(track|tracks|listen|listening|music|mood|genre|instrument)\b/i.test(latestUser);
  const support = analyzeSupportIntent(latestUser);
  const intent = analyzeIntent(latestUser);
  if (
    !support.supportIntent &&
    !intent.funIntent &&
    !broadSoundIntent &&
    !/\bsong|listen|track|music|video|recommend|suggest\b/i.test(latestUser)
  ) {
    return "";
  }

  const songs = parseSongs(injects);
  const tracksByTitle = parseTracks(injects);
  const trackFacetCounts = parseTrackFacetCounts(injects);
  const videosByTitle = parseVideos(injects);
  const requestedTrackFacets = detectRequestedTrackFacets(queryLower, tracksByTitle);
  const songbooks = parseSongbooks(injects);
  const ranked = songs
    .map((song) => scoreSong(song, tracksByTitle, videosByTitle, support, intent, queryLower, requestedTrackFacets))
    .sort((a, b) => b.score - a.score || a.song.title.localeCompare(b.song.title));

  const playable = ranked.filter((row) => row.trackCount > 0 || row.videoCount > 0);
  const lyricsOnly = ranked.filter((row) => row.trackCount === 0 && row.videoCount === 0);

  const shortlist: RankedSong[] = [];
  shortlist.push(...playable.slice(0, 4));
  if (lyricsOnly.length > 0) shortlist.push(lyricsOnly[0]);
  shortlist.push(...playable.slice(4));
  const rankedBase = (shortlist.length ? shortlist : lyricsOnly).slice(0, 12);
  let topRanked = rankedBase.slice(0, 6);
  // Rotate strong candidates for broad sound asks so repeated refreshes do not anchor to the same song pair.
  if ((broadSoundIntent || trackExplorationIntent) && diversitySeed && rankedBase.length > 2) {
    const offset = hashSeed(`${diversitySeed}:${queryLower}`) % rankedBase.length;
    const rotated = [...rankedBase.slice(offset), ...rankedBase.slice(0, offset)];
    topRanked = rotated.slice(0, 6);
  }
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
  const genrePool = new Set<string>();
  const instrumentPool = new Set<string>();
  for (const track of tracksByTitle.values()) {
    for (const mood of track.moods) moodPool.add(mood);
    for (const genre of track.primaryGenres) genrePool.add(genre);
    for (const instrument of track.instruments) instrumentPool.add(instrument);
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
  if (support.supportIntent) {
    for (const mood of [...SUPPORT_PREFERRED_MOODS].reverse()) {
      if (Array.from(moodPool).includes(mood) && !moodCandidates.includes(mood)) {
        moodCandidates.unshift(mood);
      }
    }
  }
  const preferredTextureGenres = ["DUB", "JAZZ", "LOFI", "BLUES", "WORLD"];
  const preferredTextureMoods = ["TRIPPY", "RAINY", "NERDY", "KINDLY"];
  const preferredTextureInstruments = ["CELLO", "ACCORDION", "GUITAR", "BRASS", "PIANO"];
  const broadMood = preferredTextureMoods.find((mood) => moodPool.has(mood)) ?? moodCandidates[0];
  const broadGenre = preferredTextureGenres.find((genre) => genrePool.has(genre));
  const broadInstrument = preferredTextureInstruments.find((instrument) => instrumentPool.has(instrument));

  let songbookCandidates = songbooks
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
    if (langFrench) {
      songbookCandidates = [langFrench, ...songbookCandidates.filter((book) => book.slug !== langFrench.slug)];
    }
  }
  if (support.supportIntent) {
    const supportBooks = songbooks.filter((book) => /\b(hope|heal|kind|peace|trust|rainbow)\b/i.test(book.title));
    for (const book of supportBooks.slice(0, 2).reverse()) {
      if (!songbookCandidates.some((candidate) => candidate.slug === book.slug)) {
        songbookCandidates.unshift(book);
      }
    }
  }

  const listeningRoutes: ListeningRouteHint[] = [];
  const trackRouteHints: ListeningRouteHint[] = [];
  const songbookRouteHints: ListeningRouteHint[] = [];
  if (broadSoundIntent) {
    if (broadMood) {
      const moodTrackCount = getFacetCount(trackFacetCounts, "mood", broadMood);
      trackRouteHints.push({
        label: `${broadMood} Mood Tracks`,
        href: `/tracks/?mood=${encodeURIComponent(broadMood)}&tsort=likes`,
        kind: "tracks",
        trackCount: moodTrackCount,
      });
    }
    if (broadInstrument) {
      const instrumentTrackCount = getFacetCount(trackFacetCounts, "instrument", broadInstrument);
      trackRouteHints.push({
        label: `${broadInstrument} Instrument Tracks`,
        href: `/tracks/?instrument=${encodeURIComponent(broadInstrument)}&tsort=likes`,
        kind: "tracks",
        trackCount: instrumentTrackCount,
      });
    }
    if (broadGenre) {
      const primaryGenreCount = getFacetCount(trackFacetCounts, "primary_genre", broadGenre);
      const anyGenreCount = getFacetCount(trackFacetCounts, "genre", broadGenre);
      const useSearchRoute =
        Boolean(anyGenreCount) && (!primaryGenreCount || (anyGenreCount ?? 0) > (primaryGenreCount ?? 0) * 1.5);
      trackRouteHints.push({
        label: useSearchRoute ? `${broadGenre} Genre Search Tracks` : `${broadGenre} Genre Tracks`,
        href: useSearchRoute
          ? `/tracks/?q=${encodeURIComponent(broadGenre)}&tsort=likes`
          : `/tracks/?primary_genre=${encodeURIComponent(broadGenre)}&tsort=likes`,
        kind: "tracks",
        trackCount: useSearchRoute ? anyGenreCount : primaryGenreCount,
      });
    }
  } else {
    for (const mood of moodCandidates.slice(0, 1)) {
      const href = `/tracks/?mood=${encodeURIComponent(mood)}&tsort=likes`;
      const label = mood === "CHEEKY" ? "Cheeky Mood Tracks" : `${mood} Mood Tracks`;
      const moodTrackCount = getFacetCount(trackFacetCounts, "mood", mood);
      trackRouteHints.push({ label, href, kind: "tracks", trackCount: moodTrackCount });
    }
  }
  for (const book of songbookCandidates.slice(0, 1)) {
    const label = book.slug === "lang-french" ? "French Language Songbook" : `${book.title} Songbook`;
    songbookRouteHints.push({
      label,
      href: `/songbooks/${book.slug}`,
      kind: "songbook",
    });
  }
  if (!trackRouteHints.length && !songbookRouteHints.length) {
    trackRouteHints.push({ label: "Top Tracks", href: "/tracks/?tsort=likes", kind: "tracks" });
  }
  if (pageType === "songbook") {
    listeningRoutes.push(...songbookRouteHints, ...trackRouteHints);
  } else {
    listeningRoutes.push(...trackRouteHints, ...songbookRouteHints);
  }

  return [
    "Dynamic recommendation guidance (apply to this reply):",
    "- Prioritize this ranked shortlist before any lower-ranked songs.",
    "- Keep recommendations emotionally aligned with user intent.",
    pageRoute ? `- User is currently browsing [this page](${pageRoute}). Use this as a hint to keep navigation friction low.` : null,
    isAlreadyFrenchTracks
      ? "- User is already on FRENCHY tracks. Explicitly acknowledge that in your first sentence and avoid presenting it as a new discovery."
      : null,
    "- Meaning-first beats popularity-first. Use popularity only as a soft tie-breaker, and keep room for hidden gems.",
    "- Prefer richer listening options (audio+video) when available, but do not exclude lyrics-only songs if they are meaningful matches.",
    "- Use titled markdown links like [Song Title](/songs/slug).",
    support.supportIntent
      ? "- Because user is in a support/hope context, prefer LIGHT options first unless they explicitly request darker material."
      : "- Prefer playable songs first, then broader exploration options.",
    support.supportIntent
      ? "- Keep LIGHT-first support handling for this reply; do not escalate into heavier SHADOW material unless asked."
      : "- For non-support asks, do not force LIGHT over SHADOW. Use LIGHT/SHADOW as a follow-up calibration question when useful.",
    '- For each recommended song, include one concise "why this might help right now" reason.',
    "- Begin with one short natural sentence that names the sutra angle and links the specific sutra page when known (for example [GLOWsutra](/about/glowsutra)).",
    support.supportIntent
      ? "- For support/hope asks, prefer a stabilizing lens such as [FLOWsutra](/about/flowsutra) or [GROWsutra](/about/growsutra). Use [GLOWsutra](/about/glowsutra) when gratitude is explicitly relevant."
      : "- Keep sutra framing emotionally precise to the ask.",
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
    intent.languageIntentFrench
      ? "- For French asks, use the exact mood name FRENCHY in links/text (not 'Frenchsutra'), and prefer [Frenchy Mood Tracks](/tracks/?mood=FRENCHY&tsort=likes) plus [French Language Songbook](/songbooks/lang-french) when relevant."
      : "- Keep route naming precise and consistent with catalog mood names.",
    pageType === "tracks"
      ? "- User is already in tracks, so make the first listening route a filtered tracks link when relevant."
      : pageType === "songbook"
        ? "- User is already in songbooks, so make the first listening route a relevant songbook when possible."
        : "- User page context is high-signal. Acknowledge it in your first sentence when present, then continue with user intent.",
    "- Route safety: songs must link as /songs/{slug}.",
    "- Route safety: tracks links are list/filter routes with query params (for example /tracks/?mood=RAINY&tsort=likes), never /tracks/{song-slug}.",
    "- Formatting safety: if you name a specific song, link that title to /songs/{slug}, not to any /tracks query link.",
    "- Keep song picks separate from listening routes: song picks use /songs/{slug}; exploration links to /tracks/?... should be presented as separate route options with explicit labels.",
    "- Markdown safety: use exact [Label](/route) syntax only. Never output [Label]((/route)).",
    "- Route-link labels must be human-readable (for example 'Jazz Tracks'), never raw route text.",
    "- Label fidelity rule: every route label must match the href filters exactly. Never claim a blend (for example 'Jazz & Dub') unless both are actually encoded in the URL.",
    "- For /tracks/?primary_genre=<GENRE>, use label shape '<GENRE> Primary Genre Tracks'. For /tracks/?mood=<MOOD>, use '<MOOD> Mood Tracks'. For /tracks/?instrument=<INSTRUMENT>, use '<INSTRUMENT> Instrument Tracks'. For /tracks/?q=<KEYWORD>, use '<KEYWORD> Genre Search Tracks'.",
    "- If discussing cross-genre or secondary-genre exploration, use /tracks/?q=<keyword>&tsort=likes with an explicit search label (for example '<keyword> Search Tracks') instead of mislabeling a primary_genre link.",
    broadSoundIntent
      ? "- The user asked for a broad sound quality (for example texture). Do not dump a long list of genres. Offer 2-3 concrete listening routes max across different filter types: one primary_genre route, one mood route, and one instrument route."
      : null,
    trackExplorationIntent || broadSoundIntent
      ? "- Sound-led hierarchy rule: lead with listening routes first. Song picks are secondary, optional examples."
      : null,
    broadSoundIntent && surpriseIntent
      ? "- User asked to be surprised. Still provide concrete specifics: include at least one mood route, one instrument route, and one genre route when available."
      : null,
    broadSoundIntent
      ? "- Teach the available tracks filters briefly in plain language: primary genre, secondary genre/search, mood, and instrument."
      : null,
    broadSoundIntent
      ? "- Mention that primary genre is exact genre filtering, while broader/secondary texture discovery can use /tracks/?q=<keyword>&tsort=likes."
      : null,
    trackExplorationIntent || broadSoundIntent
      ? "- MUST include one teach-to-fish line: tell the user they can refine with mood + instrument + primary genre, and use track search (/tracks/?q=...) for secondary/cross-genre exploration."
      : null,
    broadSoundIntent
      ? "- Clarify framing briefly: Bananasutra is meaning-first at the song level; /tracks is a listening-flow lens for sound exploration."
      : null,
    "- Count safety: include route counts only when the facet count is exact from known track-level data; otherwise omit the count.",
    !EXPLICIT_INTENT_PATTERN.test(queryLower)
      ? "- Avoid leading with explicit/adult-coded songs unless user explicitly asks for that intensity. If included, add a short mature-content note."
      : "- User asked for intensity/explicit edge, so stronger material is acceptable when contextually aligned.",
    "- Never show raw route text in prose. Use titled markdown links for songs and listening routes.",
    intent.exhaustiveListIntent
      ? "- User asked for all relevant songs, so provide a broader concise list from this ranked shortlist (up to 8), not only 2-3."
      : "- Keep it concise and scannable, never a wall of text. Concise does not mean cold, a warm sentence is fine. Aim for 3-5 short bullets max.",
    "- Offer an optional follow-up to explore all relevant songs if user wants more.",
    listeningRoutes.length
      ? `- When useful, include one listening-first route option from: ${listeningRoutes
          .map((route) => {
            const labelWithCount =
              route.kind === "tracks" && route.trackCount && route.trackCount > 0
                ? `${route.label} (${route.trackCount} tracks)`
                : route.label;
            return `[${labelWithCount}](${route.href})`;
          })
          .join(" or ")}`
      : "- When useful, include one listening-first route option from /tracks (mood+sort) or a relevant /songbooks/{slug} page.",
    "",
    "Ranked shortlist:",
    ...lines,
  ]
    .filter((line): line is string => Boolean(line))
    .join("\n");
};
