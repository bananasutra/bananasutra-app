import assert from "node:assert/strict";
import test from "node:test";
import { postFeedbackToAppsScript } from "./feedback";

test("postFeedbackToAppsScript sends tagged subject and succeeds on ok JSON", async () => {
  const originalFetch = globalThis.fetch;
  let capturedBody: Record<string, unknown> | null = null;

  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    capturedBody = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;

  try {
    const result = await postFeedbackToAppsScript({
      url: "https://example.com/apps-script",
      payload: {
        intentType: "song-idea",
        message: "Idea goes here",
        name: "Banana",
        email: "banana@example.com",
        pageContext: { pathname: "/songs" },
      },
    });

    assert.equal(result.ok, true);
    if (!capturedBody) throw new Error("expected Apps Script payload");
    const sent = capturedBody as Record<string, unknown>;
    assert.equal(sent.subject, "[BBB] song idea");
    assert.equal(sent.name, "Banana");
    assert.equal(sent.email, "banana@example.com");
    assert.match(String(sent.message ?? ""), /Idea goes here/);
    assert.doesNotMatch(String(sent.message ?? ""), /Anonymous via BBB/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("postFeedbackToAppsScript forwards sendCopy and userMessage for sender copies", async () => {
  const originalFetch = globalThis.fetch;
  let capturedBody: Record<string, unknown> | null = null;

  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    capturedBody = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;

  try {
    const result = await postFeedbackToAppsScript({
      url: "https://example.com/apps-script",
      payload: {
        intentType: "feedback",
        message: "Plain user note",
        name: "Banana",
        email: "banana@example.com",
        sendCopy: true,
      },
    });

    assert.equal(result.ok, true);
    if (!capturedBody) throw new Error("expected Apps Script payload");
    const sent = capturedBody as Record<string, unknown>;
    assert.equal(sent.sendCopy, "true");
    assert.equal(sent.userMessage, "Plain user note");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("postFeedbackToAppsScript returns error when Apps Script responds with failure", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ ok: false, error: "Apps Script rejected request." }), {
      status: 200,
      headers: { "content-type": "application/json" },
    })) as typeof fetch;

  try {
    const result = await postFeedbackToAppsScript({
      url: "https://example.com/apps-script",
      payload: {
        intentType: "feedback",
        message: "hello",
        name: "Banana",
        email: "banana@example.com",
      },
    });
    assert.equal(result.ok, false);
    assert.match(result.error ?? "", /rejected/i);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
