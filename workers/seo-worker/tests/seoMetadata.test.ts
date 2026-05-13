/**
 * Unit tests for seo-metadata fetch + cache + route resolution.
 *
 * Runner: `node --test` (see package.json). HTMLRewriter stays untested here;
 * use wrangler dev + curl for bot HTML output.
 *
 * Request / URL hosts: every `new URL(...)` and `new Request(...)` in this
 * file uses `https://example.com` on purpose — no HTTP, no claim those paths
 * exist. Only pathname + query handling is under test. Strings inside route
 * fixtures (e.g. `canonical`) mirror production `seo-metadata.json` shape.
 */

import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  SEO_METADATA_TTL_MS,
  SEO_METADATA_ERROR_RETRY_MS,
  HOMEPAGE_DEFAULT_META,
  type SeoMetadataFile,
  getSeoMetadata,
  getRouteMeta,
  normalizePathnameForLookup,
  canonicalUrlForUrl,
  __primeSeoMetadataCacheForTests,
  __resetSeoMetadataCacheForTests,
} from "../src/seoMetadata.ts";

beforeEach(() => {
  __resetSeoMetadataCacheForTests();
});

test("normalizePathnameForLookup strips query and trailing slash", () => {
  assert.equal(
    normalizePathnameForLookup(new URL("https://example.com/songs/ego?q=1")),
    "/songs/ego",
  );
  assert.equal(
    normalizePathnameForLookup(new URL("https://example.com/songs/ego/")),
    "/songs/ego",
  );
  assert.equal(
    normalizePathnameForLookup(new URL("https://example.com/")),
    "/",
  );
  assert.equal(
    normalizePathnameForLookup(new URL("https://example.com")),
    "/",
  );
});

test("getRouteMeta: known route uses catalog canonical; unknown uses request URL", () => {
  const file = {
    generatedAt: "2026-01-01T00:00:00.000Z",
    routes: {
      "/": HOMEPAGE_DEFAULT_META,
      "/songs/ego": {
        title: "Ego · Song · BANANASUTRA",
        description: "Ego description",
        canonical: "https://bananasutra.com/songs/ego",
        type: "music.song",
      },
    },
  };
  const egoReq = new Request("https://example.com/songs/ego?ref=twitter");
  const meta = getRouteMeta(egoReq, file);
  assert.equal(meta.title, "Ego · Song · BANANASUTRA");
  assert.equal(meta.canonical, "https://bananasutra.com/songs/ego");
  assert.equal(meta.type, "music.song");

  const unknownReq = new Request("https://example.com/garbage/path?x=1#h");
  const unknown = getRouteMeta(unknownReq, file);
  assert.equal(unknown.title, HOMEPAGE_DEFAULT_META.title);
  assert.equal(unknown.description, HOMEPAGE_DEFAULT_META.description);
  assert.equal(unknown.type, "website");
  assert.equal(unknown.canonical, "https://example.com/garbage/path");
});

test("canonicalUrlForUrl strips query, hash, and trailing slash", () => {
  assert.equal(
    canonicalUrlForUrl(new URL("https://example.com/garbage/path/?q=1#x")),
    "https://example.com/garbage/path",
  );
});

test("getRouteMeta: unknown uses HOMEPAGE_DEFAULT_META when routes omit /", () => {
  const file: SeoMetadataFile = {
    generatedAt: "2026-01-01T00:00:00.000Z",
    routes: {
      "/songs/ego": {
        title: "Ego · Song · BANANASUTRA",
        description: "Ego description",
        canonical: "https://bananasutra.com/songs/ego",
      },
    },
  };
  const r = getRouteMeta(new Request("https://example.com/nope"), file);
  assert.equal(r.title, HOMEPAGE_DEFAULT_META.title);
  assert.equal(r.canonical, "https://example.com/nope");
});

test("getSeoMetadata: cold fetch calls fetch once", async () => {
  let calls = 0;
  const payload = {
    generatedAt: "2026-05-01T00:00:00.000Z",
    routes: {
      "/": HOMEPAGE_DEFAULT_META,
    },
  };
  const fetcher: typeof fetch = async () => {
    calls += 1;
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  const a = await getSeoMetadata(fetcher);
  const b = await getSeoMetadata(fetcher);
  assert.equal(calls, 1);
  assert.equal(a.generatedAt, payload.generatedAt);
  assert.equal(b.routes["/"]?.title, HOMEPAGE_DEFAULT_META.title);
});

test("getSeoMetadata: expired TTL triggers refetch", async () => {
  let calls = 0;
  const mkResponse = (gen: string) =>
    new Response(
      JSON.stringify({
        generatedAt: gen,
        routes: { "/": HOMEPAGE_DEFAULT_META },
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );

  const fetcher: typeof fetch = async () => {
    calls += 1;
    return mkResponse(calls === 1 ? "first" : "second");
  };

  await getSeoMetadata(fetcher);
  assert.equal(calls, 1);

  __primeSeoMetadataCacheForTests(
    {
      generatedAt: "stale",
      routes: { "/": HOMEPAGE_DEFAULT_META },
    },
    Date.now() - SEO_METADATA_TTL_MS - 1,
  );

  const next = await getSeoMetadata(fetcher);
  assert.equal(calls, 2);
  assert.equal(next.generatedAt, "second");
});

test("getSeoMetadata: fetch failure returns homepage fallback", async () => {
  let calls = 0;
  const fetcher: typeof fetch = async () => {
    calls += 1;
    return new Response("nope", { status: 500 });
  };

  const data = await getSeoMetadata(fetcher);
  assert.equal(calls, 1);
  assert.equal(data.routes["/"]?.title, HOMEPAGE_DEFAULT_META.title);
  assert.equal(data.generatedAt, "1970-01-01T00:00:00.000Z");

  await getSeoMetadata(fetcher);
  assert.equal(
    calls,
    1,
    "failed fetch should stay cached until error retry TTL",
  );
});

test("getSeoMetadata: after error retry TTL, refetch runs", async () => {
  let calls = 0;
  const okPayload = {
    generatedAt: "2026-06-01T00:00:00.000Z",
    routes: { "/": HOMEPAGE_DEFAULT_META },
  };
  const fetcher: typeof fetch = async () => {
    calls += 1;
    if (calls === 1) {
      return new Response("nope", { status: 503 });
    }
    return new Response(JSON.stringify(okPayload), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  await getSeoMetadata(fetcher);
  assert.equal(calls, 1);

  __primeSeoMetadataCacheForTests(
    {
      generatedAt: "1970-01-01T00:00:00.000Z",
      routes: { "/": { ...HOMEPAGE_DEFAULT_META } },
    },
    Date.now() - SEO_METADATA_ERROR_RETRY_MS - 1,
    { fromError: true },
  );

  const next = await getSeoMetadata(fetcher);
  assert.equal(calls, 2);
  assert.equal(next.generatedAt, okPayload.generatedAt);
});

test("getSeoMetadata: invalid JSON uses fallback", async () => {
  const fetcher: typeof fetch = async () =>
    new Response("not json", {
      status: 200,
      headers: { "content-type": "application/json" },
    });

  const data = await getSeoMetadata(fetcher);
  assert.equal(data.routes["/"]?.canonical, HOMEPAGE_DEFAULT_META.canonical);
});

test("getSeoMetadata: network throw uses fallback", async () => {
  const fetcher: typeof fetch = async () => {
    throw new TypeError("network down");
  };
  const data = await getSeoMetadata(fetcher);
  assert.equal(data.routes["/"]?.title, HOMEPAGE_DEFAULT_META.title);
});
