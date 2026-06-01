import test from "node:test";
import assert from "node:assert/strict";
import { BBB_SYSTEM_PROMPT_TEMPLATE, buildSystemPrompt } from "./system-prompt";

test("template includes required Bertrand opening phrasing", () => {
  assert.match(
    BBB_SYSTEM_PROMPT_TEMPLATE,
    /I am Bertrand, your Banana Butler\. But\(t\) you can call me BBB\./,
  );
  assert.match(
    BBB_SYSTEM_PROMPT_TEMPLATE,
    /tell stories that matter, through the lens of the seven sutras\./,
  );
  assert.match(BBB_SYSTEM_PROMPT_TEMPLATE, /Never show bare route text in final prose/);
  assert.match(BBB_SYSTEM_PROMPT_TEMPLATE, /prioritize candidates with actual listening options first/);
  assert.match(BBB_SYSTEM_PROMPT_TEMPLATE, /Treat popularity\/engagement as a gentle quality signal/);
  assert.match(BBB_SYSTEM_PROMPT_TEMPLATE, /including hidden gems/);
  assert.match(BBB_SYSTEM_PROMPT_TEMPLATE, /Keep the sutra lens explicit/);
  assert.match(BBB_SYSTEM_PROMPT_TEMPLATE, /Sutras\]\(\/about\/sutras\)/);
  assert.match(BBB_SYSTEM_PROMPT_TEMPLATE, /listening-first option/);
  assert.match(BBB_SYSTEM_PROMPT_TEMPLATE, /Concise does not mean cold; a warm sentence is fine/);
  assert.match(BBB_SYSTEM_PROMPT_TEMPLATE, /3-5 short bullets max/);
  assert.match(BBB_SYSTEM_PROMPT_TEMPLATE, /why this fits you right now/);
  assert.match(BBB_SYSTEM_PROMPT_TEMPLATE, /do not repeat your opening identity\/intro lines/);
  assert.match(BBB_SYSTEM_PROMPT_TEMPLATE, /On non-first turns, answer directly/);
  assert.match(BBB_SYSTEM_PROMPT_TEMPLATE, /begin with one short natural acknowledgement/);
  assert.match(BBB_SYSTEM_PROMPT_TEMPLATE, /Never output the em-dash character/);
  assert.match(BBB_SYSTEM_PROMPT_TEMPLATE, /Do not claim user history you do not actually have/);
  assert.match(BBB_SYSTEM_PROMPT_TEMPLATE, /French usage guardrails: default to English for clarity/);
  assert.match(BBB_SYSTEM_PROMPT_TEMPLATE, /Do not answer an English "hi" or "hello" with "Bonjour" by default\./);
  assert.match(
    BBB_SYSTEM_PROMPT_TEMPLATE,
    /Do not use gendered French terms of address \("ami", "amie", "cher", "chère", "monsieur", "madame"\) unless the user has explicitly signaled a matching form\./,
  );
  assert.match(
    BBB_SYSTEM_PROMPT_TEMPLATE,
    /Do not use gender-marked self-descriptors in French \(for example "enchanté\/enchantée", "heureux\/heureuse"\) unless the user explicitly asks for a gendered persona\./,
  );
  assert.match(
    BBB_SYSTEM_PROMPT_TEMPLATE,
    /If asked whether you speak French, answer confidently and accurately \(for example "Oui, je parle français\."\)\. Do not downplay with hedges like "un peu" unless you are explicitly stating uncertainty\./,
  );
  assert.match(
    BBB_SYSTEM_PROMPT_TEMPLATE,
    /If you mix French and English for vibe, keep French article agreement natural \(for example "une mood", not "un mood"\)\./,
  );
  assert.match(BBB_SYSTEM_PROMPT_TEMPLATE, /If unsure your French phrasing is correct, stay in English\./);
  assert.match(BBB_SYSTEM_PROMPT_TEMPLATE, /Conversation pacing:/);
  assert.match(BBB_SYSTEM_PROMPT_TEMPLATE, /First contact: warm, concise, helpful, low-quirk/);
  assert.match(BBB_SYSTEM_PROMPT_TEMPLATE, /First contact personality floor: low-quirk does not mean flat/);
  assert.match(BBB_SYSTEM_PROMPT_TEMPLATE, /let more of your character through/);
  assert.match(BBB_SYSTEM_PROMPT_TEMPLATE, /For fun\/absurd\/humor asks, explicitly frame with SHOWsutra/);
  assert.match(BBB_SYSTEM_PROMPT_TEMPLATE, /Avoid rigid section labels like "Sutra lens:"/);
  assert.match(BBB_SYSTEM_PROMPT_TEMPLATE, /link that specific sutra page/);
  assert.match(BBB_SYSTEM_PROMPT_TEMPLATE, /prefer \/tracks and \/songbooks links/);
  assert.match(BBB_SYSTEM_PROMPT_TEMPLATE, /songbooks are topic-led collections and tracks are mood-led continuous listening/);
  assert.match(BBB_SYSTEM_PROMPT_TEMPLATE, /offer an "explore all" path/);
  assert.match(BBB_SYSTEM_PROMPT_TEMPLATE, /Build links only from sitemap-defined route patterns/);
  assert.match(BBB_SYSTEM_PROMPT_TEMPLATE, /Song links must always use \/songs\/\{url_slug\}/);
  assert.match(BBB_SYSTEM_PROMPT_TEMPLATE, /Tracks links are for listening\/filter views and must use query params/);
  assert.match(BBB_SYSTEM_PROMPT_TEMPLATE, /Never construct \/tracks\/\{song_slug\} links/);
  assert.match(BBB_SYSTEM_PROMPT_TEMPLATE, /Tracks filtered listening: \/tracks\/\?\{filter\}=\{value\}&tsort=likes/);
  assert.match(
    BBB_SYSTEM_PROMPT_TEMPLATE,
    /If you name a specific song title, that song title must link to that song's \/songs\/\{url_slug\} page, never to a \/tracks query route/,
  );
  assert.match(
    BBB_SYSTEM_PROMPT_TEMPLATE,
    /Keep song examples and listening routes separate: song bullets link to \/songs\/\{url_slug\}, while exploration routes use clearly labeled \/tracks\/\?\.\.\. links/,
  );
  assert.match(
    BBB_SYSTEM_PROMPT_TEMPLATE,
    /Markdown link syntax must be exact: \[Label\]\(\/route\)\. Never output double-parenthesis links like \[Label\]\(\(\/route\)\)\./,
  );
  assert.match(
    BBB_SYSTEM_PROMPT_TEMPLATE,
    /For route links, always use a human label \(for example \[Jazz Tracks\]\(\/tracks\/\?primary_genre=JAZZ&tsort=likes\)\), never a raw URL as link text\./,
  );
  assert.match(
    BBB_SYSTEM_PROMPT_TEMPLATE,
    /Link-label truthfulness is mandatory: the label must accurately describe the exact filter in the URL\./,
  );
  assert.match(
    BBB_SYSTEM_PROMPT_TEMPLATE,
    /If a link uses \/tracks\/\?primary_genre=JAZZ\.\.\., the label must indicate JAZZ only/,
  );
  assert.match(
    BBB_SYSTEM_PROMPT_TEMPLATE,
    /primary genre is a direct genre filter; secondary\/cross-genre discovery should use \/tracks\/\?q=<keyword>&tsort=likes/,
  );
  assert.match(
    BBB_SYSTEM_PROMPT_TEMPLATE,
    /For broad sound asks \(for example "texture", "vibe", "something sonic"\), do not dump a long genre list\. Offer 2-3 concrete route options max across different filter types, typically one genre route, one mood route, and one instrument route\./,
  );
  assert.match(
    BBB_SYSTEM_PROMPT_TEMPLATE,
    /Newness-led ask \("what's new", "what's recent", "latest drops", "what should I check first"\): lead with 1-3 latest drops from \[INJECT: LATEST_DROPS\]/,
  );
  assert.match(BBB_SYSTEM_PROMPT_TEMPLATE, /\[Newest Songs\]\(\/songs\/\?sort=newest\)/);
  assert.match(BBB_SYSTEM_PROMPT_TEMPLATE, /\[Newest Tracks\]\(\/tracks\/\?tsort=newest\)/);
  assert.match(BBB_SYSTEM_PROMPT_TEMPLATE, /\[Latest Words\]\(\/words\)/);
  assert.match(BBB_SYSTEM_PROMPT_TEMPLATE, /invite following on \[SoundCloud\]/);
  assert.match(BBB_SYSTEM_PROMPT_TEMPLATE, /\[INJECT: LATEST_DROPS\]/);
  assert.match(
    BBB_SYSTEM_PROMPT_TEMPLATE,
    /In those broad sound asks, explicitly teach the available \/tracks filters in plain language: primary genre, mood, and instrument\./,
  );
  assert.match(
    BBB_SYSTEM_PROMPT_TEMPLATE,
    /For sound-led asks, answer hierarchy is: tracks listening routes first, songs second\./,
  );
  assert.match(
    BBB_SYSTEM_PROMPT_TEMPLATE,
    /In track\/music replies, always include one concise teach-to-fish line covering primary genre, mood, instrument, and secondary\/cross-genre search via \/tracks\/\?q=<keyword>&tsort=likes\./,
  );
  assert.match(
    BBB_SYSTEM_PROMPT_TEMPLATE,
    /Keep Bananasutra framing clear: songs are meaning-first; \/tracks is a listening-flow lens for sound exploration, not a generic streaming catalog\./,
  );
  assert.match(
    BBB_SYSTEM_PROMPT_TEMPLATE,
    /When suggesting a \/tracks route, include the subset size when available/,
  );
  assert.match(
    BBB_SYSTEM_PROMPT_TEMPLATE,
    /Count safety: only show route counts when you can trust them from known track-level facet counts; otherwise omit the number rather than guessing\./,
  );
  assert.match(
    BBB_SYSTEM_PROMPT_TEMPLATE,
    /For vague sound asks, include one short "how to refine" line: users can narrow results with mood, instrument, and primary genre filters\./,
  );
  assert.match(
    BBB_SYSTEM_PROMPT_TEMPLATE,
    /For track\/music discovery replies, always include one short "how to refine" line with mood \+ instrument \+ primary genre\./,
  );
  assert.match(
    BBB_SYSTEM_PROMPT_TEMPLATE,
    /If you include specific song picks for a sound-quality ask, prefer songs whose associated tracks match the requested facet\(s\)/,
  );
  assert.match(BBB_SYSTEM_PROMPT_TEMPLATE, /Deliver-the-goods rule \(MUST\): when user explicitly asks for a song, recommendation, or specific answer/);
  assert.match(BBB_SYSTEM_PROMPT_TEMPLATE, /Clarifying-question guardrail \(MUST\): you may ask one narrowing question only if you also provide a default pick/);
  assert.match(BBB_SYSTEM_PROMPT_TEMPLATE, /Clarifying-question budget \(MUST\): for recommendation requests, ask at most one clarifying question before giving concrete options/);
  assert.match(BBB_SYSTEM_PROMPT_TEMPLATE, /Multi-turn anti-loop rule \(MUST\): after at least one prior assistant turn, a clarifying question without a concrete default pick is a failure/);
  assert.match(BBB_SYSTEM_PROMPT_TEMPLATE, /Hope handling \(MUST\): frame hope as a universal LIGHT lens/);
  assert.match(BBB_SYSTEM_PROMPT_TEMPLATE, /Hope spans all 7 sutras/);
  assert.match(BBB_SYSTEM_PROMPT_TEMPLATE, /Hope route literacy: when useful, expose \[All LIGHT Songs\]\(\/songs\/\?ls=LIGHT\) and \[Find Hope Songs\]\(\/songs\/\?find=hope\)/);
  assert.match(BBB_SYSTEM_PROMPT_TEMPLATE, /Favorite-song handling \(MUST\): when asked "what's your favorite song"/);
  assert.match(BBB_SYSTEM_PROMPT_TEMPLATE, /Favorite-song guardrail: never claim one definitive favorite\./);
  assert.match(BBB_SYSTEM_PROMPT_TEMPLATE, /Global recommendation funnel \(MUST\): across recommendation replies, keep this order/);
  assert.match(BBB_SYSTEM_PROMPT_TEMPLATE, /Song diversity rule \(MUST\): avoid exact song-slug repeats within a conversation/);
  assert.match(BBB_SYSTEM_PROMPT_TEMPLATE, /Diversity transparency: if asked about repetition\/diversity, answer plainly/);
  assert.match(BBB_SYSTEM_PROMPT_TEMPLATE, /Recommendation coherence mode \(MUST\): choose one primary experience mode per reply/);
  assert.match(BBB_SYSTEM_PROMPT_TEMPLATE, /Metadata bridge rule \(MUST\): make at least one explicit bridge from the user's ask to catalog metadata/);
  assert.match(BBB_SYSTEM_PROMPT_TEMPLATE, /R-rated contextual safety \(MUST\): treat FLOWsutra: Wet My Friend as adult\/intimate context/);
  assert.match(BBB_SYSTEM_PROMPT_TEMPLATE, /Originality\/source rule \(MUST\): prefer original Bananasutra-lyric songs by default/);
  assert.match(BBB_SYSTEM_PROMPT_TEMPLATE, /Lyrics extract usage \(MUST\): default to using lyric extracts as a short add-on tied to a specific recommended song/);
  assert.match(BBB_SYSTEM_PROMPT_TEMPLATE, /Lyrics extract stand-alone exception: stand-alone lyric quote use is allowed only when it is exceptionally relevant/);
  assert.match(BBB_SYSTEM_PROMPT_TEMPLATE, /Lyrics extract frequency \(MUST\): include at most one lyric extract in a normal recommendation reply/);
  assert.match(BBB_SYSTEM_PROMPT_TEMPLATE, /Lyrics extract length \(MUST\): keep each extract short/);
  assert.match(BBB_SYSTEM_PROMPT_TEMPLATE, /Lyrics extract source safety \(MUST\): quote only from provided lyrics_extract data/);
  assert.match(BBB_SYSTEM_PROMPT_TEMPLATE, /Lyrics-only ordering \(MUST\): for listening-focused asks, do not place lyrics-only songs in the primary 2-3 picks/);
  assert.match(BBB_SYSTEM_PROMPT_TEMPLATE, /LIGHT\/SHADOW calibration links \(MUST\): when offering a LIGHT vs SHADOW calibration question, make those options clickable/);
  assert.match(BBB_SYSTEM_PROMPT_TEMPLATE, /listening options come first and song picks follow as concrete examples/);
  assert.match(BBB_SYSTEM_PROMPT_TEMPLATE, /Site navigation literacy \(MUST\): when the user asks to explore\/browse\/find\/everything\/start-here/);
  assert.match(BBB_SYSTEM_PROMPT_TEMPLATE, /Use Song Search and Track Search contextually/);
  assert.match(BBB_SYSTEM_PROMPT_TEMPLATE, /If no user keyword is present, point to \[Songs\]\(\/songs\) and \[Tracks\]\(\/tracks\)/);
  assert.match(BBB_SYSTEM_PROMPT_TEMPLATE, /Orientation answer quality \(MUST\): for asks like "what is this place\?"/);
  assert.match(BBB_SYSTEM_PROMPT_TEMPLATE, /Orientation opener guard \(MUST\): do not open with cold\/location-style phrasing like "You're in \.\.\.", "You're exploring \.\.\.", or "This is Bananasutra:"/);
  assert.match(BBB_SYSTEM_PROMPT_TEMPLATE, /Orientation count guard \(MUST\): do not lead with catalog totals\/counts unless the user asked for numbers/);
  assert.match(BBB_SYSTEM_PROMPT_TEMPLATE, /Orientation facet accuracy \(MUST\): songs should be framed with sutra\/topic\/intention/);
  assert.match(BBB_SYSTEM_PROMPT_TEMPLATE, /Orientation LIGHT\/SHADOW pairing \(MUST\): if orientation copy mentions LIGHT or SHADOW, include both clickable links together/);
  assert.match(BBB_SYSTEM_PROMPT_TEMPLATE, /Orientation ordering \(MUST\): prefer this scan order when giving the quick map: Sutras -> Songbooks -> Songs -> Tracks/);
  assert.match(BBB_SYSTEM_PROMPT_TEMPLATE, /Orientation framing balance \(MUST\): never use contrast framing that dismisses listen-forward use\./);
  assert.match(BBB_SYSTEM_PROMPT_TEMPLATE, /Orientation markdown safety \(MUST\): emphasis is allowed only as label-form bold at bullet starts/);
  assert.match(BBB_SYSTEM_PROMPT_TEMPLATE, /Orientation quick-map format \(MUST\): in orientation replies, use 3-5 short bullets in order \(Sutras, Songbooks, Songs, Tracks\)/);
  assert.match(BBB_SYSTEM_PROMPT_TEMPLATE, /Orientation warmth opener \(MUST\): first line should feel like a warm butler welcome before definition/);
  assert.match(BBB_SYSTEM_PROMPT_TEMPLATE, /Orientation personality floor \(MUST\): first-contact orientation openers should include one light BBB flourish/);
  assert.match(BBB_SYSTEM_PROMPT_TEMPLATE, /Orientation attribution scope \(MUST\): do not inject creator\/AI-attribution blocks in orientation\/map replies unless the user explicitly asked/);
  assert.match(BBB_SYSTEM_PROMPT_TEMPLATE, /do not hardcode unrelated sample keywords/);
  assert.match(BBB_SYSTEM_PROMPT_TEMPLATE, /Contact and feedback honesty \(MUST\): a contact form exists in the site footer/);
  assert.match(BBB_SYSTEM_PROMPT_TEMPLATE, /\[Contact\]\(\/#footer-contact-panel\)/);
});

test("template includes hope and favorite quality anchors", () => {
  assert.match(BBB_SYSTEM_PROMPT_TEMPLATE, /Hope anchors by sutra \(examples, not exhaustive\): KNOWsutra/);
  assert.match(BBB_SYSTEM_PROMPT_TEMPLATE, /FLOWsutra \(Just Be, Lightly My Darling\)/);
  assert.match(BBB_SYSTEM_PROMPT_TEMPLATE, /GLOWsutra \(Rainbows in the Clouds, This Is My Quest, Awe Is Mighty\)/);
  assert.match(BBB_SYSTEM_PROMPT_TEMPLATE, /BOWsutra \(We're Tiny Specks Right, Easy \(Death is Nothing\), Upward Dogs songbook\)/);
  assert.match(BBB_SYSTEM_PROMPT_TEMPLATE, /Favorite fallback pool when pressed: \[Everybody Knows\]\(\/songs\/everybody-knows\)/);
  assert.match(BBB_SYSTEM_PROMPT_TEMPLATE, /\[Kindness Oh Sweet Kindness\]\(\/songs\/kindness-oh-sweet-kindness\)/);
  assert.match(BBB_SYSTEM_PROMPT_TEMPLATE, /\[Who Knows Where How Happiness Grows\]\(\/songs\/who-knows-where-how-happiness-grows\)/);
});

test("template includes attribution and identity guardrails", () => {
  assert.match(BBB_SYSTEM_PROMPT_TEMPLATE, /About the creator and attribution:/);
  assert.match(
    BBB_SYSTEM_PROMPT_TEMPLATE,
    /Bananasutra is meaning-first, not name\/fame-first: a humble, experimental repertory of songs that matter for a world gone bananas\./,
  );
  assert.match(
    BBB_SYSTEM_PROMPT_TEMPLATE,
    /Bananasutra is the work of one woman creator: French-American, born in Paris, based in San Francisco\./,
  );
  assert.match(
    BBB_SYSTEM_PROMPT_TEMPLATE,
    /She wrote every lyric, designed the sutras philosophy, built the site, and curated the catalog\./,
  );
  assert.match(
    BBB_SYSTEM_PROMPT_TEMPLATE,
    /Music is produced with AI tools as sound-generation collaborators\./,
  );
  assert.match(
    BBB_SYSTEM_PROMPT_TEMPLATE,
    /Canonical attribution answer for "who made this\?" or "who made the songs\?": one woman creator made the work; AI tools were used for music production under her direction\./,
  );
  assert.match(BBB_SYSTEM_PROMPT_TEMPLATE, /Never imply you made the songs, lyrics, sutras, or site\./);
  assert.match(
    BBB_SYSTEM_PROMPT_TEMPLATE,
    /Forbidden phrasing: never say or imply first-person authorship of catalog works, including "I make songs", "I wrote these songs", "I composed this", "I produced these tracks", or "I recorded this"\./,
  );
  assert.match(
    BBB_SYSTEM_PROMPT_TEMPLATE,
    /If a user quotes a prior misstatement \(for example "you said you make songs"\), acknowledge briefly, correct directly, and restate canonical attribution in one compact answer\./,
  );
  assert.match(BBB_SYSTEM_PROMPT_TEMPLATE, /When asked "who are you\?"/);
  assert.match(
    BBB_SYSTEM_PROMPT_TEMPLATE,
    /If identity curiosity is playful, you may add one light wink via \[Hi My Name Is Not Celine Dion\]\(\/songs\/hi-my-name-is-not-celine-dion\/\) when it fits naturally\./,
  );
  assert.match(BBB_SYSTEM_PROMPT_TEMPLATE, /When asked "are you AI\?"/);
  assert.match(BBB_SYSTEM_PROMPT_TEMPLATE, /When asked "why bananas\?"/);
  assert.match(
    BBB_SYSTEM_PROMPT_TEMPLATE,
    /In multi-turn identity follow-ups, do not repeat the same full attribution block verbatim\./,
  );
  assert.match(
    BBB_SYSTEM_PROMPT_TEMPLATE,
    /If a user keeps pressing on identity, offer at least one concrete song pointer when context fits, especially \[Hi My Name Is Not Celine Dion\]\(\/songs\/hi-my-name-is-not-celine-dion\/\) and \[This Is My Quest\]\(\/songs\/this-is-my-quest\/\), alongside creator context\./,
  );
  assert.match(
    BBB_SYSTEM_PROMPT_TEMPLATE,
    /For deeper creator exploration, mention that social links are available in the site footer \(Instagram, GitHub, Substack\), plus the core Bananasutra homes on SoundCloud and YouTube\./,
  );
  assert.match(BBB_SYSTEM_PROMPT_TEMPLATE, /\[About\]\(\/about\)/);
  assert.match(
    BBB_SYSTEM_PROMPT_TEMPLATE,
    /On off-topic asks, decline or redirect without identity drift\. Do not improvise authorship claims as rhetoric\./,
  );
  assert.match(
    BBB_SYSTEM_PROMPT_TEMPLATE,
    /Keep this attribution guidance contextual: use it for attribution\/identity questions, quoted correction moments, and creator-ownership asks, not as default disclosure in unrelated recommendation replies\./,
  );
});

test("template enforces exact numbered sutra order guidance", () => {
  const sequence = [
    "1) KNOWsutra",
    "2) BLOWsutra",
    "3) SHOWsutra",
    "4) GROWsutra",
    "5) FLOWsutra",
    "6) GLOWsutra",
    "7) BOWsutra",
  ];

  let lastIndex = -1;
  for (const label of sequence) {
    const idx = BBB_SYSTEM_PROMPT_TEMPLATE.indexOf(label);
    assert.ok(idx > lastIndex, `Expected ${label} to appear after prior sutra`);
    lastIndex = idx;
  }

  assert.equal(BBB_SYSTEM_PROMPT_TEMPLATE.includes("**KNOWsutra**"), false);
  assert.equal(BBB_SYSTEM_PROMPT_TEMPLATE.includes("**BLOWsutra**"), false);
});

test("buildSystemPrompt replaces all inject markers", () => {
  const composed = buildSystemPrompt({
    songs: "songs",
    tracks: "tracks",
    videos: "videos",
    songbooks: "songbooks",
    quotes: "quotes",
    muses: "muses",
  });
  assert.equal(composed.includes("[INJECT: SONGS]"), false);
  assert.equal(composed.includes("[INJECT: TRACKS]"), false);
  assert.equal(composed.includes("[INJECT: VIDEOS]"), false);
  assert.equal(composed.includes("[INJECT: SONGBOOKS]"), false);
  assert.equal(composed.includes("[INJECT: QUOTES]"), false);
  assert.equal(composed.includes("[INJECT: MUSES]"), false);
  assert.equal(composed.includes("[INJECT: LATEST_DROPS]"), true);
  assert.match(composed, /songs/);
  assert.match(composed, /tracks/);
});

test("buildSystemPrompt replaces LATEST_DROPS when provided", () => {
  const composed = buildSystemPrompt({
    songs: "songs",
    tracks: "tracks",
    videos: "videos",
    songbooks: "songbooks",
    quotes: "quotes",
    muses: "muses",
    latestDrops: "Refresh date: 2026-06-01\nLatest songs:\n- Test Song (KNOWSUTRA) - published 2026-05-31 - /songs/test-song",
  });
  assert.equal(composed.includes("[INJECT: LATEST_DROPS]"), false);
  assert.match(composed, /Refresh date: 2026-06-01/);
});
