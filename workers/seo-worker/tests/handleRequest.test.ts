/**
 * handleRequest with mocked `fetch` (Node --test). No HTMLRewriter / Workers APIs.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { handleRequest } from "../src/handleRequest.ts";
import { __primeSeoMetadataCacheForTests } from "../src/seoMetadata.ts";

function htmlResponse(status: number, body: string): Response {
  return new Response(body, {
    status,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

test("deep SPA GET: origin 404 → 200 shell body (human)", async () => {
  __primeSeoMetadataCacheForTests(
    {
      generatedAt: "2026-01-01T00:00:00.000Z",
      routes: {
        "/": {
          title: "Home",
          description: "Home",
          canonical: "https://example.com/",
        },
        "/songs/kiss": {
          title: "Kiss",
          description: "Kiss",
          canonical: "https://example.com/songs/kiss",
        },
      },
    },
    Date.now(),
  );
  const fetcher: typeof fetch = async (input) => {
    const req = input instanceof Request ? input : new Request(input);
    const u = new URL(req.url);
    if (u.pathname === "/songs/kiss" && req.method === "GET") {
      return new Response("not found", { status: 404 });
    }
    if (u.pathname === "/" && req.method === "GET") {
      return htmlResponse(200, "<html><head></head><body>shell</body></html>");
    }
    return new Response("unexpected", { status: 500 });
  };

  const res = await handleRequest(
    new Request("https://example.com/songs/kiss?section=audio"),
    { fetcher },
  );
  assert.equal(res.status, 200);
  const text = await res.text();
  assert.match(text, /shell/);
});

test("deep SPA HEAD: origin 404 → 200 no body", async () => {
  __primeSeoMetadataCacheForTests(
    {
      generatedAt: "2026-01-01T00:00:00.000Z",
      routes: {
        "/about/muses": {
          title: "Muses",
          description: "Muses",
          canonical: "https://example.com/about/muses",
        },
      },
    },
    Date.now(),
  );
  const fetcher: typeof fetch = async (input) => {
    const req = input instanceof Request ? input : new Request(input);
    const u = new URL(req.url);
    if (u.pathname === "/about/muses" && req.method === "HEAD") {
      return new Response(null, { status: 404 });
    }
    if (u.pathname === "/" && req.method === "HEAD") {
      return new Response(null, {
        status: 200,
        headers: { "content-type": "text/html; charset=utf-8", "x-test": "1" },
      });
    }
    return new Response(null, { status: 500 });
  };

  const res = await handleRequest(
    new Request("https://example.com/about/muses", { method: "HEAD" }),
    { fetcher },
  );
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("x-test"), "1");
  assert.equal(await res.text(), "");
});

test("non-SPA 404: passthrough", async () => {
  const fetcher: typeof fetch = async (input) => {
    const req = input instanceof Request ? input : new Request(input);
    assert.equal(new URL(req.url).pathname, "/nope");
    return new Response("missing", { status: 404 });
  };
  const res = await handleRequest(new Request("https://example.com/nope"), {
    fetcher,
  });
  assert.equal(res.status, 404);
});

test("deep SPA: origin already 200 → unchanged (human)", async () => {
  const body = "<html>ok</html>";
  const fetcher: typeof fetch = async () =>
    htmlResponse(200, body);
  const res = await handleRequest(new Request("https://example.com/songs/x"), {
    fetcher,
  });
  assert.equal(res.status, 200);
  assert.equal(await res.text(), body);
});

test("catalog slug rename: 301 before origin fetch", async () => {
  const fetcher: typeof fetch = async () => {
    throw new Error("origin fetch should not run for catalog redirect");
  };
  const res = await handleRequest(
    new Request("https://example.com/songs/the-seven-sutras-of-banana/?section=audio"),
    { fetcher },
  );
  assert.equal(res.status, 301);
  assert.equal(
    res.headers.get("location"),
    "https://example.com/songs/seven-sutras-gone-banana/?section=audio",
  );
});

test("static root feed.xml: passthrough with atom content-type (human)", async () => {
  const fetcher: typeof fetch = async (input) => {
    const req = input instanceof Request ? input : new Request(input);
    assert.equal(new URL(req.url).pathname, "/feed.xml");
    return new Response("<feed></feed>", {
      status: 200,
      headers: { "content-type": "application/xml" },
    });
  };
  const res = await handleRequest(new Request("https://example.com/feed.xml"), {
    fetcher,
  });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("content-type"), "application/atom+xml; charset=utf-8");
  assert.equal(await res.text(), "<feed></feed>");
});

test("static root feed.xml: bots skip HTML rewrite", async () => {
  const fetcher: typeof fetch = async () =>
    new Response("<feed></feed>", {
      status: 200,
      headers: { "content-type": "application/xml" },
    });
  const res = await handleRequest(
    new Request("https://example.com/feed.xml", {
      headers: { "user-agent": "Twitterbot/1.0" },
    }),
    { fetcher },
  );
  assert.equal(res.status, 200);
  assert.equal(await res.text(), "<feed></feed>");
});
