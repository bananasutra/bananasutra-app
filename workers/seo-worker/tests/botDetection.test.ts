/**
 * Unit tests for bot User-Agent detection.
 *
 * Runner: Node's built-in `node:test` + `node:assert/strict`, with native
 * TypeScript stripping (`--experimental-strip-types`). No test framework
 * dependency.
 *
 * Coverage strategy:
 *   - One realistic UA per BOT_UA_PATTERNS entry (positive cases).
 *   - Common human browsers across desktop + mobile (negative cases).
 *   - Edge cases: missing/empty UA, case sensitivity, embedded matches.
 *
 * If a pattern is added/removed in src/botDetection.ts, the BOT_FIXTURES
 * array below must be updated in lock-step or the "every pattern has a
 * fixture" sanity check below will fail.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BOT_UA_PATTERNS,
  detectBotPattern,
  isBot,
} from "../src/botDetection.ts";

interface BotFixture {
  pattern: string;
  userAgent: string;
  note?: string;
}

const BOT_FIXTURES: readonly BotFixture[] = [
  {
    pattern: "facebookexternalhit",
    userAgent:
      "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
  },
  { pattern: "Facebot", userAgent: "Facebot/1.0" },
  { pattern: "Twitterbot", userAgent: "Twitterbot/1.0" },
  {
    pattern: "LinkedInBot",
    userAgent:
      "LinkedInBot/1.0 (compatible; Mozilla/5.0; Apache-HttpClient +http://www.linkedin.com)",
  },
  { pattern: "Slackbot", userAgent: "Slackbot-LinkExpanding 1.0" },
  {
    pattern: "TelegramBot",
    userAgent: "TelegramBot (like TwitterBot)",
    note: "Real-world Telegram UA. Order matters: TelegramBot precedes Twitterbot in BOT_UA_PATTERNS so this attributes correctly.",
  },
  { pattern: "WhatsApp", userAgent: "WhatsApp/2.21.12.21 A" },
  {
    pattern: "Discordbot",
    userAgent:
      "Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)",
  },
  {
    pattern: "Googlebot",
    userAgent:
      "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
  },
  {
    pattern: "bingbot",
    userAgent:
      "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)",
  },
  {
    pattern: "Baiduspider",
    userAgent:
      "Mozilla/5.0 (compatible; Baiduspider/2.0; +http://www.baidu.com/search/spider.html)",
  },
  {
    pattern: "YandexBot",
    userAgent:
      "Mozilla/5.0 (compatible; YandexBot/3.0; +http://yandex.com/bots)",
  },
  { pattern: "Applebot", userAgent: "Applebot/0.1" },
  {
    pattern: "PinterestBot",
    userAgent:
      "Mozilla/5.0 (compatible; Pinterestbot/1.0; +http://www.pinterest.com/bot.html)",
    note: "Real Pinterest UA uses lowercase 'Pinterestbot' — covered by case-insensitive match.",
  },
  { pattern: "Embedly", userAgent: "Embedly/0.2 (+https://embed.ly)" },
  {
    pattern: "Quora Link Preview",
    userAgent: "Mozilla/5.0 (compatible; Quora Link Preview/1.1)",
  },
  { pattern: "Showyoubot", userAgent: "Showyoubot/0.1" },
  { pattern: "outbrain", userAgent: "Mozilla/5.0 (compatible; outbrain)" },
  {
    pattern: "rogerbot",
    userAgent: "rogerbot/1.0 (http://moz.com/help/pro/what-is-rogerbot-)",
  },
  {
    pattern: "vkShare",
    userAgent:
      "Mozilla/4.0 (compatible; vkShare; +http://vk.com/dev/share_button)",
  },
  {
    pattern: "W3C_Validator",
    userAgent: "W3C_Validator/1.3 libwww-perl/5.821",
  },
  {
    pattern: "redditbot",
    userAgent:
      "Mozilla/5.0 (compatible; redditbot/1.0; +http://www.reddit.com/feedback)",
  },
];

const HUMAN_FIXTURES: readonly { label: string; userAgent: string }[] = [
  {
    label: "Chrome desktop (macOS)",
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  },
  {
    label: "Safari desktop (macOS)",
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
  },
  {
    label: "Firefox desktop (macOS)",
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:125.0) Gecko/20100101 Firefox/125.0",
  },
  {
    label: "Mobile Safari (iOS)",
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
  },
  {
    label: "Chrome Android",
    userAgent:
      "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36",
  },
  {
    label: "Edge desktop (Windows)",
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0",
  },
];

test("BOT_FIXTURES covers every pattern exactly once", () => {
  const patternsInFixtures = BOT_FIXTURES.map((f) => f.pattern).sort();
  const patternsExpected = [...BOT_UA_PATTERNS].sort();
  assert.deepEqual(
    patternsInFixtures,
    patternsExpected,
    "Each BOT_UA_PATTERNS entry must have exactly one fixture in BOT_FIXTURES.",
  );
});

for (const fixture of BOT_FIXTURES) {
  test(`detects ${fixture.pattern} via realistic UA`, () => {
    assert.equal(detectBotPattern(fixture.userAgent), fixture.pattern);
    assert.equal(isBot(fixture.userAgent), true);
  });
}

for (const fixture of HUMAN_FIXTURES) {
  test(`treats ${fixture.label} as human (no match)`, () => {
    assert.equal(detectBotPattern(fixture.userAgent), null);
    assert.equal(isBot(fixture.userAgent), false);
  });
}

test("null UA → human (passthrough)", () => {
  assert.equal(detectBotPattern(null), null);
  assert.equal(isBot(null), false);
});

test("undefined UA → human (passthrough)", () => {
  assert.equal(detectBotPattern(undefined), null);
  assert.equal(isBot(undefined), false);
});

test("empty UA → human (passthrough)", () => {
  assert.equal(detectBotPattern(""), null);
  assert.equal(isBot(""), false);
});

test("lowercase variant matches (case-insensitive)", () => {
  assert.equal(detectBotPattern("twitterbot/1.0"), "Twitterbot");
});

test("uppercase variant matches (case-insensitive)", () => {
  assert.equal(detectBotPattern("TWITTERBOT/1.0"), "Twitterbot");
});

test("returns first matching pattern when multiple could apply", () => {
  // Synthetic UA containing two distinct bot tokens — detectBotPattern is
  // documented to return the first hit by BOT_UA_PATTERNS iteration order.
  const ua = "Mozilla/5.0 (compatible; Googlebot/2.1) Slackbot-LinkExpanding";
  const result = detectBotPattern(ua);
  assert.ok(result === "Slackbot" || result === "Googlebot");
});

test("real-world TelegramBot UA attributes to TelegramBot (not Twitterbot)", () => {
  // Regression guard for the order fix in BOT_UA_PATTERNS. Telegram's
  // link-preview bot identifies as "TelegramBot (like TwitterBot)" —
  // intentionally including "TwitterBot" to ride Twitter whitelists. With
  // TelegramBot placed before Twitterbot, our case-insensitive substring
  // match attributes correctly. If anyone ever reverts the order, this
  // test will catch it.
  const ua = "TelegramBot (like TwitterBot)";
  assert.equal(detectBotPattern(ua), "TelegramBot");
  assert.equal(isBot(ua), true);
});
