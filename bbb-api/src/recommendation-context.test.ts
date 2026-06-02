import test from "node:test";
import assert from "node:assert/strict";
import { buildBbbLogSignals, buildRecommendationContext, inferPageType } from "./recommendation-context";
import type { LibraryInjects } from "./library-data";

const fixtureInjects: LibraryInjects = {
  songs: [
    "Bright Morning | A gentle song about hope and repair. | GLOWsutra | HOPE | HEALING | LIGHT | bright-morning",
    "Shadow Spiral | A descent into panic and doubt. | BLOWsutra | FEAR | ANXIETY | SHADOW | shadow-spiral",
    "Quiet Lantern | Soft resilience and small daily courage. | FLOWsutra | HOPE | COURAGE | LIGHT | quiet-lantern",
    "Paper Lantern Prayer | A small, quiet prayer for hope in hard times. | KNOWsutra | HOPE | HEALING | LIGHT | paper-lantern-prayer",
    "Paris At Dawn | A playful french morning walk with absurd grace notes. | FLOWsutra | JOY | CURIOSITY | LIGHT | paris-at-dawn",
    "Cosmic Drift | A trippy layered dreamscape. | SHOWsutra | WONDER | CURIOSITY | LIGHT | cosmic-drift",
  ].join("\n"),
  tracks: [
    "Bright Morning | 5trk | INDIE | CALM,KINDLY | MID | PIANO",
    "Quiet Lantern | 2trk | FOLK | CALM | SLOW | GUITAR",
    "Paris At Dawn | 3trk | JAZZ | FRENCHY,CHEEKY | MID | ACCORDION",
    "Cosmic Drift | 7trk | DUB | TRIPPY,RAINY | MID | SYNTH,CELLO",
  ].join("\n"),
  trackFacetCounts: JSON.stringify({
    mood: { CALM: 7, KINDLY: 5, FRENCHY: 3, CHEEKY: 3, TRIPPY: 7, RAINY: 7 },
    primary_genre: { INDIE: 5, FOLK: 2, JAZZ: 3, DUB: 7 },
    instrument: { PIANO: 5, GUITAR: 2, ACCORDION: 3, SYNTH: 7, CELLO: 7 },
  }),
  videos: ["Bright Morning | 2vid | INDIE | feat:yes", "Shadow Spiral | 1vid | ROCK | feat:no"].join("\n"),
  songbooks: [
    "Play: B.J. (Banana Jokes) | Tiny joke pack. | SHOWsutra | FUN | play-bj-banana-jokes",
    "SHOWsutra : Fanana Club | Big absurd stage energy. | SHOWsutra | FUN | showsutra-fanana-club",
    "Play: PEACE CIRCUS | Playful collective chaos. | SHOWsutra | FUN | play-peace-circus",
    "Lang: French | French language gems. | FLOWsutra | LANGUAGE | lang-french",
  ].join("\n"),
  quotes: "",
  muses: "",
};

test("buildBbbLogSignals captures page type, intent flags, and support keywords", () => {
  const signals = buildBbbLogSignals("I need hope and calm piano", {
    pathname: "/songs/bright-morning",
  });
  assert.equal(signals.pageType, "song-detail");
  assert.ok(signals.intentFlags.includes("soundLedIntent"));
  assert.ok(signals.supportKeywords.includes("hope"));
});

test("buildRecommendationContext returns ranked playable shortlist for support intent", () => {
  const context = buildRecommendationContext([{ role: "user", content: "I need hope, can you suggest songs?" }], fixtureInjects);
  assert.match(context, /Ranked shortlist:/);
  assert.match(context, /Begin with one short natural sentence that names the sutra angle/);
  assert.match(context, /3-5 short bullets max/);
  assert.match(context, /prefer a stabilizing lens such as \[FLOWsutra\]/);
  assert.match(context, /Keep LIGHT-first support handling/);
  assert.match(context, /availability:audio\+video/);
  assert.match(context, /\[KINDLY Mood Tracks(?: \(\d+ tracks\))?\]\(\/tracks\/\?mood=KINDLY&tsort=likes\)/);
  assert.match(context, /Bright Morning \| bright-morning/);
  assert.match(context, /Quiet Lantern \| quiet-lantern/);
  assert.match(context, /Paper Lantern Prayer \| paper-lantern-prayer/);
  assert.match(context, /availability:lyrics-only/);
  assert.match(context, /Route safety: songs must link as \/songs\/\{slug\}\./);
  assert.match(context, /tracks links are list\/filter routes with query params/);
  assert.match(context, /never \/tracks\/\{song-slug\}/);
  assert.match(context, /If including a lyrics-only song, mark it explicitly as lyrics-only \/ audio in progress/);
  assert.match(context, /keep it after playable picks, and frame it as optional words-first exploration/);
  assert.match(context, /Formatting safety: if you name a specific song, link that title to \/songs\/\{slug\}, not to any \/tracks query link\./);
  assert.match(
    context,
    /Keep song picks separate from listening routes: song picks use \/songs\/\{slug\}; exploration links to \/tracks\/\?\.\.\. should be presented as separate route options with explicit labels\./,
  );
  assert.match(context, /Markdown safety: use exact \[Label\]\(\/route\) syntax only\. Never output \[Label\]\(\(\/route\)\)\./);
  assert.match(context, /Route-link labels must be human-readable \(for example 'Jazz Tracks'\), never raw route text\./);
  assert.ok(context.indexOf("Bright Morning") < context.indexOf("Shadow Spiral"));
});

