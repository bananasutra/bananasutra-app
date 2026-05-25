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
  ].join("\n"),
  tracks: [
    "Bright Morning | 5trk | INDIE | CALM | MID | PIANO",
    "Quiet Lantern | 2trk | FOLK | CALM | SLOW | GUITAR",
    "Paris At Dawn | 3trk | JAZZ | FRENCHY,CHEEKY | MID | ACCORDION",
  ].join("\n"),
  videos: ["Bright Morning | 2vid | INDIE | feat:yes", "Shadow Spiral | 1vid | ROCK | feat:no"].join("\n"),
  songbooks: [
    "Play: B.J. (Banana Jokes) | Tiny joke pack. | SHOWsutra | FUN | play-bj-banana-jokes",
    "SHOWsutra : Fanana Club | Big absurd stage energy. | SHOWsutra | FUN | showsutra-fanana-club",
    "Play: PEACE CIRCUS | Playful collective chaos. | SHOWsutra | FUN | play-peace-circus",
  ].join("\n"),
  quotes: "",
  muses: "",
};

test("buildRecommendationContext returns ranked playable shortlist for support intent", () => {
  const context = buildRecommendationContext([{ role: "user", content: "I need hope, can you suggest songs?" }], fixtureInjects);
  assert.match(context, /Ranked shortlist:/);
  assert.match(context, /Begin with one short natural sentence that names the sutra angle/);
  assert.match(context, /3-5 short bullets max/);
  assert.match(context, /availability:audio\+video/);
  assert.match(context, /Bright Morning \| bright-morning/);
  assert.match(context, /Quiet Lantern \| quiet-lantern/);
  assert.match(context, /Paper Lantern Prayer \| paper-lantern-prayer/);
  assert.match(context, /availability:lyrics-only/);
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
  );
  assert.match(context, /\[FRENCHY Mood Tracks\]\(\/tracks\/\?mood=FRENCHY&tsort=likes\)/);
  assert.ok(context.indexOf("Paris At Dawn | paris-at-dawn") < context.indexOf("Bright Morning | bright-morning"));
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
  assert.match(context, /\[Cheeky Mood Tracks\]\(\/tracks\/\?mood=CHEEKY&tsort=likes\)/);
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
