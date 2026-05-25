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
  assert.match(BBB_SYSTEM_PROMPT_TEMPLATE, /3-5 short bullets max/);
  assert.match(BBB_SYSTEM_PROMPT_TEMPLATE, /why this fits you right now/);
  assert.match(BBB_SYSTEM_PROMPT_TEMPLATE, /do not repeat your opening identity\/intro lines/);
  assert.match(BBB_SYSTEM_PROMPT_TEMPLATE, /On non-first turns, answer directly/);
  assert.match(BBB_SYSTEM_PROMPT_TEMPLATE, /begin with one short natural acknowledgement/);
  assert.match(BBB_SYSTEM_PROMPT_TEMPLATE, /Never output the em-dash character/);
  assert.match(BBB_SYSTEM_PROMPT_TEMPLATE, /Do not claim user history you do not actually have/);
  assert.match(BBB_SYSTEM_PROMPT_TEMPLATE, /Do not add random French words or familiar slang/);
  assert.match(BBB_SYSTEM_PROMPT_TEMPLATE, /For fun\/absurd\/humor asks, explicitly frame with SHOWsutra/);
  assert.match(BBB_SYSTEM_PROMPT_TEMPLATE, /Avoid rigid section labels like "Sutra lens:"/);
  assert.match(BBB_SYSTEM_PROMPT_TEMPLATE, /link that specific sutra page/);
  assert.match(BBB_SYSTEM_PROMPT_TEMPLATE, /prefer \/tracks and \/songbooks links/);
  assert.match(BBB_SYSTEM_PROMPT_TEMPLATE, /songbooks are topic-led collections and tracks are mood-led continuous listening/);
  assert.match(BBB_SYSTEM_PROMPT_TEMPLATE, /offer an "explore all" path/);
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