test("buildRecommendationContext stays empty for unrelated prompts", () => {
  const context = buildRecommendationContext([{ role: "user", content: "hello there" }], fixtureInjects);
  assert.equal(context, "");
});

test("buildRecommendationContext suggests listening routes for french queries", () => {
  const context = buildRecommendationContext(
    [{ role: "user", content: "Any french songs with a listening flow?" }],
    fixtureInjects,
    { pathname: "/tracks", search: "?mood=KINDLY" },
  );
  assert.match(context, /User is currently browsing \[this page\]\(\/tracks\?mood=KINDLY\)/);
  assert.match(context, /User is already in tracks\. Acknowledge that context once in your first sentence/);
  assert.match(context, /If calibration helps, use clickable options \[LIGHT Songs\]\(\/songs\/\?ls=LIGHT\) and \[SHADOW Songs\]\(\/songs\/\?ls=SHADOW\)/);
  assert.match(context, /use the exact mood name FRENCHY/);
  assert.match(context, /\[French Songs\]\(\/songs\/\?lang=FR\)/);
  assert.match(context, /\[Frenchy Mood Tracks\]\(\/tracks\/\?mood=FRENCHY&tsort=likes\)/);
  assert.match(context, /\[French Language Songbook\]\(\/songbooks\/lang-french\)/);
  assert.match(context, /French-language route-first hierarchy \(MUST\): lead with exploration routes before individual songs/);
  assert.match(context, /French wording guardrail \(MUST\): in French\/Franglais refinement questions, if you mention mood, use feminine article agreement/);
  assert.match(context, /Tracks facet coaching for French asks: propose refinement in this order for clarity, primary genre first, then mood, then instrument\./);
  assert.equal(context.includes("Frenchsutra"), false);
  assert.match(context, /\[FRENCHY Mood Tracks(?: \(\d+ tracks\))?\]\(\/tracks\/\?mood=FRENCHY&tsort=likes\)/);
  assert.ok(context.indexOf("Paris At Dawn | paris-at-dawn") < context.indexOf("Bright Morning | bright-morning"));
});

test("buildRecommendationContext detects french intent for unaccented francaise phrasing", () => {
  const context = buildRecommendationContext(
    [{ role: "user", content: "donne moi de la bonne musique francaise, recommande-moi des chansons" }],
    fixtureInjects,
  );
  assert.match(context, /\[French Songs\]\(\/songs\/\?lang=FR\)/);
  assert.match(context, /\[Frenchy Mood Tracks\]\(\/tracks\/\?mood=FRENCHY&tsort=likes\)/);
  assert.match(context, /\[French Language Songbook\]\(\/songbooks\/lang-french\)/);
  assert.equal(context.includes("Frenchsutra"), false);
});

test("buildRecommendationContext detects french intent for accented française phrasing", () => {
  const context = buildRecommendationContext(
    [{ role: "user", content: "donne-moi de la bonne musique française, recommande-moi des chansons" }],
    fixtureInjects,
  );
  assert.match(context, /\[French Songs\]\(\/songs\/\?lang=FR\)/);
  assert.match(context, /French-language route-first hierarchy \(MUST\): lead with exploration routes before individual songs/);
});

test("buildRecommendationContext prioritizes songbook route first when already in songbooks", () => {
  const context = buildRecommendationContext(
    [{ role: "user", content: "Any french songs with a listening flow?" }],
    fixtureInjects,
    { pathname: "/songbooks/lang-french" },
  );
  const routeLine = context
    .split("\n")
    .find((line) => line.includes("include one listening-first route option from:"));
  assert.ok(Boolean(routeLine));
  assert.ok((routeLine ?? "").indexOf("[French Language Songbook]") < (routeLine ?? "").indexOf("[FRENCHY Mood Tracks"));
  assert.match(context, /User is already in songbooks\. Acknowledge that context once in your first sentence/);
});

test("buildRecommendationContext acknowledges already-on-frenchy-tracks context", () => {
  const context = buildRecommendationContext(
    [{ role: "user", content: "give me French hidden gems I can listen to" }],
    fixtureInjects,
    { pathname: "/tracks", search: "?mood=FRENCHY&tsort=likes" },
  );
  assert.match(context, /User is already on FRENCHY tracks/);
  assert.match(context, /Avoid leading with explicit\/adult-coded songs/);
});

test("buildRecommendationContext anchors fun asks to SHOWsutra and cheeky mood route", () => {
  const context = buildRecommendationContext(
    [{ role: "assistant", content: "Welcome intro already done." }, { role: "user", content: "what's fun around here?" }],
    fixtureInjects,
  );
  assert.match(context, /anchor the lens on \[SHOWsutra\]\(\/about\/showsutra\)/);
  assert.match(context, /Do not repeat your identity intro/);
  assert.match(context, /Start with one short natural acknowledgement of the ask/);
  assert.match(context, /not label-style blocks like "Sutra lens:"/);
  assert.match(context, /\[Cheeky Mood Tracks(?: \(\d+ tracks\))?\]\(\/tracks\/\?mood=CHEEKY&tsort=likes\)/);
  assert.match(context, /\/songbooks\/(showsutra-fanana-club|play-peace-circus)/);
  assert.equal(context.includes("/songbooks/play-bj-banana-jokes"), false);
  assert.match(context, /Never show raw route text in prose/);
  assert.match(context, /songbooks are topic-led collections and tracks are mood-led continuous listening/);
  assert.match(context, /Never claim "first visit", "first time here", or "new user"/);
});

