/**
 * handleRequest with mocked `fetch` (Node --test). No HTMLRewriter / Workers APIs.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { handleRequest } from "../src/handleRequest.ts";

function htmlResponse(status: number, body: string): Response {
  return new Response(body, {
    status,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

test("deep SPA GET: origin 404 → 200 shell body (human)", async () => {
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
