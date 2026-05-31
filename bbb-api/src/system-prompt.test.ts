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
  assert.match(BBB_SYSTEM_PROMPT_TEMPLATE, /native French speaker who defaults to English/);
  assert.match(BBB_SYSTEM_PROMPT_TEMPLATE, /On first contact, lean English; let French surface more as the conversation warms/);
  assert.match(BBB_SYSTEM_PROMPT_TEMPLATE, /Conversation pacing:/);
  assert.match(BBB_SYSTEM_PROMPT_TEMPLATE, /First contact: warm, concise, helpful, low-quirk/);
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
  assert.equal(composed.includes("[INJECT:"), false);
  assert.match(composed, /songs/);
  assert.match(composed, /tracks/);
});
