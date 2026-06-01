const ORIENTATION_ASK_PATTERN =
  /\b(what is this place|what's this place|where should i start|how does this work|how do i explore|what can i do here)\b/i;

type OrientationNormalizeOptions = {
  hasPriorAssistantTurn?: boolean;
};

const OPENERS = [
  "Welcome to Bananasutra. I am Bertrand, your Banana Butler, here with a tidy tray of options.",
  "Bonjour, welcome to Bananasutra. Bertrand at your service, neatly gloved and mildly mischievous.",
  "Welcome in. I am Bertrand, your Banana Butler, and this library has both poetry and bite.",
  "Glad you asked. I am Bertrand, your Banana Butler. Think curious salon, not dusty museum.",
] as const;

const FOLLOWUP_OPENERS = [
  "Lovely question. Here is the clean map, swift and useful.",
  "Perfect timing, let us open the right doors first.",
  "Great, quick map incoming, practical with a wink.",
] as const;

const MAP_INTROS = [
  "Here is the quick map:",
  "Here is your quick map:",
  "Quick map, then you pick the door:",
] as const;

const SUTRA_LINES = [
  "- **[Sutras](/about/sutras):** Seven lenses for truth, justice, growth, flow, beauty, wonder, and humility.",
  "- **[Sutras](/about/sutras):** The philosophical compass for reading a world gone bananas.",
] as const;

const SONGBOOK_LINES = [
  "- **[Songbooks](/songbooks):** Curated paths by intention, topic, and sutra, often the easiest listen-forward route on mobile when autoplay can be limited.",
  "- **[Songbooks](/songbooks):** Theme-led collections with practical facets like intention, topic, and sutra, especially handy on mobile.",
] as const;

const SONG_LINES = [
  "- **[Songs](/songs):** Meaning-first story pages. Filter by sutra, topic, intention, muse or keyword search. Try [GLOWsutra Songs](/songs/?sutra=GLOWSUTRA&tsort=likes) or [Hope Search](/songs/?find=hope), plus optional [LIGHT](/songs/?ls=LIGHT) or [SHADOW](/songs/?ls=SHADOW).",
  "- **[Songs](/songs):** Individual lyric-and-context pages. Refine by sutra, topic, intention, and search (muse, quote, keyword). Try [KNOWsutra Songs](/songs/?sutra=KNOWSUTRA&tsort=likes) or [Kindness Search](/songs/?find=kindness), plus optional [LIGHT](/songs/?ls=LIGHT) or [SHADOW](/songs/?ls=SHADOW).",
] as const;

const TRACK_LINES = [
  "- **[Top Tracks](/tracks):** Listen-forward routes by mood, instrument, and primary genre, with keyword search for cross-genre discovery. Try [RAINY Mood](/tracks/?mood=RAINY&tsort=likes), [JAZZ Primary Genre](/tracks/?primary_genre=JAZZ&tsort=likes), or [Psychedelic Search](/tracks/?q=psychedelic&tsort=likes).",
  "- **[Top Tracks](/tracks):** Mood-led listening routes by instrument and primary genre, plus keyword search for cross-genre texture. Try [TRIPPY Mood](/tracks/?mood=TRIPPY&tsort=likes), [GUITAR Instrument](/tracks/?instrument=GUITAR&tsort=likes), or [Dub Search](/tracks/?q=dub&tsort=likes).",
] as const;

const DISTINCTION_LINES = [
  "Songs are story-first depth. Top Tracks are flow-first listening.",
  "Songs lead with meaning and lyrics. Top Tracks lead with vibe and momentum.",
] as const;

const CLOSERS = [
  "What draws you first, meaning, listening, or both?",
  "Where should we begin, question, mood, or both?",
  "Want to start with meaning, with sound, or with a little duet of both?",
] as const;

export const isOrientationAsk = (text: string): boolean => ORIENTATION_ASK_PATTERN.test(text);

const hash = (value: string): number => {
  let h = 2166136261;
  for (let idx = 0; idx < value.length; idx += 1) {
    h ^= value.charCodeAt(idx);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h >>> 0);
};

const pick = <T extends readonly string[]>(pool: T, seed: number, salt: number): string => pool[(seed + salt) % pool.length] ?? pool[0];

export const normalizeOrientationReply = (text: string, options?: OrientationNormalizeOptions): string => {
  const seed = hash(text);
  const hasPriorAssistantTurn = options?.hasPriorAssistantTurn ?? false;
  return [
    hasPriorAssistantTurn ? pick(FOLLOWUP_OPENERS, seed, 1) : pick(OPENERS, seed, 1),
    "",
    pick(MAP_INTROS, seed, 3),
    "",
    pick(SUTRA_LINES, seed, 5),
    pick(SONGBOOK_LINES, seed, 7),
    pick(SONG_LINES, seed, 11),
    pick(TRACK_LINES, seed, 13),
    "",
    pick(DISTINCTION_LINES, seed, 17),
    "",
    pick(CLOSERS, seed, 19),
  ].join("\n");
};

