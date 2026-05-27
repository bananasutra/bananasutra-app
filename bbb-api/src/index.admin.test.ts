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
  private readonly selectRows: unknown[];
  private readonly cleanupChanges: number;

  constructor(selectRows: unknown[], cleanupChanges = 0) {
    this.selectRows = selectRows;
    this.cleanupChanges = cleanupChanges;
  }

  prepare(sql: string): FakeStatement {
    if (sql.includes("SELECT")) {
      return new FakeStatement(sql, this.selectRows);
    }
    if (sql.includes("DELETE")) {
      return new FakeStatement(sql, [], this.cleanupChanges);
    }
    return new FakeStatement(sql, []);
  }
}

const baseEnv = {
  ANTHROPIC_API_KEY: "test-key",
  BBB_ADMIN_TOKEN: "test-admin-token",
};

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

test("admin logs route requires bearer token", async () => {
  const response = await fetchHandler(
    new Request("https://example.com/api/bbb/admin/logs", {
      headers: { origin: "http://localhost:5173" },
    }),
    {
      ...baseEnv,
      DB: new FakeDb([]) as unknown as D1Database,
    },
    testCtx,
  );

  assert.equal(response.status, 401);
  const body = (await response.json()) as { error: string };
  assert.match(body.error, /Unauthorized/);
});

test("admin logs route returns logs for valid token", async () => {
  const response = await fetchHandler(
    new Request("https://example.com/api/bbb/admin/logs?limit=1", {
      headers: {
        authorization: "Bearer test-admin-token",
        origin: "http://localhost:5173",
      },
    }),
    {
      ...baseEnv,
      DB: new FakeDb([
        {
          id: "log-1",
          created_at: 123,
          request_id: "req-1",
          status: "ok",
          user_prompt: "I need hope",
          assistant_reply: "Try Bright Morning",
        },
      ]) as unknown as D1Database,
    },
    testCtx,
  );

  assert.equal(response.status, 200);
  const body = (await response.json()) as {
    logs: Array<{ id: string; created_at: number }>;
    nextBefore: number | null;
  };
  assert.equal(body.logs.length, 1);
  assert.equal(body.logs[0]?.id, "log-1");
  assert.equal(body.nextBefore, 123);
});