test("buildRecommendationContext expands guidance when user asks for all songs", () => {
  const context = buildRecommendationContext([{ role: "user", content: "show me all hope songs" }], fixtureInjects);
  assert.match(context, /User asked for all relevant songs, so provide a broader concise list/);
  assert.match(context, /include lyrics-only songs as part of catalog completeness, but list all playable entries first/);
  assert.match(context, /clearly mark them as lyrics-only \/ audio in progress/);
  assert.match(context, /Paper Lantern Prayer \| paper-lantern-prayer/);
  assert.ok(context.indexOf("Paper Lantern Prayer | paper-lantern-prayer") > context.indexOf("Bright Morning | bright-morning"));
  assert.ok(context.indexOf("Paper Lantern Prayer | paper-lantern-prayer") > context.indexOf("Quiet Lantern | quiet-lantern"));
  assert.match(context, /Lyrics-only ordering rule \(MUST\): in any recommendation list, all playable songs must appear before any lyrics-only songs/);
  assert.match(context, /Lyrics-only labeling rule \(MUST\): every lyrics-only title must be written with an inline marker/);
  assert.ok(context.indexOf("Paper Lantern Prayer | paper-lantern-prayer") > context.indexOf("Paris At Dawn | paris-at-dawn"));
  assert.ok(context.indexOf("Paper Lantern Prayer | paper-lantern-prayer") > context.indexOf("Cosmic Drift | cosmic-drift"));
});

test("buildRecommendationContext adds broad-sound guidance for texture asks", () => {
  const context = buildRecommendationContext(
    [{ role: "assistant", content: "prior turn" }, { role: "user", content: "i want to listen to tracks with texture" }],
    fixtureInjects,
    { pathname: "/tracks" },
  );
  assert.match(context, /Do not dump a long list of genres/);
  assert.match(context, /Offer 2-3 concrete listening routes max across different filter types/);
  assert.match(context, /primary genre, secondary genre\/search, mood, and instrument/);
  assert.match(context, /meaning-first at the song level; \/tracks is a listening-flow lens/);
});

test("buildRecommendationContext offers cross-filter concrete routes for broad sound asks", () => {
  const context = buildRecommendationContext(
    [{ role: "assistant", content: "prior turn" }, { role: "user", content: "i dunno surprise me with specifics, i want texture" }],
    fixtureInjects,
    { pathname: "/tracks" },
  );
  assert.match(context, /\/tracks\/\?mood=[A-Z]+&tsort=likes/);
  assert.match(context, /\/tracks\/\?instrument=[A-Z]+&tsort=likes/);
  assert.match(context, /\/tracks\/\?(primary_genre=[A-Z]+|q=[A-Z]+)&tsort=likes/);
  assert.match(context, /\(\d+ tracks\)/);
  assert.match(context, /MUST include one teach-to-fish line: tell the user they can refine with mood \+ instrument \+ primary genre/);
  assert.match(context, /\/tracks\/\?q=\.\.\./);
  assert.match(context, /Label fidelity rule: every route label must match the href filters exactly/);
  assert.match(context, /For \/tracks\/\?primary_genre=<GENRE>, use label shape '<GENRE> Primary Genre Tracks'/);
  assert.match(context, /secondary-genre exploration, use \/tracks\/\?q=<keyword>&tsort=likes/);
});

test("buildRecommendationContext uses tracks-first hierarchy for sound-led asks", () => {
  const context = buildRecommendationContext(
    [{ role: "assistant", content: "prior turn" }, { role: "user", content: "got trippy music?" }],
    fixtureInjects,
    { pathname: "/tracks" },
    "seed-1",
  );
  assert.match(context, /Sound-led hierarchy rule: lead with listening routes first/);
});

test("buildRecommendationContext adds song-detail page acknowledgement guidance", () => {
  const context = buildRecommendationContext(
    [{ role: "user", content: "recommend more like this please" }],
    fixtureInjects,
    { pathname: "/songs/tell-the-truth" },
  );
  assert.match(context, /User is on a song-detail page \(\/songs\/tell-the-truth\)/);
  assert.match(context, /ask one axis-choice question \(topic\/intention vs\. sound\/genre\)/);
});

test("buildRecommendationContext adds sutras-overview acknowledgement guidance", () => {
  const context = buildRecommendationContext(
    [{ role: "user", content: "what should I listen to here?" }],
    fixtureInjects,
    { pathname: "/about/sutras" },
  );
  assert.match(context, /User is on \/about\/sutras \(the compass page\)/);
});

test("buildRecommendationContext adds sutra-page acknowledgement guidance", () => {
  const context = buildRecommendationContext(
    [{ role: "user", content: "what should I listen to?" }],
    fixtureInjects,
    { pathname: "/about/knowsutra" },
  );
  assert.match(context, /User is on a specific sutra page \(\/about\/knowsutra\)/);
  assert.match(context, /ground guidance in this sutra before expanding/);
});

test("buildRecommendationContext adds muses page acknowledgement guidance", () => {
  const context = buildRecommendationContext(
    [{ role: "user", content: "what should I listen to?" }],
    fixtureInjects,
    { pathname: "/about/muses" },
  );
  assert.match(context, /User is on \/about\/muses/);
});

