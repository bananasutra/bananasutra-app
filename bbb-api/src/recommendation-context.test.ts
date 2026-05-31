import test from "node:test";
import assert from "node:assert/strict";
import { buildRecommendationContext } from "./recommendation-context";
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
  assert.match(context, /For non-support asks, do not force LIGHT over SHADOW/);
  assert.match(context, /use the exact mood name FRENCHY/);
  assert.match(context, /\[Frenchy Mood Tracks\]\(\/tracks\/\?mood=FRENCHY&tsort=likes\)/);
  assert.match(context, /\[French Language Songbook\]\(\/songbooks\/lang-french\)/);
  assert.match(context, /\[FRENCHY Mood Tracks(?: \(\d+ tracks\))?\]\(\/tracks\/\?mood=FRENCHY&tsort=likes\)/);
  assert.ok(context.indexOf("Paris At Dawn | paris-at-dawn") < context.indexOf("Bright Morning | bright-morning"));
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

test("broad-sound diversity rotates song shortlist when seed changes", () => {
  const outputs = new Set<string>();
  for (const seed of ["seed-a", "seed-b", "seed-c", "seed-d"]) {
    outputs.add(
      buildRecommendationContext(
        [{ role: "assistant", content: "prior turn" }, { role: "user", content: "got trippy music?" }],
        fixtureInjects,
        { pathname: "/tracks" },
        seed,
      ),
    );
  }
  assert.ok(outputs.size >= 2, "Expected at least two distinct shortlist orderings across seeds");
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
