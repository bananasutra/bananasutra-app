import test from "node:test";
import assert from "node:assert/strict";
import { isOrientationAsk, normalizeOrientationReply } from "./reply-normalizer";

test("isOrientationAsk matches common orientation prompts", () => {
  assert.equal(isOrientationAsk("what is this place?"), true);
  assert.equal(isOrientationAsk("where should I start"), true);
  assert.equal(isOrientationAsk("recommend me a song"), false);
});

test("normalizeOrientationReply returns canonical orientation map", () => {
  const raw = "Anything model-generated goes here and is normalized.";
  const normalized = normalizeOrientationReply(raw);
  assert.match(normalized, /(Welcome|Bonjour|Glad you asked)/);
  assert.match(normalized, /(quick map|Quick map)/);
  assert.match(normalized, /\*\*\[Sutras\]\(\/sutras\):\*\*/);
  assert.match(normalized, /\*\*\[Songbooks\]\(\/songbooks\):\*\*/);
  assert.match(normalized, /\*\*\[Songs\]\(\/songs\):\*\*/);
  assert.match(normalized, /\[LIGHT\]\(\/songs\/\?ls=LIGHT\)/);
  assert.match(normalized, /\[SHADOW\]\(\/songs\/\?ls=SHADOW\)/);
  assert.match(normalized, /\/songs\/\?sutra=[A-Z]+SUTRA&tsort=likes|\/songs\/\?find=/);
  assert.match(normalized, /sutra, topic, intention, .*search/i);
  assert.match(normalized, /intention, topic, and sutra|intention\/topic\/sutra/i);
  assert.match(normalized, /\*\*\[Top Tracks\]\(\/tracks\):\*\*/);
  assert.match(normalized, /\/tracks\/\?mood=[A-Z]+&tsort=likes|\/tracks\/\?primary_genre=[A-Z]+&tsort=likes|\/tracks\/\?q=[a-z]+&tsort=likes/);
  assert.match(normalized, /mood .* instrument .* primary genre|mood-led listening routes by instrument and primary genre/i);
  assert.match(normalized, /autoplay can be limited|keep listening flow on mobile|practical listening flow easy, especially on mobile|especially handy on mobile/);
  assert.match(normalized, /Songs are for meaning-first story depth|Songs lead with meaning and lyrics/);
  assert.doesNotMatch(normalized, /not a jukebox/i);
  assert.doesNotMatch(normalized, /\bvia\s+\[/i);
  assert.doesNotMatch(normalized, /Sutras:\s*Sutras/i);
  assert.doesNotMatch(normalized, /Songbooks:\s*Songbooks/i);
  assert.doesNotMatch(normalized, /Songs:\s*Songs/i);
  assert.doesNotMatch(normalized, /Top Tracks:\s*Top Tracks/i);
  assert.doesNotMatch(normalized, /topic\/sutra/i);
});

test("normalizeOrientationReply varies phrasing by input while preserving structure", () => {
  const a = normalizeOrientationReply("orientation variant A");
  const b = normalizeOrientationReply("orientation variant B");
  assert.notEqual(a, b);
  for (const output of [a, b]) {
    assert.match(output, /\*\*\[Sutras\]\(\/sutras\):\*\*/);
    assert.match(output, /\*\*\[Songbooks\]\(\/songbooks\):\*\*/);
    assert.match(output, /\*\*\[Songs\]\(\/songs\):\*\*/);
    assert.match(output, /\*\*\[Top Tracks\]\(\/tracks\):\*\*/);
    assert.match(output, /\[LIGHT\]\(\/songs\/\?ls=LIGHT\)/);
    assert.match(output, /\[SHADOW\]\(\/songs\/\?ls=SHADOW\)/);
  }
});

test("normalizeOrientationReply avoids identity re-intro on follow-up turns", () => {
  const normalized = normalizeOrientationReply("what is this place?", { hasPriorAssistantTurn: true });
  assert.doesNotMatch(normalized, /I am Bertrand, your Banana Butler/i);
  assert.match(normalized, /(Lovely question|Perfect timing|Great, let us map)/);
});