test("buildRecommendationContext keeps generic high-signal page guidance on root route", () => {
  const context = buildRecommendationContext(
    [{ role: "user", content: "what should I listen to?" }],
    fixtureInjects,
    { pathname: "/" },
  );
  assert.match(context, /User page context is high-signal when present/);
});

test("inferPageType classifies /oops as not-found", () => {
  assert.equal(inferPageType({ pathname: "/oops" }), "not-found");
  assert.equal(inferPageType({ pathname: "/oops/" }), "not-found");
});

test("buildRecommendationContext adds not-found recovery guidance on /oops", () => {
  const context = buildRecommendationContext([{ role: "user", content: "what should I listen to here?" }], fixtureInjects, {
    pathname: "/oops",
  });
  assert.match(context, /User is on \/oops \(not-found recovery context\)/);
  assert.match(context, /\[Sitemap\]\(\/sitemap\)/);
});

test("buildRecommendationContext enforces route-aware delivery on songbook asks", () => {
  const context = buildRecommendationContext(
    [{ role: "user", content: "what should i listen to?" }],
    fixtureInjects,
    { pathname: "/songbooks/lang-french" },
  );
  assert.match(context, /Route-aware delivery rule \(MUST\): deliver concrete guidance immediately/);
  assert.match(context, /Songbook-page behavior \(MUST\): start with the current songbook and one complementary listening route/);
  assert.match(
    context,
    /Songbook-page concrete anchor \(MUST\): explicitly reference \[Lang: French\]\(\/songbooks\/lang-french\)/,
  );
});

test("buildRecommendationContext enforces route-aware delivery on sutras overview asks", () => {
  const context = buildRecommendationContext(
    [{ role: "user", content: "what's good here\?" }],
    fixtureInjects,
    { pathname: "/about/sutras" },
  );
  assert.match(context, /Route-aware delivery rule \(MUST\): deliver concrete guidance immediately/);
  assert.match(context, /Sutras-overview behavior \(MUST\): start with one concrete sutra entry point and one concrete listening path/);
  assert.match(context, /Sutras-overview concrete anchor \(MUST\): include at least one direct sutra link/);
});

test("buildRecommendationContext enforces route-aware delivery on song-detail more-like-this asks", () => {
  const context = buildRecommendationContext(
    [{ role: "user", content: "more like this" }],
    fixtureInjects,
    { pathname: "/songs/tell-the-truth" },
  );
  assert.match(context, /Route-aware delivery rule \(MUST\): deliver concrete guidance immediately/);
  assert.match(context, /Song-detail 'more like this' behavior \(MUST\): name the current song, then provide one similar pick and one listening route/);
});

test("buildRecommendationContext provides exact global catalog totals and bans approximations", () => {
  const context = buildRecommendationContext(
    [{ role: "user", content: "what's good here?" }],
    fixtureInjects,
    { pathname: "/about/sutras" },
  );
  assert.match(
    context,
    /Catalog stats safety \(P0, MUST\): if you mention global totals, use exact values from this data only: 6 songs, 17 tracks, 4 songbooks, 5 sutras\./,
  );
  assert.match(context, /never use approximate totals .* and never guess counts/);
});

test("buildRecommendationContext boosts songs whose track facets match the ask", () => {
  const context = buildRecommendationContext([{ role: "user", content: "got trippy music?" }], fixtureInjects, {
    pathname: "/tracks",
  });
  assert.ok(context.indexOf("Cosmic Drift | cosmic-drift") < context.indexOf("Bright Morning | bright-morning"));
  assert.match(context, /\[TRIPPY Mood Tracks \(\d+ tracks\)\]\(\/tracks\/\?mood=TRIPPY&tsort=likes\)/);
  assert.match(context, /MUST include one teach-to-fish line: tell the user they can refine with mood \+ instrument \+ primary genre/);
  assert.match(context, /do not enumerate full mood\/instrument inventories unless user explicitly asks for all facets/);
  assert.match(context, /Use 1-2 examples max plus 'etc\.'/);
});

test("sound-led jazz ask routes to primary genre and tracks-first guidance", () => {
  const context = buildRecommendationContext([{ role: "user", content: "any jazz?" }], fixtureInjects, { pathname: "/tracks" });
  assert.match(context, /Classify this ask as sound-led/);
  assert.match(context, /Lead with \/tracks routes first/);
  assert.match(context, /\/tracks\/\?primary_genre=JAZZ&tsort=likes/);
  assert.match(context, /tracks are often hybrid\/experimental, not strict single-genre buckets/);
  assert.match(context, /pair primary genre route\(s\) with one secondary\/cross-genre search route/);
});

test("sound-led instrument ask routes to instrument filter", () => {
  const context = buildRecommendationContext([{ role: "user", content: "songs with cello please" }], fixtureInjects, {
    pathname: "/tracks",
  });
  assert.match(context, /Classify this ask as sound-led/);
  assert.match(context, /\/tracks\/\?instrument=CELLO&tsort=likes/);
});

test("sound-led frenchy ask routes with explicit mood filter", () => {
  const context = buildRecommendationContext([{ role: "user", content: "give me frenchy tracks" }], fixtureInjects, {
    pathname: "/tracks",
  });
  assert.match(context, /Classify this ask as sound-led/);
  assert.match(context, /\/tracks\/\?mood=FRENCHY&tsort=likes/);
});

