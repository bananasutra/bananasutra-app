import assert from "node:assert/strict";
import test from "node:test";
import handler from "./index";

type FakeQueryResult = { results: unknown[] };
type FakeRunResult = { success: boolean; meta?: { changes?: number } };

class FakeStatement {
  readonly sql: string;
  readonly rows: unknown[];
  readonly changes: number;
  bindings: unknown[] = [];

  constructor(sql: string, rows: unknown[], changes = 0) {
    this.sql = sql;
    this.rows = rows;
    this.changes = changes;
  }

  bind(...bindings: unknown[]): FakeStatement {
    this.bindings = bindings;
    return this;
  }

  async all<T>(): Promise<FakeQueryResult & { results: T[] }> {
    return { results: this.rows as T[] };
  }

  async run(): Promise<FakeRunResult> {
    return { success: true, meta: { changes: this.changes } };
  }
}

class FakeDb {
  readonly rows: unknown[];
  readonly cleanupChanges: number;
  lastStatement: FakeStatement | null = null;

  constructor(rows: unknown[] = [], cleanupChanges = 0) {
    this.rows = rows;
    this.cleanupChanges = cleanupChanges;
  }

  prepare(sql: string): FakeStatement {
    if (sql.includes("SELECT")) {
      this.lastStatement = new FakeStatement(sql, this.rows);
      return this.lastStatement;
    }
    if (sql.includes("DELETE")) {
      this.lastStatement = new FakeStatement(sql, [], this.cleanupChanges);
      return this.lastStatement;
    }
    this.lastStatement = new FakeStatement(sql, []);
    return this.lastStatement;
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

const baseEnv = {
  ANTHROPIC_API_KEY: "test-key",
  BBB_ADMIN_TOKEN: "test-admin-token",
};

test("POST /api/bbb/404-log validates payload and writes log row", async () => {
  const fakeDb = new FakeDb();
  const response = await fetchHandler(
    new Request("https://example.com/api/bbb/404-log", {
      method: "POST",
      headers: {
        origin: "http://localhost:5173",
        "content-type": "application/json",
        "cf-connecting-ip": "1.2.3.4",
      },
      body: JSON.stringify({ bad_path: "/banana-republic", referrer: "https://example.com/home" }),
    }),
    {
      ...baseEnv,
      DB: fakeDb as unknown as D1Database,
      BBB_LOG_IP_SALT: "salty",
      BBB_404_MAX_PER_HOUR: "30",
    },
    testCtx,
  );

  assert.equal(response.status, 200);
  const body = (await response.json()) as { ok: boolean };
  assert.equal(body.ok, true);
  assert.ok(fakeDb.lastStatement?.sql.includes("INSERT INTO bbb_404_logs"));
});

test("POST /api/bbb/404-log rejects malformed payload", async () => {
  const response = await fetchHandler(
    new Request("https://example.com/api/bbb/404-log", {
      method: "POST",
      headers: {
        origin: "http://localhost:5173",
        "content-type": "application/json",
      },
      body: JSON.stringify({ bad_path: "not-a-route" }),
    }),
    {
      ...baseEnv,
      DB: new FakeDb() as unknown as D1Database,
    },
    testCtx,
  );

  assert.equal(response.status, 400);
});

test("GET /api/bbb/admin/404 requires admin auth", async () => {
  const response = await fetchHandler(
    new Request("https://example.com/api/bbb/admin/404", {
      method: "GET",
      headers: {
        origin: "http://localhost:5173",
      },
    }),
    {
      ...baseEnv,
      DB: new FakeDb([]) as unknown as D1Database,
    },
    testCtx,
  );

  assert.equal(response.status, 401);
});

test("GET /api/bbb/admin/404 returns logs for valid token", async () => {
  const response = await fetchHandler(
    new Request("https://example.com/api/bbb/admin/404?limit=1&bad_path=%2Foops", {
      method: "GET",
      headers: {
        origin: "http://localhost:5173",
        authorization: "Bearer test-admin-token",
      },
    }),
    {
      ...baseEnv,
      DB: new FakeDb([
        {
          id: "404-1",
          created_at: 123,
          bad_path: "/banana-republic",
          referrer: "https://example.com",
        },
      ]) as unknown as D1Database,
    },
    testCtx,
  );

  assert.equal(response.status, 200);
  const body = (await response.json()) as {
    logs: Array<{ id: string; bad_path: string; created_at: number }>;
    nextBefore: number | null;
  };
  assert.equal(body.logs.length, 1);
  assert.equal(body.logs[0]?.id, "404-1");
  assert.equal(body.nextBefore, 123);
});

test("POST /api/bbb/admin/404/cleanup uses 404 retention fallback", async () => {
  const response = await fetchHandler(
    new Request("https://example.com/api/bbb/admin/404/cleanup", {
      method: "POST",
      headers: {
        origin: "http://localhost:5173",
        authorization: "Bearer test-admin-token",
      },
    }),
    {
      ...baseEnv,
      BBB_LOG_RETENTION_DAYS: "22",
      DB: new FakeDb([], 3) as unknown as D1Database,
    },
    testCtx,
  );

  assert.equal(response.status, 200);
  const body = (await response.json()) as { ok: boolean; deleted: number; retentionDays: number };
  assert.equal(body.ok, true);
  assert.equal(body.deleted, 3);
  assert.equal(body.retentionDays, 22);
});
