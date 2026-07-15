/**
 * SPA path classification for GitHub Pages shell substitution (see `src/spaShell.ts`).
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  pathnameNeedsSpaShell,
  requestMayNeedSpaShell,
  SPA_PATH_PREFIXES,
} from "../src/spaShell.ts";

test("SPA_PATH_PREFIXES documents primary app routes", () => {
  assert.ok(SPA_PATH_PREFIXES.includes("/songs"));
  assert.ok(SPA_PATH_PREFIXES.includes("/songbooks"));
  assert.ok(SPA_PATH_PREFIXES.includes("/about"));
  assert.ok(SPA_PATH_PREFIXES.includes("/learn"));
  assert.ok(SPA_PATH_PREFIXES.includes("/listen"));
  assert.ok(SPA_PATH_PREFIXES.includes("/watch"));
});

test("pathnameNeedsSpaShell: known client prefixes", () => {
  assert.equal(pathnameNeedsSpaShell("/songs/curious-like-a-kiss"), true);
  assert.equal(pathnameNeedsSpaShell("/songs"), true);
  assert.equal(pathnameNeedsSpaShell("/songbooks/banana"), true);
  assert.equal(pathnameNeedsSpaShell("/sutras"), true);
  assert.equal(pathnameNeedsSpaShell("/about/sutras"), true);
  assert.equal(pathnameNeedsSpaShell("/tracks"), true);
  assert.equal(pathnameNeedsSpaShell("/videos"), true);
  assert.equal(pathnameNeedsSpaShell("/words"), true);
  assert.equal(pathnameNeedsSpaShell("/search"), true);
  assert.equal(pathnameNeedsSpaShell("/learn"), true);
  assert.equal(pathnameNeedsSpaShell("/listen"), true);
  assert.equal(pathnameNeedsSpaShell("/watch"), true);
  assert.equal(pathnameNeedsSpaShell("/manifesto"), true);
  assert.equal(pathnameNeedsSpaShell("/privacy"), true);
  assert.equal(pathnameNeedsSpaShell("/style-guide"), true);
  assert.equal(pathnameNeedsSpaShell("/sitemap"), true);
});

test("pathnameNeedsSpaShell: home and static exclusions", () => {
  assert.equal(pathnameNeedsSpaShell("/"), false);
  assert.equal(pathnameNeedsSpaShell("/assets/index-abc123.js"), false);
  assert.equal(pathnameNeedsSpaShell("/robots.txt"), false);
  assert.equal(pathnameNeedsSpaShell("/feed.xml"), false);
  assert.equal(pathnameNeedsSpaShell("/llms.txt"), false);
  assert.equal(pathnameNeedsSpaShell("/sitemap.xml"), false);
  assert.equal(pathnameNeedsSpaShell("/seo-metadata.json"), false);
});

test("pathnameNeedsSpaShell: unknown paths stay false (real 404s)", () => {
  assert.equal(pathnameNeedsSpaShell("/api/foo"), false);
  assert.equal(pathnameNeedsSpaShell("/song"), false);
});

test("requestMayNeedSpaShell: method gate", () => {
  assert.equal(
    requestMayNeedSpaShell(
      new Request("https://example.com/songs/x", { method: "POST" }),
    ),
    false,
  );
  assert.equal(
    requestMayNeedSpaShell(new Request("https://example.com/songs/x")),
    true,
  );
});