test("newness intent fires on canonical what-is-new phrases", () => {
  const prompts = [
    "what's new?",
    "what's recent",
    "anything new",
    "latest drops please",
    "what should i check first",
    "recently released tracks?",
  ];

  for (const prompt of prompts) {
    const context = buildRecommendationContext([{ role: "user", content: prompt }], fixtureInjects, { pathname: "/" });
    assert.match(context, /Classify this ask as newness-led/);
    assert.match(context, /\[Newest Songs\]\(\/songs\/\?sort=newest\)/);
    assert.match(context, /\[Newest Tracks\]\(\/tracks\/\?tsort=newest\)/);
    assert.match(context, /\[Latest Words\]\(\/words\)/);
  }
});

test("newness intent does not false-fire on red-herring new phrases", () => {
  const redHerrings = ["I'm new here", "new to me", "new song idea"];
  for (const prompt of redHerrings) {
    const context = buildRecommendationContext([{ role: "user", content: prompt }], fixtureInjects, { pathname: "/" });
    assert.doesNotMatch(context, /Classify this ask as newness-led/);
  }
});

test("psychedelic exception prefers text search route plus trippy mood", () => {
  const context = buildRecommendationContext([{ role: "user", content: "i'm into psychedelic stuff" }], fixtureInjects, {
    pathname: "/tracks",
  });
  assert.match(context, /Psychedelic exception/);
  assert.match(context, /\/tracks\/\?q=psychedelic&tsort=likes/);
  assert.match(context, /\/tracks\/\?mood=TRIPPY&tsort=likes/);
});

test("breadth-led sutra ask routes to songs and tracks and explains blow-vs-quack", () => {
  const context = buildRecommendationContext([{ role: "user", content: "list every BLOWsutra song" }], fixtureInjects, {
    pathname: "/about/blowsutra",
  });
  assert.match(context, /Classify this ask as breadth-led/);
  assert.match(context, /\/songs\/\?sutra=BLOWSUTRA&tsort=likes/);
  assert.match(context, /\/tracks\/\?sutra=BLOWSUTRA&tsort=likes/);
  assert.match(context, /BLOWsutra is the broad injustice frame; QUACKsutra is the political-foul-play sub-sutra/);
});

test("listening-focused sound ask de-prioritizes lyrics-only shortlist entries", () => {
  const context = buildRecommendationContext(
    [{ role: "assistant", content: "prior turn" }, { role: "user", content: "I want dance tracks" }],
    fixtureInjects,
    { pathname: "/tracks" },
  );
  assert.match(context, /Listening-focused ask: de-prioritize lyrics-only picks/);
  assert.doesNotMatch(context, /Paper Lantern Prayer \| paper-lantern-prayer/);
});

test("meaning-led ask does not force sound-led classification", () => {
  const context = buildRecommendationContext([{ role: "user", content: "I need hope" }], fixtureInjects);
  assert.doesNotMatch(context, /Classify this ask as sound-led/);
});

test("explicit lyrics-only ask keeps lyrics-only songs eligible", () => {
  const context = buildRecommendationContext(
    [{ role: "user", content: "show me all hope songs, lyrics-only is fine too" }],
    fixtureInjects,
  );
  assert.match(context, /Paper Lantern Prayer \| paper-lantern-prayer/);
  assert.match(context, /availability:lyrics-only/);
  assert.match(
    context,
    /If including lyrics-only songs, clearly mark them as lyrics-only \/ audio in progress and frame them as optional pipeline glimpses\./,
  );
});

test("multi-turn explicit song ask keeps lyrics-only out of shortlist on follow-up", () => {
  const transcriptFixture: LibraryInjects = {
    ...fixtureInjects,
    songs: [
      "We Remember What (We Remember What) We Feel | ideas you can feel in your bones. | GROWsutra | TRUTH | beBRAVE | LIGHT | we-remember-what-we-feel",
      "Broken Whole | Words falling apart and finding meaning. | GROWsutra | TRUTH | beBRAVE | LIGHT | broken-whole",
      "Poetry Matters | Poetry is survival. | GLOWsutra | TRUTH | beBRAVE | LIGHT | poetry-matters",
    ].join("\n"),
    tracks: ["We Remember What (We Remember What) We Feel | 3trk | INDIE | KINDLY | MID | GUITAR"].join("\n"),
    videos: "",
  };

  const context = buildRecommendationContext(
    [
      { role: "user", content: "okay, give me a song" },
      { role: "assistant", content: "Before I point you somewhere, one quick question..." },
      { role: "user", content: "\"ideas you can feel\" sounds like a good start" },
    ],
    transcriptFixture,
  );

  assert.match(context, /Listening-focused ask: de-prioritize lyrics-only picks/);
  assert.match(context, /We Remember What \(We Remember What\) We Feel \| we-remember-what-we-feel/);
  assert.doesNotMatch(context, /Broken Whole \| broken-whole/);
  assert.doesNotMatch(context, /Poetry Matters \| poetry-matters/);
});

test("phrase and keyword relevancy boosts literal-title matches", () => {
  const context = buildRecommendationContext(
    [
      { role: "user", content: "okay, give me a song" },
      { role: "assistant", content: "Before I point you somewhere, one quick question..." },
      { role: "user", content: "\"ideas you can feel\" sounds like a good start" },
    ],
    fixtureInjects,
  );
  assert.match(context, /Ranked shortlist:/);
  assert.match(context, /Use titled markdown links like \[Song Title\]\(\/songs\/slug\)\./);
});

