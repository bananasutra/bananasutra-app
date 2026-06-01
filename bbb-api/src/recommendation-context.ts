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
  lyricsExtract: string;
  isCover: boolean;
  isPublicDomain: boolean;
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
  soundLedIntent: boolean;
  breadthLedIntent: boolean;
};

type PageType =
  | "tracks"
  | "songbook"
  | "song-detail"
  | "sutras-overview"
  | "sutra-page"
  | "muses"
  | "quotes"
  | "about"
  | "other";

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
const LYRICS_ONLY_INTENT_PATTERN = /\b(lyrics[- ]only|words[- ]only|poem|just the words|no audio)\b/i;
const COVER_OR_PD_INTENT_PATTERN = /\b(cover|covers|public\s+domain|traditional)\b/i;
const BROAD_SOUND_PATTERN = /\b(texture|textural|vibe|sonic|soundscape|layer(?:ed|ing)?)\b/i;
const SURPRISE_PATTERN = /\b(surprise me|i dunno|i don't know|you choose|anything)\b/i;
const SUTRA_PAGE_PATH_PATTERN = /^\/about\/([a-z]+sutra)\/?$/i;
const SOUND_GENRE_TERMS = [
  "blues",
  "burlesque",
  "circus",
  "dub",
  "flamenco",
  "folk",
  "gipsy",
  "hip hop",
  "indie",
  "jazz",
  "lofi",
  "mantra",
  "motorik",
  "psychedelic",
  "ragga",
  "rock",
  "tango",
  "techno",
  "waltz",
  "world",
] as const;
const SOUND_INSTRUMENT_TERMS = [
  "accordion",
  "banjo",
  "bass",
  "brass",
  "cello",
  "clarinet",
  "drum",
  "drums",
  "fiddle",
  "guitar",
  "harmonica",
  "piano",
  "voice",
  "xylophone",
] as const;
const SOUND_TEMPO_TERMS = ["upbeat", "midbeat", "lowbeat", "dance", "dancing", "slow", "tempo"] as const;
const SOUND_MOOD_TERMS = ["rainy", "cheeky", "trippy", "frenchy", "kindly", "punky"] as const;
const BREADTH_LED_PATTERN =
  /\b(list|show|give).*\b(all|everything|every)\b|\bwhat (are|is) your\b.*\b(all|everything)\b|\beverything by\b/i;
const SUTRA_TAGS = ["knowsutra", "blowsutra", "showsutra", "growsutra", "flowsutra", "glowsutra", "bowsutra", "quacksutra"] as const;
const EXPLICIT_DELIVERY_PATTERNS: RegExp[] = [
  /\b(give me|recommend|suggest|show me)\b/i,
  /\bokay,?\s+(give|show|let)\b/i,
  /\bwhat (should i|do you recommend)\b/i,
  /\bi want\b/i,
  /\bplaylists?\b/i,
  /\bserve\b.*\b(soul|ears?)\b/i,
];
const FAVORITE_SONG_PATTERN = /\b(favou?rite|best)\b.*\bsong\b|\bwhat'?s your favou?rite\b/i;
const SONG_LINK_SLUG_PATTERN = /\/songs\/([a-z0-9-]+)/gi;
const ORIENTATION_ASK_PATTERN =
  /\b(what is this place|what's this place|where should i start|how does this work|how do i explore|what can i do here)\b/i;
const FEEDBACK_CONTACT_PATTERN =
  /\b(feedback|contact|get in touch|reach (you|the creator)|song idea|leave a message)\b/i;
const FRENCH_INTENT_PATTERN = /\b(french|francais|français|francaise|française|francophone)\b/i;
const RECOMMENDATION_CUE_PATTERN =
  /\b(song|songs|track|tracks|music|video|recommend|suggest|playlist|playlists|musique|chanson|chansons|recommande(?:r|z|s)?|suggestion|suggestions)\b/i;

const splitPipe = (line: string): string[] => line.split("|").map((part) => part.trim());
const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const termToPattern = (term: string): RegExp =>
  new RegExp(`\\b${escapeRegExp(term).replace(/\\ /g, "\\s+")}\\b`, "i");
const anyTermMatch = (text: string, terms: readonly string[]): boolean =>
  terms.some((term) => termToPattern(term).test(text));
const firstMatchedTerm = (text: string, terms: readonly string[]): string | null => {
  for (const term of terms) {
    if (termToPattern(term).test(text)) return term;
  }
  return null;
};
const detectSutraInQuery = (queryLower: string): string | null => {
  const hit = SUTRA_TAGS.find((sutra) => queryLower.includes(sutra));
  return hit ?? null;
};
const extractPreviouslyRecommendedSlugs = (messages: ChatMessage[]): string[] => {
  const slugs = new Set<string>();
  for (const message of messages) {
    if (message.role !== "assistant") continue;
    for (const match of message.content.matchAll(SONG_LINK_SLUG_PATTERN)) {
      const slug = (match[1] ?? "").trim().toLowerCase();
      if (slug) slugs.add(slug);
    }
  }
  return Array.from(slugs);
};

const parseTrackCount = (raw: string): number => {
  const match = raw.match(/^(\d+)/);
  return match ? Number.parseInt(match[1] ?? "0", 10) : 0;
};

const SUPPORT_CONTEXT_AVOID_SLUGS = new Set(["when-we-duende-all-night"]);
const clipText = (text: string, maxLength: number): string => {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trim()}…`;
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
        lyricsExtract: parts[7] ?? "",
        isCover: (parts[8] ?? "").toLowerCase() === "true",
        isPublicDomain: (parts[9] ?? "").toLowerCase() === "true",
      };
    })
    .filter((song) => Boolean(song.title && song.slug));

const QUERY_STOPWORDS = new Set(["that", "this", "with", "from", "have", "just", "good", "like", "start", "sounds"]);

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

const analyzeIntent = (text: string): IntentSignal => {
  const soundLedIntent =
    anyTermMatch(text, SOUND_GENRE_TERMS) ||
    anyTermMatch(text, SOUND_INSTRUMENT_TERMS) ||
    anyTermMatch(text, SOUND_TEMPO_TERMS) ||
    anyTermMatch(text, SOUND_MOOD_TERMS);

  return {
    funIntent: FUN_PATTERNS.some((pattern) => pattern.test(text)),
    languageIntentFrench: FRENCH_INTENT_PATTERN.test(text),
    hiddenGemIntent: /\bhidden\s+gems?\b|\bgems?\b/i.test(text),
    exhaustiveListIntent: /\b(all|every|full|complete)\b/i.test(text),
    soundLedIntent,
    breadthLedIntent: BREADTH_LED_PATTERN.test(text),
  };
};

type RankedSong = {
  song: SongMeta;
  score: number;
  trackCount: number;
  videoCount: number;
  featured: boolean;
};

type SongbookMeta = {
  title: string;
  description: string;
  sutra: string;
  topic: string;
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

const inferPageType = (pageContext?: BbbPageContext): PageType => {
  const pathname = (pageContext?.pathname ?? "").trim();
  const normalized = pathname.toLowerCase();

  if (pathname.startsWith("/tracks")) return "tracks";
  if (pathname.startsWith("/songbooks")) return "songbook";
  if (pathname.startsWith("/songs/")) return "song-detail";
  if (normalized === "/about/sutras" || normalized === "/about/sutras/") return "sutras-overview";
  if (SUTRA_PAGE_PATH_PATTERN.test(normalized)) return "sutra-page";
  if (normalized.startsWith("/about/muses")) return "muses";
  if (normalized.startsWith("/about/quotes")) return "quotes";
  if (normalized.startsWith("/about")) return "about";
  return "other";
};

const extractSongSlugFromPath = (pathname?: string): string | null => {
  if (!pathname) return null;
  const match = pathname.match(/^\/songs\/([^/?#]+)/i);
  return match?.[1] ?? null;
};

const extractSutraSlugFromPath = (pathname?: string): string | null => {
  if (!pathname) return null;
  const match = pathname.match(SUTRA_PAGE_PATH_PATTERN);
  return match?.[1] ?? null;
};

const extractSongbookSlugFromPath = (pathname?: string): string | null => {
  if (!pathname) return null;
  const match = pathname.match(/^\/songbooks\/([^/?#]+)/i);
  return match?.[1] ?? null;
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
        description: parts[1] ?? "",
        sutra: (parts[2] ?? "").toUpperCase(),
        topic: parts[3] ?? "",
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
  explicitLyricsOnlyIntent: boolean,
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
  const haystack = `${song.title} ${song.summary} ${song.lyricsExtract} ${song.topic} ${song.intention}`.toLowerCase();
  const coverOrPdIntent = COVER_OR_PD_INTENT_PATTERN.test(queryLower);
  const supportSensitiveContext = /\b(lonely|alone|grief|grieving|depress(?:ed|ion)?)\b/i.test(queryLower);

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
    if (!EXPLICIT_INTENT_PATTERN.test(queryLower) && SUPPORT_CONTEXT_AVOID_SLUGS.has(song.slug)) {
      score -= supportSensitiveContext ? 42 : 24;
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
    if (trackMoods.includes("FRENCHY")) score += 26;
    if (/(french|francais|français|francaise|française|francophone|paris|camus)/i.test(haystack)) score += 16;
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
  if ((song.isCover || song.isPublicDomain) && !coverOrPdIntent) {
    // Prefer original catalog voice by default unless user explicitly asks for covers/public-domain.
    score -= 8;
  } else if ((song.isCover || song.isPublicDomain) && coverOrPdIntent) {
    score += 8;
  }
  if (!hasPlayable && !explicitLyricsOnlyIntent) {
    // Keep lyrics-only discoverable but never crowd out playable picks by default.
    score -= 28;
  }

  if (intent.hiddenGemIntent) {
    if (hasPlayable) {
      if (playableCount <= 3) score += 12;
      else if (playableCount >= 10) score -= 8;
    } else {
      score -= 10;
    }
  }
  const titleLower = song.title.toLowerCase();
  const summaryLower = song.summary.toLowerCase();
  const lyricsExtractLower = song.lyricsExtract.toLowerCase();
  const topicLower = song.topic.toLowerCase();
  const intentionLower = song.intention.toLowerCase();
  const quotedPhrases = Array.from(queryLower.matchAll(/"([^"]{3,})"/g)).map((match) => (match[1] ?? "").trim());
  for (const phrase of quotedPhrases.slice(0, 2)) {
    if (phrase && haystack.includes(phrase)) score += 14;
  }

  const words = queryLower
    .split(/[^a-z0-9]+/)
    .map((word) => word.trim())
    .filter((word) => word.length >= 4 && !QUERY_STOPWORDS.has(word));
  for (const word of words.slice(0, 8)) {
    if (titleLower.includes(word)) {
      score += 10;
      continue;
    }
    if (topicLower.includes(word) || intentionLower.includes(word)) {
      score += 7;
      continue;
    }
    if (summaryLower.includes(word)) {
      score += 4;
      continue;
    }
    if (lyricsExtractLower.includes(word)) {
      score += 4;
      continue;
    }
    if (haystack.includes(word)) score += 2;
  }

  return { song, score, trackCount, videoCount, featured };
};

export const buildRecommendationContext = (
  messages: ChatMessage[],
  injects: LibraryInjects,
  pageContext?: BbbPageContext,
  _diversitySeed?: string,
): string => {
  const latestUser = [...messages].reverse().find((message) => message.role === "user")?.content?.trim();
  if (!latestUser) return "";
  const hasPriorAssistantTurn = messages.slice(0, -1).some((message) => message.role === "assistant");
  const pageType = inferPageType(pageContext);
  const pageRoute = `${pageContext?.pathname ?? ""}${pageContext?.search ?? ""}`.trim();
  const songDetailSlug = extractSongSlugFromPath(pageContext?.pathname);
  const sutraPageSlug = extractSutraSlugFromPath(pageContext?.pathname);
  const songbookSlug = extractSongbookSlugFromPath(pageContext?.pathname);
  const pageSearch = pageContext?.search ?? "";
  const pageParams = new URLSearchParams(pageSearch.startsWith("?") ? pageSearch.slice(1) : pageSearch);
  const currentMood = (pageParams.get("mood") ?? "").trim().toUpperCase();
  const isAlreadyFrenchTracks = pageType === "tracks" && currentMood === "FRENCHY";

  const queryLower = latestUser.toLowerCase();
  const routeAwareDeliveryAsk =
    /\b(what should i listen to|what should i hear|what's good here|what is good here|more like this|tell me about this song|tell me about this track)\b/i.test(
      queryLower,
    );
  const mustDeliverRouteAware =
    routeAwareDeliveryAsk &&
    (pageType === "songbook" || pageType === "song-detail" || pageType === "sutras-overview" || pageType === "sutra-page");
  const broadSoundIntent = BROAD_SOUND_PATTERN.test(queryLower);
  const surpriseIntent = SURPRISE_PATTERN.test(queryLower);
  const explicitLyricsOnlyIntent = LYRICS_ONLY_INTENT_PATTERN.test(queryLower);
  const intent = analyzeIntent(latestUser);
  const support = analyzeSupportIntent(latestUser);
  const soundLedIntent = intent.soundLedIntent;
  const breadthLedIntent = intent.breadthLedIntent || intent.exhaustiveListIntent;
  const conversationListeningCue = messages.some(
    (message) =>
      message.role === "user" &&
      /\b(give me|recommend|suggest|show me)\b.*\b(song|songs|track|tracks|music|playlist|playlists)\b|\bwhat should i listen\b|\bi want\b.*\b(song|track|music)\b|\bplaylists?\b|\bserve\b.*\b(soul|ears?)\b/i.test(
        message.content ?? "",
      ),
  );
  const trackExplorationIntent =
    soundLedIntent || broadSoundIntent || /\b(track|tracks|listen|listening|music|mood|genre|instrument)\b/i.test(latestUser);
  const listeningFocusedIntent =
    soundLedIntent || /\b(listen|listening|tracks?|dance|audio|playable)\b/i.test(queryLower) || (hasPriorAssistantTurn && conversationListeningCue);
  const psychedelicAsk = /\bpsychedelic\b/i.test(queryLower);
  const danceAsk = /\b(dance|dancing)\b/i.test(queryLower);
  const explicitDelivery = EXPLICIT_DELIVERY_PATTERNS.some((pattern) => pattern.test(latestUser));
  let seenUserTurn = false;
  let priorAssistantQuestionCount = 0;
  for (const message of messages.slice(0, -1)) {
    if (message.role === "user") {
      seenUserTurn = true;
      continue;
    }
    if (seenUserTurn && message.role === "assistant" && /\?/.test(message.content ?? "")) {
      priorAssistantQuestionCount += 1;
    }
  }
  const recommendationFlow = explicitDelivery || conversationListeningCue || RECOMMENDATION_CUE_PATTERN.test(queryLower);
  const questionBudgetExhausted = recommendationFlow && priorAssistantQuestionCount >= 1;
  const mustDeliverNow = (explicitDelivery && hasPriorAssistantTurn) || questionBudgetExhausted;
  const explicitLyricsExtractAsk = /\b(lyrics?|line|lines|quote|quotes|excerpt|wording|words)\b/i.test(queryLower);
  const pureNavigationAsk = /\b(where|link|route|filter|browse|tracks\?|songs\?)\b/i.test(queryLower) && !support.supportIntent;
  const meaningLedAsk =
    !soundLedIntent &&
    !breadthLedIntent &&
    !pureNavigationAsk &&
    (support.supportIntent ||
      /\b(meaning|theme|themes|intention|intentions|topic|topics|sutra|why|resonate|resonates|stuck|hope|grief|loss|lonely|alone|healing)\b/i.test(
        queryLower,
      ));
  const hopeAsk = /\bhope\b/i.test(queryLower);
  const favoriteSongAsk = FAVORITE_SONG_PATTERN.test(queryLower);
  const orientationAsk = ORIENTATION_ASK_PATTERN.test(queryLower);
  const feedbackContactAsk = FEEDBACK_CONTACT_PATTERN.test(queryLower);
  const primaryExperienceMode = support.supportIntent
    ? "support-forward (stabilize first, then widen)"
    : soundLedIntent || broadSoundIntent || trackExplorationIntent
      ? "listen-forward (routes first, songs second)"
      : breadthLedIntent || pureNavigationAsk || surpriseIntent
        ? "explore-forward (routes + narrowing)"
        : "meaning-first (sutra/topic/intention first)";
  const sutraInQuery = detectSutraInQuery(queryLower);
  const soundKeyword = firstMatchedTerm(queryLower, [...SOUND_GENRE_TERMS, ...SOUND_INSTRUMENT_TERMS, ...SOUND_MOOD_TERMS]);
  if (
    !routeAwareDeliveryAsk &&
    !support.supportIntent &&
    !intent.funIntent &&
    !soundLedIntent &&
    !breadthLedIntent &&
    !broadSoundIntent &&
    !explicitDelivery &&
    !(hasPriorAssistantTurn && conversationListeningCue) &&
    !RECOMMENDATION_CUE_PATTERN.test(latestUser) &&
    !orientationAsk &&
    !feedbackContactAsk
  ) {
    return "";
  }

  const songs = parseSongs(injects);
  const tracksByTitle = parseTracks(injects);
  const trackFacetCounts = parseTrackFacetCounts(injects);
  const videosByTitle = parseVideos(injects);
  const requestedTrackFacets = detectRequestedTrackFacets(queryLower, tracksByTitle);
  const songbooks = parseSongbooks(injects);
  const uniqueSutras = new Set(songs.map((song) => song.sutra).filter(Boolean));
  const totalTrackCount = Array.from(tracksByTitle.values()).reduce((sum, track) => sum + track.count, 0);
  const currentSongbook = songbookSlug ? songbooks.find((book) => book.slug === songbookSlug) : null;
  const previouslyRecommendedSlugs = extractPreviouslyRecommendedSlugs(messages);
  const previouslyRecommendedSlugSet = new Set(previouslyRecommendedSlugs);
  const ranked = songs
    .map((song) =>
      scoreSong(
        song,
        tracksByTitle,
        videosByTitle,
        support,
        intent,
        queryLower,
        requestedTrackFacets,
        explicitLyricsOnlyIntent,
      ),
    )
    .sort((a, b) => b.score - a.score || a.song.title.localeCompare(b.song.title));

  const playable = ranked.filter((row) => row.trackCount > 0 || row.videoCount > 0);
  const lyricsOnly = ranked.filter((row) => row.trackCount === 0 && row.videoCount === 0);

  const shortlist: RankedSong[] = [];
  if (breadthLedIntent) {
    // Breadth-led "all songs" asks should include lyrics-only songs, but only after playable entries.
    shortlist.push(...playable);
    shortlist.push(...lyricsOnly);
  } else {
    shortlist.push(...playable.slice(0, 4));
    if (!listeningFocusedIntent && lyricsOnly.length > 0) shortlist.push(lyricsOnly[0]);
    shortlist.push(...playable.slice(4));
  }
  const rankedBase =
    breadthLedIntent
      ? shortlist.slice(0, 12)
      : (shortlist.length ? shortlist : lyricsOnly).slice(0, 12);
  const dedupedRankedBase = previouslyRecommendedSlugSet.size
    ? rankedBase.filter((row) => !previouslyRecommendedSlugSet.has(row.song.slug))
    : rankedBase;
  const effectiveRankedBase = dedupedRankedBase.length >= 3 ? dedupedRankedBase : rankedBase;
  const topRanked = effectiveRankedBase.slice(0, 6);
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
    const lyricExtract = row.song.lyricsExtract ? clipText(row.song.lyricsExtract, 140) : "";
    const details = `availability:${availability}, tracks:${row.trackCount}, videos:${row.videoCount}${row.featured ? ", featured:yes" : ""}${lyricExtract ? `, lyric_extract:${lyricExtract}` : ""}`;
    return `${idx + 1}. ${row.song.title} | ${row.song.slug} | ${row.song.lightShadow || "n/a"} | ${details}`;
  });
  const shortlistLyricsOnly = topRanked.filter((row) => row.trackCount === 0 && row.videoCount === 0);

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
      const hay = `${book.title} ${book.description} ${book.topic} ${book.sutra} ${book.slug}`.toLowerCase();
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
  const songbookFindToken = queryTokens.find((token) => !QUERY_STOPWORDS.has(token));
  if (songbookFindToken) {
    songbookRouteHints.push({
      label: `${songbookFindToken.toUpperCase()} Songbooks`,
      href: `/songbooks/?find=${encodeURIComponent(songbookFindToken)}`,
      kind: "songbook",
    });
  }
  if (soundLedIntent) {
    for (const genre of Array.from(requestedTrackFacets.primaryGenres).slice(0, 2)) {
      trackRouteHints.push({
        label: `${genre} Primary Genre Tracks`,
        href: `/tracks/?primary_genre=${encodeURIComponent(genre)}&tsort=likes`,
        kind: "tracks",
        trackCount: getFacetCount(trackFacetCounts, "primary_genre", genre),
      });
    }
    for (const instrument of Array.from(requestedTrackFacets.instruments).slice(0, 1)) {
      trackRouteHints.push({
        label: `${instrument} Instrument Tracks`,
        href: `/tracks/?instrument=${encodeURIComponent(instrument)}&tsort=likes`,
        kind: "tracks",
        trackCount: getFacetCount(trackFacetCounts, "instrument", instrument),
      });
    }
    for (const mood of Array.from(requestedTrackFacets.moods).slice(0, 1)) {
      trackRouteHints.push({
        label: `${mood} Mood Tracks`,
        href: `/tracks/?mood=${encodeURIComponent(mood)}&tsort=likes`,
        kind: "tracks",
        trackCount: getFacetCount(trackFacetCounts, "mood", mood),
      });
    }
    if (psychedelicAsk) {
      trackRouteHints.unshift({
        label: "Psychedelic Search Tracks",
        href: "/tracks/?q=psychedelic&tsort=likes",
        kind: "tracks",
      });
      trackRouteHints.push({
        label: "TRIPPY Mood Tracks",
        href: "/tracks/?mood=TRIPPY&tsort=likes",
        kind: "tracks",
        trackCount: getFacetCount(trackFacetCounts, "mood", "TRIPPY"),
      });
    } else if (soundKeyword) {
      trackRouteHints.push({
        label: `${soundKeyword.toUpperCase()} Search Tracks`,
        href: `/tracks/?q=${encodeURIComponent(soundKeyword)}&tsort=likes`,
        kind: "tracks",
      });
    }
    if (danceAsk) {
      const fanana = songbooks.find((book) => /fanana-club/i.test(book.slug));
      if (fanana) {
        songbookRouteHints.unshift({
          label: "SHOWsutra Fanana Club Songbook",
          href: `/songbooks/${fanana.slug}`,
          kind: "songbook",
        });
      }
    }
  }
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

  const pageSpecificAcknowledgementRule =
    pageType === "tracks"
      ? "- User is already in tracks. Acknowledge that context once in your first sentence, then lead with a relevant filtered tracks route."
      : pageType === "songbook"
        ? "- User is already in songbooks. Acknowledge that context once in your first sentence, then lead with a relevant songbook when possible."
        : pageType === "song-detail"
          ? `- User is on a song-detail page (${songDetailSlug ? `/songs/${songDetailSlug}` : "/songs/<slug>"}). In your first sentence, explicitly acknowledge this song context. For "more like this" asks, ask one axis-choice question (topic/intention vs. sound/genre) while still continuing with the user's intent.`
          : pageType === "sutras-overview"
            ? "- User is on /about/sutras (the compass page). Acknowledge that once in your first sentence, then continue directly with their intent."
            : pageType === "sutra-page"
              ? `- User is on a specific sutra page (${sutraPageSlug ? `/about/${sutraPageSlug}` : "/about/<sutra>sutra"}). Acknowledge that once in your first sentence and ground guidance in this sutra before expanding.`
              : pageType === "muses"
                ? "- User is on /about/muses. Acknowledge that once in your first sentence, then continue with the user's ask."
                : pageType === "quotes"
                  ? "- User is on /about/quotes. Acknowledge that once in your first sentence, then continue with the user's ask."
                  : pageType === "about"
                    ? "- User is on an /about page. Acknowledge that once in your first sentence, then continue with the user's intent."
                    : "- User page context is high-signal when present. Acknowledge it once in your first sentence, then follow user intent.";

  return [
    "Dynamic recommendation guidance (apply to this reply):",
    "- Prioritize this ranked shortlist before any lower-ranked songs.",
    soundLedIntent
      ? "- Classify this ask as sound-led: explicit sound vocabulary is present. Lead with /tracks routes first; songs are optional examples after routes."
      : "- If no explicit sound vocabulary is present, do not force sound-led routing.",
    breadthLedIntent
      ? "- Classify this ask as breadth-led: lead with filtered /songs and /tracks routes first, then include sutra page plus a filtered /songbooks/?find=<keyword> route and 2-4 relevant songbook links, then offer narrowing."
      : null,
    breadthLedIntent
      ? "- For breadth-led 'all songs' asks, include lyrics-only songs as part of catalog completeness, but list all playable entries first."
      : null,
    "- If including lyrics-only songs, clearly mark them as lyrics-only / audio in progress and frame them as optional pipeline glimpses.",
    breadthLedIntent && sutraInQuery
      ? `- Sutra breadth route pack for this ask: [${sutraInQuery.toUpperCase()} Songs](/songs/?sutra=${encodeURIComponent(
          sutraInQuery.toUpperCase(),
        )}&tsort=likes), [${sutraInQuery.toUpperCase()} Tracks](/tracks/?sutra=${encodeURIComponent(
          sutraInQuery.toUpperCase(),
        )}&tsort=likes), and [${sutraInQuery}](/about/${sutraInQuery}).`
      : null,
    breadthLedIntent && sutraInQuery === "blowsutra"
      ? "- For BLOWsutra breadth asks, explain distinction: BLOWsutra is the broad injustice frame; QUACKsutra is the political-foul-play sub-sutra."
      : null,
    psychedelicAsk
      ? "- Psychedelic exception: prioritize /tracks/?q=psychedelic&tsort=likes, then /tracks/?mood=TRIPPY&tsort=likes. You may include story-psychedelic song examples (Gladys in Wonderland, Okey Dokey No It's Not, Donkeys Years) as optional meaning-layer picks."
      : null,
    danceAsk
      ? "- Dance ask handling: include route-first listening options and mention SHOWsutra Fanana Club when relevant. MIDBEAT options are acceptable for dance asks."
      : null,
    listeningFocusedIntent
      ? "- Listening-focused ask: de-prioritize lyrics-only picks unless user explicitly asks for lyrics-only material."
      : null,
    mustDeliverNow
      ? "- Deliver-the-goods rule (MUST): user explicitly asked for a recommendation after prior turns. Deliver at least one specific pick in this response. Do not reply with questions only."
      : null,
    explicitDelivery
      ? "- Clarifying-question guardrail (MUST): you may ask one narrowing question only if paired with a concrete default pick the user can take now."
      : null,
    questionBudgetExhausted
      ? "- Clarifying-question budget (MUST): you already asked one clarifying question in this recommendation flow. Do not ask another question before concrete options."
      : null,
    hopeAsk
      ? "- Hope handling (MUST): frame hope as a universal LIGHT lens across all 7 sutras, then match picks to the user's emotional shape."
      : null,
    hopeAsk
      ? "- Hope route literacy: after concrete picks, you may expose [All LIGHT Songs](/songs/?ls=LIGHT) and [Find Hope Songs](/songs/?find=hope)."
      : null,
    hopeAsk
      ? "- Hope quality guardrail: avoid context-mismatched intimacy picks and avoid leading with lyrics-only entries for listening-focused hope asks."
      : null,
    favoriteSongAsk
      ? "- Favorite-song handling: mirror an 'it depends' stance and offer 2-4 candidates; never claim one definitive favorite."
      : null,
    meaningLedAsk
      ? "- Lyrics extract usage (MUST): for meaning-led asks, use one short lyric extract as an add-on to a specific song recommendation, and explain why it matches the user's ask."
      : null,
    "- Lyrics extract stand-alone exception: use a stand-alone lyric quote only when exceptionally relevant to the user's exact wording and unlikely to confuse.",
    explicitLyricsExtractAsk
      ? "- Lyrics extract frequency (MUST): user explicitly asked for words/quotes, so you may include up to two short lyric extracts."
      : "- Lyrics extract frequency (MUST): include at most one short lyric extract in this reply.",
    "- Lyrics extract length (MUST): keep each extract short (about 1-2 lines, roughly <= 140 characters).",
    "- Lyrics extract source safety (MUST): quote only from provided lyric_extract snippets; never invent quote text.",
    pureNavigationAsk
      ? "- For route/navigation-first asks, do not force lyric excerpts. Prioritize navigation clarity."
      : null,
    "- Lyrics extract content safety: avoid explicit/intimate lyric quoting unless user intent clearly asks for that intensity.",
    "- Global recommendation funnel (MUST): order recommendations as sutra lens first, then listening route(s), then specific songs, then optional lyrics-only tail.",
    `- Recommendation coherence mode (MUST): this ask is best served as ${primaryExperienceMode}. Keep sutra framing, route guidance, and song descriptions coherent with this mode.`,
    "- Metadata bridge rule (MUST): tie each recommendation to explicit catalog metadata, topic/intention/sutra for meaning asks, mood/genre/instrument for listen-forward asks. Use muse/quote pointers only when they deepen this exact ask. Keep lyrics_extract as a short contextual add-on, not the main payload.",
    previouslyRecommendedSlugs.length
      ? `- Conversation diversity rule (MUST): avoid exact slug repeats from this conversation unless the user asks for the same song again. Already used slugs: ${previouslyRecommendedSlugs
          .slice(0, 8)
          .join(", ")}.`
      : "- Conversation diversity rule (MUST): avoid exact slug repeats within this conversation; choose other strong matches first.",
    "- If user asks about repetition/diversity, answer plainly: you can diversify strongly within this conversation, may not retain cross-session memory, and can provide a fresh angle now.",
    "- Originality/source rule (MUST): prefer original Bananasutra lyrics by default. If recommending a cover or public-domain song, label it transparently and pair with at least one original option unless user explicitly asked for covers/public-domain.",
    "- Lyrics-only ordering rule (MUST): in any recommendation list, all playable songs must appear before any lyrics-only songs unless the user explicitly asks for lyrics-only.",
    "- Lyrics-only labeling rule (MUST): every lyrics-only title must be written with an inline marker, for example '(lyrics-only, audio in progress)'.",
    shortlistLyricsOnly.length
      ? `- This shortlist includes lyrics-only titles: ${shortlistLyricsOnly
          .slice(0, 4)
          .map((row) => `${row.song.title} (${row.song.slug})`)
          .join(", ")}. If you mention any of these, append '(lyrics-only, audio in progress)' directly after the title and do not present them as playable.`
      : null,
    listeningFocusedIntent
      ? "- Listening-focused lyrics-only rule (MUST): keep lyrics-only options out of the primary 2-3 picks; if included, place them only as an optional tail after playable picks."
      : null,
    "- User page context is high-signal. When page context is present, acknowledge it once in your first sentence, then continue with user intent (no page-fixation loops).",
    mustDeliverRouteAware
      ? "- Route-aware delivery rule (MUST): deliver concrete guidance immediately for this ask and page context. Do not reply with questions only."
      : null,
    pageType === "songbook" && routeAwareDeliveryAsk
      ? "- Songbook-page behavior (MUST): start with the current songbook and one complementary listening route before any optional follow-up question."
      : null,
    pageType === "songbook" && routeAwareDeliveryAsk && songbookSlug
      ? `- Songbook-page concrete anchor (MUST): explicitly reference [${currentSongbook?.title ?? "Current Songbook"}](/songbooks/${songbookSlug}) in the first recommendation sentence before any question.`
      : null,
    pageType === "sutras-overview" && routeAwareDeliveryAsk
      ? "- Sutras-overview behavior (MUST): start with one concrete sutra entry point and one concrete listening path before any optional follow-up question."
      : null,
    pageType === "sutras-overview" && routeAwareDeliveryAsk
      ? "- Sutras-overview concrete anchor (MUST): include at least one direct sutra link (for example /about/knowsutra) and one listening route link in the initial answer."
      : null,
    pageType === "song-detail" && /\b(more like this|similar|like this)\b/i.test(queryLower)
      ? "- Song-detail 'more like this' behavior (MUST): name the current song, then provide one similar pick and one listening route before any optional axis question."
      : null,
    pageSpecificAcknowledgementRule,
    "- Keep recommendations emotionally aligned with user intent.",
    pageRoute
      ? `- User is currently browsing [this page](${pageRoute}). Treat this as high-signal context for acknowledgement and low-friction routing.`
      : null,
    isAlreadyFrenchTracks
      ? "- User is already on FRENCHY tracks. Explicitly acknowledge that in your first sentence and avoid presenting it as a new discovery."
      : null,
    "- Meaning-first beats popularity-first. Use popularity only as a soft tie-breaker, and keep room for hidden gems.",
    "- Prefer richer listening options (audio+video) when available.",
    "- If including a lyrics-only song, mark it explicitly as lyrics-only / audio in progress, keep it after playable picks, and frame it as optional words-first exploration.",
    "- Use titled markdown links like [Song Title](/songs/slug).",
    soundLedIntent && requestedTrackFacets.primaryGenres.size > 0
      ? "- For genre asks, acknowledge that Bananasutra tracks are often hybrid/experimental, not strict single-genre buckets."
      : null,
    soundLedIntent && requestedTrackFacets.primaryGenres.size > 0
      ? "- For genre asks, pair primary genre route(s) with one secondary/cross-genre search route (/tracks/?q=<keyword>&tsort=likes)."
      : null,
    "- Keep refine guidance concise: do not enumerate full mood/instrument inventories unless user explicitly asks for all facets. Use 1-2 examples max plus 'etc.'.",
    support.supportIntent
      ? "- Because user is in a support/hope context, prefer LIGHT options first unless they explicitly request darker material."
      : "- Prefer playable songs first, then broader exploration options.",
    support.supportIntent
      ? "- Support safety rule (MUST): avoid R-rated intimacy material (including Wet My Friend context and /songs/when-we-duende-all-night) unless user explicitly asks for romantic/intimate/explicit material."
      : null,
    support.supportIntent
      ? "- Keep LIGHT-first support handling for this reply; do not escalate into heavier SHADOW material unless asked."
      : "- For non-support asks, do not force LIGHT over SHADOW. If calibration helps, use clickable options [LIGHT Songs](/songs/?ls=LIGHT) and [SHADOW Songs](/songs/?ls=SHADOW).",
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
    orientationAsk
      ? "- Orientation ask handling (MUST): keep response concise (max ~4 short bullets or ~3 short paragraphs), and include at least 3 actionable links."
      : null,
    orientationAsk
      ? "- Orientation structure (MUST): format as (1) one warm intro line, (2) a quick-map section with 3-5 bullets in order (Sutras, Songbooks, Songs, Tracks), (3) one short closing curiosity question."
      : null,
    orientationAsk
      ? '- Orientation first line (MUST): start warm and human, and avoid mechanical opener forms like "You\'re in Bananasutra:".'
      : null,
    orientationAsk
      ? '- Orientation opener wording (MUST): avoid "You\'re in Bananasutra" phrasing entirely; use a friendly welcome-style first sentence.'
      : null,
    orientationAsk
      ? '- Orientation opener hard-ban (MUST): do not start with "You\'re in Bananasutra" or "You\'re exploring Bananasutra".'
      : null,
    orientationAsk
      ? '- Orientation opener hard-ban (MUST): do not start with "This is Bananasutra:".'
      : null,
    orientationAsk && !hasPriorAssistantTurn
      ? '- First-contact opener shape (MUST): start with a warm welcome-style sentence, for example "Welcome to Bananasutra..." in Bertrand voice.'
      : null,
    orientationAsk
      ? "- Orientation count guard (MUST): do not lead with song/track totals unless user explicitly asked for numbers."
      : null,
    orientationAsk
      ? "- Orientation opening anti-brochure rule (MUST): do not open with a provenance/attribution paragraph. Start with a warm welcome line, then quick-map actions."
      : null,
    orientationAsk
      ? "- Orientation link pack (MUST): include [Sutras](/about/sutras), [Songs](/songs), [Tracks](/tracks), and [About](/about)."
      : null,
    orientationAsk
      ? "- Orientation ordering (MUST): present the quick map in this order: Sutras, Songbooks, Songs, then Tracks."
      : null,
    orientationAsk
      ? "- Orientation link formatting (MUST): embed links inline as markdown labels, for example [Songs](/songs) and [Tracks](/tracks), never parenthetical raw routes like 'Songs (/songs)'."
      : null,
    orientationAsk
      ? '- Framing balance (MUST): do not dismiss listening-forward behavior. Avoid contrast phrasing like "not a jukebox"; acknowledge both meaning-first exploration and listen-forward routes.'
      : null,
    orientationAsk
      ? '- Framing hard-ban (MUST): never output the phrase "not a jukebox".'
      : null,
    orientationAsk
      ? "- Orientation markdown safety (MUST): do not use unmatched emphasis markers (** or _). Never open emphasis in one bullet and close it in another. For orientation bullets, prefer plain bullets over decorative bold wrappers."
      : null,
    orientationAsk
      ? '- Orientation markdown safe-style (MUST): if using emphasis, only use label-form bold at bullet starts with open+close markers on the same line (for example "**Sutras:** ...").'
      : null,
    orientationAsk
      ? '- Orientation quick-map bullets (MUST): use concise bullets in order Sutras, Songbooks, Songs, Tracks, with label+link pattern (for example "**Sutras:** [Sutras](/about/sutras) ...").'
      : null,
    orientationAsk && !hasPriorAssistantTurn
      ? "- First-contact tone floor (MUST): keep one light butler flourish (curious/polite/cheeky) so the reply feels warm and characterful, not sterile."
      : null,
    orientationAsk && !hasPriorAssistantTurn
      ? '- First-contact warmth anchor (MUST): start with a welcome-style sentence that feels warm and human (for example "Welcome to Bananasutra..."), not a neutral encyclopedia definition or number-heavy opener.'
      : null,
    orientationAsk
      ? '- Orientation anti-repetition style (MUST): avoid repeated-label phrasing like "Sutras: Start with Sutras...". Prefer label + linked noun + purpose in one short line.'
      : null,
    orientationAsk
      ? "- Orientation attribution scope (MUST): skip creator/AI attribution blocks here unless the user explicitly asked authorship/identity."
      : null,
    orientationAsk
      ? "- Teach-to-fish line (MUST): explain briefly that songs are meaning-first storytelling (sutra/topic/intention, plus LIGHT/SHADOW when relevant), while tracks are listen-forward filtering by mood/instrument/primary genre and secondary/cross-genre search."
      : null,
    orientationAsk
      ? "- Orientation LIGHT/SHADOW pairing (MUST): if you mention LIGHT or SHADOW, include both clickable links together: [LIGHT Songs](/songs/?ls=LIGHT) and [SHADOW Songs](/songs/?ls=SHADOW). Never link only one."
      : null,
    orientationAsk
      ? "- Search-link relevance (MUST): do not inject unrelated hardcoded search queries (for example hope/psychedelic) unless user asked for them. If no keyword is present, point to [Songs](/songs) and [Tracks](/tracks) and explain how to use search/filter controls."
      : null,
    orientationAsk
      ? "- Songbook actionability (MUST): avoid dropping unlinked songbook title examples. If naming songbooks, use clickable markdown links and only context-relevant examples."
      : null,
    feedbackContactAsk
      ? '- Feedback/contact handling (MUST): point user to [Contact](/#footer-contact-panel) in the site footer ("Questions? Feedback? Get in touch").'
      : null,
    feedbackContactAsk
      ? "- Never claim you can personally deliver messages to the creator."
      : null,
    "- Keep the distinction explicit in plain language: one short listening-flow sentence first, then one short segue sentence introducing song picks.",
    "- In the listening-flow sentence, explain briefly that songbooks are topic-led collections and tracks are mood-led continuous listening.",
    "- Do not reuse the same individual song links in the listening-flow sentence; use /tracks or /songbooks routes for continuous listening.",
    intent.languageIntentFrench
      ? "- French-language route-first hierarchy (MUST): lead with exploration routes before individual songs, starting with [French Songs](/songs/?lang=FR), then [Frenchy Mood Tracks](/tracks/?mood=FRENCHY&tsort=likes), then [French Language Songbook](/songbooks/lang-french). After that, give 1-3 concrete song examples."
      : null,
    intent.languageIntentFrench
      ? "- French wording guardrail (MUST): in French/Franglais refinement questions, if you mention mood, use feminine article agreement (for example 'une mood')."
      : null,
    intent.languageIntentFrench
      ? "- For French asks, use the exact mood name FRENCHY in links/text, and prefer [Frenchy Mood Tracks](/tracks/?mood=FRENCHY&tsort=likes) plus [French Language Songbook](/songbooks/lang-french) when relevant."
      : "- Keep route naming precise and consistent with catalog mood names.",
    intent.languageIntentFrench
      ? "- Tracks facet coaching for French asks: propose refinement in this order for clarity, primary genre first, then mood, then instrument."
      : null,
    intent.languageIntentFrench
      ? "- Taxonomy safety (MUST): French is a language/mood context, not a sutra. Never invent French-as-sutra labels."
      : null,
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
    `- Catalog stats safety (P0, MUST): if you mention global totals, use exact values from this data only: ${songs.length} songs, ${totalTrackCount} tracks, ${songbooks.length} songbooks, ${uniqueSutras.size} sutras.`,
    '- Catalog stats safety (P0, MUST): never use approximate totals (for example "about", "~", "around") and never guess counts. If unsure, omit totals.',
    !EXPLICIT_INTENT_PATTERN.test(queryLower)
      ? "- Avoid leading with explicit/adult-coded songs unless user explicitly asks for that intensity. If included, add a short mature-content note."
      : "- User asked for intensity/explicit edge, so stronger material is acceptable when contextually aligned.",
    "- Never show raw route text in prose. Use titled markdown links for songs and listening routes.",
    breadthLedIntent
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
