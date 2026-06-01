import assert from "node:assert/strict";
import test from "node:test";
import handler from "./index";

type FakeRunResult = { success: boolean; meta?: { changes?: number } };

class FakeStatement {
  readonly sql: string;
  bindings: unknown[] = [];

  constructor(sql: string) {
    this.sql = sql;
  }

  bind(...bindings: unknown[]): FakeStatement {
    this.bindings = bindings;
    return this;
  }

  async all<T>(): Promise<{ results: T[] }> {
    return { results: [] };
  }

  async run(): Promise<FakeRunResult> {
    return { success: true, meta: { changes: 1 } };
  }
}

class FeedbackDb {
  statements: FakeStatement[] = [];

  prepare(sql: string): FakeStatement {
    const stmt = new FakeStatement(sql);
    this.statements.push(stmt);
    return stmt;
  }
}

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

const createFeedbackRequest = (body: Record<string, unknown>, ip = "1.2.3.4"): Request =>
  new Request("https://example.com/api/bbb/feedback", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "http://localhost:5173",
      "cf-connecting-ip": ip,
    },
    body: JSON.stringify(body),
  });

const createChatRequest = (ip = "9.9.9.9"): Request =>
  new Request("https://example.com/api/bbb", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "http://localhost:5173",
      "cf-connecting-ip": ip,
    },
    body: JSON.stringify({
      messages: [{ role: "user", content: "hi" }],
    }),
  });

const VALID_FEEDBACK_BODY = {
  intentType: "feedback",
  message: "hello world",
  name: "Banana",
  email: "banana@example.com",
};

test("feedback endpoint validates payload fields", async () => {
  const db = new FeedbackDb();
  const env = {
    DB: db as unknown as D1Database,
    CONTACT_ENDPOINT_URL: "https://example.com/apps-script",
  };

  let response = await fetchHandler(
    createFeedbackRequest({
      intentType: "feedback",
      message: "",
    }),
    env,
    testCtx,
  );
  assert.equal(response.status, 400);

  response = await fetchHandler(
    createFeedbackRequest({
      intentType: "not-real",
      message: "valid",
    }),
    env,
    testCtx,
  );
  assert.equal(response.status, 400);

  response = await fetchHandler(
    createFeedbackRequest({
      intentType: "feedback",
      message: "valid",
      email: "not-an-email",
      name: "Banana",
    }),
    env,
    testCtx,
  );
  assert.equal(response.status, 400);

  response = await fetchHandler(
    createFeedbackRequest({
      intentType: "feedback",
      message: "valid",
    }),
    env,
    testCtx,
  );
  assert.equal(response.status, 400);
  const missingIdentity = (await response.json()) as { error: string };
  assert.match(missingIdentity.error, /name is required|email is required/);

  response = await fetchHandler(
    createFeedbackRequest({
      intentType: "feedback",
      message: "valid",
      name: "Banana",
    }),
    env,
    testCtx,
  );
  assert.equal(response.status, 400);
});