test("multi-turn explicit delivery ask enforces deliver-now guidance", () => {
  const context = buildRecommendationContext(
    [
      { role: "assistant", content: "Prior guidance turn." },
      { role: "user", content: "okay, give me a song" },
    ],
    fixtureInjects,
  );
  assert.match(context, /Deliver-the-goods rule \(MUST\): user explicitly asked for a recommendation after prior turns/);
  assert.match(context, /Do not reply with questions only/);
  assert.match(context, /Clarifying-question guardrail \(MUST\): you may ask one narrowing question only if paired with a concrete default pick/);
});

test("recommendation flow enforces one-question budget before concrete delivery", () => {
  const context = buildRecommendationContext(
    [
      { role: "assistant", content: "Welcome." },
      { role: "user", content: "pls serve my soul and ears" },
      { role: "assistant", content: "Mood, meaning, or both?" },
      { role: "user", content: "both :)" },
    ],
    fixtureInjects,
  );
  assert.match(context, /Deliver-the-goods rule \(MUST\): user explicitly asked for a recommendation after prior turns/);
  assert.match(context, /Clarifying-question budget \(MUST\): you already asked one clarifying question in this recommendation flow/);
});

test("hope ask injects universal-light guidance across all sutras", () => {
  const context = buildRecommendationContext([{ role: "user", content: "I need hope" }], fixtureInjects);
  assert.match(context, /Hope handling \(MUST\): frame hope as a universal LIGHT lens across all 7 sutras/);
  assert.match(context, /Hope route literacy: after concrete picks, you may expose \[All LIGHT Songs\]\(\/songs\/\?ls=LIGHT\)/);
  assert.match(context, /Hope quality guardrail: avoid context-mismatched intimacy picks/);
});

test("favorite-song ask injects it-depends guidance", () => {
  const context = buildRecommendationContext(
    [{ role: "assistant", content: "Prior turn." }, { role: "user", content: "what's your favorite song?" }],
    fixtureInjects,
  );
  assert.match(context, /Favorite-song handling: mirror an 'it depends' stance and offer 2-4 candidates/);
  assert.match(context, /never claim one definitive favorite/);
});

test("guidance includes global recommendation funnel and diversity transparency", () => {
  const context = buildRecommendationContext([{ role: "user", content: "I need hope, can you suggest songs?" }], fixtureInjects);
  assert.match(context, /Global recommendation funnel \(MUST\): order recommendations as sutra lens first, then listening route\(s\), then specific songs, then optional lyrics-only tail/);
  assert.match(context, /If user asks about repetition\/diversity, answer plainly: you can diversify strongly within this conversation/);
  assert.match(context, /Originality\/source rule \(MUST\): prefer original Bananasutra lyrics by default/);
});

test("guidance includes coherence mode and metadata bridge language", () => {
  const context = buildRecommendationContext([{ role: "user", content: "I feel stuck, recommend something soulful" }], fixtureInjects);
  assert.match(context, /Recommendation coherence mode \(MUST\): this ask is best served as meaning-first/);
  assert.match(context, /Metadata bridge rule \(MUST\): tie each recommendation to explicit catalog metadata/);
});

test("meaning-led asks include natural lyrics-extract guidance", () => {
  const context = buildRecommendationContext([{ role: "user", content: "I feel stuck, recommend something soulful" }], fixtureInjects);
  assert.match(
    context,
    /Lyrics extract usage \(MUST\): for meaning-led asks, use one short lyric extract as an add-on to a specific song recommendation, and explain why it matches the user's ask\./,
  );
  assert.match(context, /Lyrics extract stand-alone exception: use a stand-alone lyric quote only when exceptionally relevant/);
  assert.match(context, /Lyrics extract frequency \(MUST\): include at most one short lyric extract in this reply\./);
  assert.match(context, /Lyrics extract source safety \(MUST\): quote only from provided lyric_extract snippets/);
});

test("explicit lyrics asks allow up to two short extracts", () => {
  const context = buildRecommendationContext([{ role: "user", content: "recommend a song and give me a lyric quote" }], fixtureInjects);
  assert.match(context, /Lyrics extract frequency \(MUST\): user explicitly asked for words\/quotes, so you may include up to two short lyric extracts\./);
  assert.match(context, /Lyrics extract length \(MUST\): keep each extract short/);
});

test("route-first asks do not force lyric excerpts", () => {
  const context = buildRecommendationContext([{ role: "user", content: "show me the jazz tracks route" }], fixtureInjects, {
    pathname: "/tracks",
  });
  assert.match(context, /For route\/navigation-first asks, do not force lyric excerpts\./);
});

