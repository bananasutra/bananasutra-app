import assert from "node:assert/strict";
import test from "node:test";
import handler from "./index";

const fetchHandler = handler.fetch as (
  request: Request,
  env: unknown,
  ctx: ExecutionContext,
) => Promise<Response>;

const testCtx = {
  waitUntil: (_promise: Promise<unknown>) => undefined,
  passThroughOnException: () => undefined,
  props: {},
} as unknown as ExecutionContext;

const makeChatRequest = (): Request =>
  new Request("https://example.com/api/bbb", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      messages: [{ role: "user", content: "hi" }],
    }),
  });

const makeLocalChatRequest = (): Request =>
  new Request("http://localhost:8787/api/bbb", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      messages: [{ role: "user", content: "hi" }],
    }),
  });

test("chat route rejects missing Origin by default", async () => {
  const response = await fetchHandler(
    makeChatRequest(),
    {
      ANTHROPIC_API_KEY: "test-key",
    },
    testCtx,
  );

  assert.equal(response.status, 403);
  const body = (await response.json()) as { error: string };
  assert.match(body.error, /Origin not allowed/i);
});

test("chat route allows missing Origin override and sends cached static system block", async () => {
  const originalFetch = globalThis.fetch;
  let capturedBody: Record<string, unknown> | null = null;

  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    capturedBody = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
    return new Response('data: {"type":"message_stop"}\n\n', {
      status: 200,
      headers: { "content-type": "text/event-stream" },
    });
  }) as typeof fetch;

  try {
    const response = await fetchHandler(
      makeLocalChatRequest(),
      {
        ANTHROPIC_API_KEY: "test-key",
        BBB_ALLOW_NO_ORIGIN: "true",
      },
      testCtx,
    );

    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type") ?? "", /text\/event-stream/i);
    assert.ok(capturedBody, "Expected upstream Anthropic body to be captured");

    const upstreamBody = capturedBody as Record<string, unknown>;
    const system = (upstreamBody.system ?? null) as unknown;
    assert.ok(Array.isArray(system), "Expected system to be an array of content blocks");
    assert.equal(system.length > 0, true, "Expected at least one system block");

    const first = system[0] as {
      type?: string;
      text?: string;
      cache_control?: { type?: string };
    };
    assert.equal(first.type, "text");
    assert.equal(typeof first.text, "string");
    assert.equal(first.cache_control?.type, "ephemeral");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