test("feedback endpoint accepts optional sendCopy flag", async () => {
  const db = new FeedbackDb();
  const originalFetch = globalThis.fetch;
  let capturedBody: Record<string, unknown> | null = null;
  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    capturedBody = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;

  try {
    const env = {
      DB: db as unknown as D1Database,
      CONTACT_ENDPOINT_URL: "https://example.com/apps-script",
    };

    const response = await fetchHandler(
      createFeedbackRequest({ ...VALID_FEEDBACK_BODY, sendCopy: true }, "6.6.6.6"),
      env,
      testCtx,
    );
    assert.equal(response.status, 200);
    assert.ok(capturedBody);
    assert.equal(capturedBody["sendCopy"], "true");
    assert.equal(capturedBody["userMessage"], "hello world");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("feedback endpoint writes delivered and apps_script_error rows honestly", async () => {
  const db = new FeedbackDb();
  const originalFetch = globalThis.fetch;
  let requestCount = 0;
  globalThis.fetch = (async (_input: RequestInfo | URL) => {
    requestCount += 1;
    if (requestCount === 1) {
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "content-type": "application/json" } });
    }
    return new Response(JSON.stringify({ ok: false, error: "sheet is down" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;

  try {
    const env = {
      DB: db as unknown as D1Database,
      CONTACT_ENDPOINT_URL: "https://example.com/apps-script",
    };

    const okResponse = await fetchHandler(
      createFeedbackRequest({ ...VALID_FEEDBACK_BODY }, "2.2.2.2"),
      env,
      testCtx,
    );
    assert.equal(okResponse.status, 200);
    assert.deepEqual(await okResponse.json(), { ok: true });

    const errorResponse = await fetchHandler(
      createFeedbackRequest({ intentType: "bug-report", message: "broken thing", name: "Banana", email: "banana@example.com" }, "3.3.3.3"),
      env,
      testCtx,
    );
    assert.equal(errorResponse.status, 200);
    assert.deepEqual(await errorResponse.json(), { ok: false, error: "sheet is down" });
  } finally {
    globalThis.fetch = originalFetch;
  }

  const feedbackInserts = db.statements.filter((stmt) => stmt.sql.includes("INSERT INTO bbb_feedback"));
  assert.equal(feedbackInserts.length, 2);
  const firstStatus = feedbackInserts[0]?.bindings[10];
  const secondStatus = feedbackInserts[1]?.bindings[10];
  const secondError = feedbackInserts[1]?.bindings[11];
  assert.equal(firstStatus, "delivered");
  assert.equal(secondStatus, "apps_script_error");
  assert.equal(secondError, "sheet is down");
});

test("feedback rate limit bucket is isolated from chat bucket", async () => {
  const db = new FeedbackDb();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("anthropic.com")) {
      return new Response('event: done\ndata: {"ok":true}\n\n', {
        status: 200,
        headers: { "content-type": "text/event-stream" },
      });
    }
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;

  try {
    const env = {
      DB: db as unknown as D1Database,
      CONTACT_ENDPOINT_URL: "https://example.com/apps-script",
      ANTHROPIC_API_KEY: "test-key",
      BBB_MAX_REQUESTS_PER_WINDOW: "1",
      BBB_FEEDBACK_MAX_PER_HOUR: "1",
      BBB_RATE_LIMIT_WINDOW_SEC: "3600",
    };

    const firstChat = await fetchHandler(createChatRequest("4.4.4.4"), env, testCtx);
    assert.equal(firstChat.status, 200);
    const secondChat = await fetchHandler(createChatRequest("4.4.4.4"), env, testCtx);
    assert.equal(secondChat.status, 429);

    const feedbackAfterChatLimit = await fetchHandler(
      createFeedbackRequest({ ...VALID_FEEDBACK_BODY, message: "still works" }, "4.4.4.4"),
      env,
      testCtx,
    );
    assert.equal(feedbackAfterChatLimit.status, 200);

    const feedbackLimited = await fetchHandler(
      createFeedbackRequest({ ...VALID_FEEDBACK_BODY, message: "hit feedback limit" }, "5.5.5.5"),
      env,
      testCtx,
    );
    assert.equal(feedbackLimited.status, 200);
    const feedbackLimitedSecond = await fetchHandler(
      createFeedbackRequest({ ...VALID_FEEDBACK_BODY, message: "too many" }, "5.5.5.5"),
      env,
      testCtx,
    );
    assert.equal(feedbackLimitedSecond.status, 429);

    const chatStillAllowed = await fetchHandler(createChatRequest("5.5.5.5"), env, testCtx);
    assert.equal(chatStillAllowed.status, 200);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("feedback endpoint rejects missing origin", async () => {
  const response = await fetchHandler(
    new Request("https://example.com/api/bbb/feedback", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ intentType: "feedback", message: "hello" }),
    }),
    {
      DB: new FeedbackDb() as unknown as D1Database,
      CONTACT_ENDPOINT_URL: "https://example.com/apps-script",
    },
    testCtx,
  );
  assert.equal(response.status, 403);
});