test("orientation asks inject concise actionable link-pack guidance", () => {
  const context = buildRecommendationContext([{ role: "user", content: "what is this place?" }], fixtureInjects, {
    pathname: "/",
  });
  assert.match(context, /Orientation ask handling \(MUST\): keep response concise/);
  assert.match(context, /Orientation structure \(MUST\): format as \(1\) one warm intro line, \(2\) a quick-map section with 3-5 bullets in order \(Sutras, Songbooks, Songs, Tracks\)/);
  assert.match(context, /Orientation first line \(MUST\): start warm and human, and avoid mechanical opener forms/);
  assert.match(context, /avoid "You're in Bananasutra" phrasing entirely/);
  assert.match(context, /do not start with "You're in Bananasutra" or "You're exploring Bananasutra"/);
  assert.match(context, /do not start with "This is Bananasutra:"/);
  assert.match(context, /start with a warm welcome-style sentence/);
  assert.match(context, /do not lead with song\/track totals unless user explicitly asked for numbers/);
  assert.match(context, /Orientation opening anti-brochure rule \(MUST\): do not open with a provenance\/attribution paragraph/);
  assert.match(context, /Orientation link pack \(MUST\): include \[Sutras\]\(\/about\/sutras\), \[Songs\]\(\/songs\), \[Tracks\]\(\/tracks\), and \[About\]\(\/about\)/);
  assert.match(context, /present the quick map in this order: Sutras, Songbooks, Songs, then Tracks/);
  assert.match(context, /Orientation link formatting \(MUST\): embed links inline as markdown labels/);
  assert.match(context, /never parenthetical raw routes like 'Songs \(\/songs\)'/);
  assert.match(context, /Framing balance \(MUST\): do not dismiss listening-forward behavior/);
  assert.match(context, /Avoid contrast phrasing like "not a jukebox"/);
  assert.match(context, /Framing hard-ban \(MUST\): never output the phrase "not a jukebox"/);
  assert.match(context, /Orientation markdown safety \(MUST\): do not use unmatched emphasis markers/);
  assert.match(context, /For orientation bullets, prefer plain bullets over decorative bold wrappers/);
  assert.match(context, /Orientation markdown safe-style \(MUST\): if using emphasis, only use label-form bold at bullet starts/);
  assert.match(context, /with open\+close markers on the same line/);
  assert.match(context, /Orientation quick-map bullets \(MUST\): use concise bullets in order Sutras, Songbooks, Songs, Tracks, with label\+link pattern/);
  assert.match(context, /First-contact tone floor \(MUST\): keep one light butler flourish/);
  assert.match(context, /First-contact warmth anchor \(MUST\): start with a welcome-style sentence that feels warm and human/);
  assert.match(context, /Orientation anti-repetition style \(MUST\): avoid repeated-label phrasing like "Sutras: Start with Sutras\.\.\."/);
  assert.match(context, /Orientation attribution scope \(MUST\): skip creator\/AI attribution blocks here unless the user explicitly asked authorship\/identity/);
  assert.match(context, /songs are meaning-first storytelling \(sutra\/topic\/intention/);
  assert.match(context, /Orientation LIGHT\/SHADOW pairing \(MUST\): if you mention LIGHT or SHADOW, include both clickable links together/);
  assert.match(context, /\[LIGHT Songs\]\(\/songs\/\?ls=LIGHT\) and \[SHADOW Songs\]\(\/songs\/\?ls=SHADOW\)/);
  assert.match(context, /and secondary\/cross-genre search/);
  assert.match(context, /Search-link relevance \(MUST\): do not inject unrelated hardcoded search queries/);
  assert.match(context, /If no keyword is present, point to \[Songs\]\(\/songs\) and \[Tracks\]\(\/tracks\)/);
  assert.match(context, /Songbook actionability \(MUST\): avoid dropping unlinked songbook title examples/);
  assert.match(context, /Songbook map wording \(MUST\): when describing sutra buckets, name the noun explicitly/);
  assert.match(context, /Songbook lane count safety \(MUST\): do not invent per-sutra ranges/);
});

test("feedback/contact asks inject #bbb-send handoff with footer fallback", () => {
  const context = buildRecommendationContext([{ role: "user", content: "I want to leave feedback for the creator" }], fixtureInjects);
  assert.match(context, /\[Send Banana a note\]\(#bbb-send\?intent=feedback\)/);
  assert.match(context, /\[Contact\]\(\/#footer-contact-panel\)/);
  assert.match(context, /same inbox if the chat send path fails/);
  assert.match(context, /Honesty guardrail \(MUST\): do not claim the message was sent until the system confirms delivery/);
});

test("contact routing asks use brief same-inbox guidance without longer-form framing", () => {
  const context = buildRecommendationContext(
    [{ role: "user", content: "how do I contact the human behind this?" }],
    fixtureInjects,
  );
  assert.match(context, /Contact routing \(MUST\): user asked how to reach the creator/);
  assert.match(context, /\[Send Banana a note\]\(#bbb-send\)/);
  assert.match(context, /\[Contact\]\(\/#footer-contact-panel\)/);
  assert.match(context, /same note to Banana/);
  assert.match(context, /typing in chat does not deliver mail/);
  assert.doesNotMatch(context, /longer-form fallback/);
});

test("song idea asks inject immediate song-idea send link without chat-only prompts", () => {
  const context = buildRecommendationContext([{ role: "user", content: "I have an idea for a song" }], fixtureInjects);
  assert.match(context, /Song idea handoff \(MUST\): user has a song idea for Banana/);
  assert.match(context, /\[Send Banana a note\]\(#bbb-send\?intent=song-idea\)/);
  assert.match(context, /typing the pitch in chat does NOT deliver it/);
  assert.match(context, /Do not interrogate the idea in chat first/);
  assert.match(context, /What's on your mind/);
});

test("feedback intent patterns classify all four handoff intents", () => {
  const feedbackContext = buildRecommendationContext([{ role: "user", content: "I want to leave feedback" }], fixtureInjects);
  const songIdeaContext = buildRecommendationContext([{ role: "user", content: "I have an idea for a song" }], fixtureInjects);
  const bugContext = buildRecommendationContext([{ role: "user", content: "this is broken, who do I tell?" }], fixtureInjects);
  const brokenLinkContext = buildRecommendationContext([{ role: "user", content: "that 404 is a broken link" }], fixtureInjects);

  assert.match(feedbackContext, /\[Send Banana a note\]\(#bbb-send\?intent=feedback\)/);
  assert.match(songIdeaContext, /\[Send Banana a note\]\(#bbb-send\?intent=song-idea\)/);
  assert.match(bugContext, /\[Send Banana a note\]\(#bbb-send\?intent=bug-report\)/);
  assert.match(brokenLinkContext, /\[Send Banana a note\]\(#bbb-send\?intent=broken-link\)/);

  const redHerring = buildRecommendationContext([{ role: "user", content: "this playlist idea sounds fun" }], fixtureInjects);
  assert.doesNotMatch(redHerring, /#bbb-send/);
});

test("guidance lists previously recommended slugs to avoid repeats", () => {
  const context = buildRecommendationContext(
    [
      { role: "assistant", content: "Try [Bright Morning](/songs/bright-morning) and [Quiet Lantern](/songs/quiet-lantern)." },
      { role: "user", content: "recommend something hopeful" },
    ],
    fixtureInjects,
  );
  assert.match(context, /Already used slugs: bright-morning, quiet-lantern/);
  assert.match(context, /avoid exact slug repeats from this conversation unless the user asks for the same song again/);
});

test("support guidance includes R-rated contextual safety rule", () => {
  const context = buildRecommendationContext([{ role: "user", content: "I feel completely alone" }], fixtureInjects);
  assert.match(context, /Support safety rule \(MUST\): avoid R-rated intimacy material/);
  assert.match(context, /when-we-duende-all-night/);
});

test("guidance names shortlist lyrics-only titles for inline labeling", () => {
  const context = buildRecommendationContext([{ role: "user", content: "show me all hope songs" }], fixtureInjects);
  assert.match(context, /This shortlist includes lyrics-only titles:/);
  assert.match(context, /Paper Lantern Prayer \(paper-lantern-prayer\)/);
  assert.match(context, /append '\(lyrics-only, audio in progress\)' directly after the title/);
  assert.match(context, /do not present them as playable/);
});

test("support scoring de-prioritizes when-we-duende-all-night in sensitive support contexts", () => {
  const supportFixture: LibraryInjects = {
    ...fixtureInjects,
    songs: [
      "When We Duende (All Night) | Intimate peachy heat. | FLOWsutra | LOVE | beCLOSE | LIGHT | when-we-duende-all-night",
      "We Remember What (We Remember What) We Feel | Gentle grounding and remembrance. | FLOWsutra | HEALING | beKIND | LIGHT | we-remember-what-we-feel",
    ].join("\n"),
    tracks: [
      "When We Duende (All Night) | 2trk | INDIE | PEACHY | MID | GUITAR",
      "We Remember What (We Remember What) We Feel | 2trk | INDIE | KINDLY | MID | GUITAR",
    ].join("\n"),
    videos: "",
  };
  const context = buildRecommendationContext([{ role: "user", content: "I feel lonely and grieving" }], supportFixture);
  assert.ok(
    context.indexOf("We Remember What (We Remember What) We Feel | we-remember-what-we-feel") <
      context.indexOf("When We Duende (All Night) | when-we-duende-all-night"),
  );
});

test("support regex boundaries do not false-match words like warmth or courage", () => {
  const boundaryFixtureInjects: LibraryInjects = {
    ...fixtureInjects,
    songs: [
      "Warm Courage | Moving toward the light with warmth and courage. | GROWsutra | HOPE | COURAGE | LIGHT | warm-courage",
      "Rage Spiral | A raging panic spiral and nightmare loop. | BLOWsutra | FEAR | ANXIETY | SHADOW | rage-spiral",
    ].join("\n"),
    tracks: [
      "Warm Courage | 1trk | INDIE | KINDLY | MID | GUITAR",
      "Rage Spiral | 1trk | ROCK | STORMY | FAST | DRUMS",
    ].join("\n"),
    videos: "",
  };

  const context = buildRecommendationContext(
    [{ role: "user", content: "I need hope, something steady and kind" }],
    boundaryFixtureInjects,
  );

  assert.ok(context.indexOf("Warm Courage | warm-courage") < context.indexOf("Rage Spiral | rage-spiral"));
});

test("non-cover asks prefer original songs over cover/public-domain songs", () => {
  const coverFixtureInjects: LibraryInjects = {
    ...fixtureInjects,
    songs: [
      "Original Glow | A bright original anthem. | GLOWsutra | HOPE | beBRIGHT | LIGHT | original-glow | A tiny light survives the storm. | false | false",
      "Traditional Echo | A classic standard reframed. | GLOWsutra | HOPE | beBRIGHT | LIGHT | traditional-echo | Old words, new breath. | true | true",
    ].join("\n"),
    tracks: [
      "Original Glow | 2trk | INDIE | KINDLY | MID | PIANO",
      "Traditional Echo | 2trk | INDIE | KINDLY | MID | PIANO",
    ].join("\n"),
    videos: "",
  };

  const context = buildRecommendationContext([{ role: "user", content: "recommend a hopeful song" }], coverFixtureInjects);
  assert.ok(context.indexOf("Original Glow | original-glow") < context.indexOf("Traditional Echo | traditional-echo"));
});
