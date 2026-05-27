export const BBB_LOG_STATUSES = [
  "ok",
  "upstream_error",
  "validation_error",
  "network_error",
  "aborted",
] as const;

export type BbbLogStatus = (typeof BBB_LOG_STATUSES)[number];

export interface BbbLogRecord {
  id: string;
  created_at: number;
  request_id: string;
  origin: string | null;
  pathname: string | null;
  search: string | null;
  ip_hash: string | null;
  model: string | null;
  status: BbbLogStatus;
  latency_ms: number;
  user_prompt: string | null;
  assistant_reply: string | null;
  error_message: string | null;
  message_count: number;
}

export interface InsertBbbLogInput {
  requestId: string;
  createdAt: number;
  origin?: string | null;
  pathname?: string | null;
  search?: string | null;
  model?: string | null;
  status: BbbLogStatus;
  latencyMs: number;
  userPrompt?: string | null;
  assistantReply?: string | null;
  errorMessage?: string | null;
  messageCount: number;
  ip?: string | null;
  ipSalt?: string | null;
}

export interface QueryLogsOptions {
  limit: number;
  before: number;
  status?: BbbLogStatus;
  query?: string;
}

export type ParseAdminLogsQueryResult =
  | { ok: true; value: QueryLogsOptions }
  | { ok: false; error: string };

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
const MAX_QUERY_LENGTH = 200;
const MAX_TEXT_FIELD = 10_000;
const MAX_ERROR_FIELD = 1_500;

const isValidStatus = (status: string): status is BbbLogStatus =>
  BBB_LOG_STATUSES.some((candidate) => candidate === status);

const clampText = (value: string | null | undefined, maxLength: number): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.replace(/\u0000/g, "").trim();
  if (!normalized) return null;
  return normalized.length > maxLength ? normalized.slice(0, maxLength) : normalized;
};

const escapeLikeTerm = (raw: string): string => raw.replace(/[\\%_]/g, (token) => `\\${token}`);

const toHex = (buffer: ArrayBuffer): string =>
  Array.from(new Uint8Array(buffer))
    .map((part) => part.toString(16).padStart(2, "0"))
    .join("");

export const hashIp = async (ip: string | null | undefined, salt: string | null | undefined): Promise<string | null> => {
  const normalizedIp = ip?.trim();
  const normalizedSalt = salt?.trim();
  if (!normalizedIp || !normalizedSalt || normalizedIp === "unknown") return null;
  const payload = new TextEncoder().encode(`${normalizedSalt}:${normalizedIp}`);
  const digest = await crypto.subtle.digest("SHA-256", payload);
  return toHex(digest);
};

export const parseAdminLogsQuery = (url: URL): ParseAdminLogsQueryResult => {
  const limitRaw = url.searchParams.get("limit");
  const beforeRaw = url.searchParams.get("before") ?? url.searchParams.get("cursor");
  const statusRaw = url.searchParams.get("status");
  const queryRaw = url.searchParams.get("q");

  let limit = DEFAULT_LIMIT;
  if (limitRaw !== null) {
    const parsed = Number.parseInt(limitRaw, 10);
    if (!Number.isFinite(parsed) || parsed < 1) {
      return { ok: false, error: "Invalid limit. Use a positive integer." };
    }
    limit = Math.min(parsed, MAX_LIMIT);
  }

  let before = Date.now();
  if (beforeRaw !== null) {
    const parsed = Number.parseInt(beforeRaw, 10);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return { ok: false, error: "Invalid cursor/before value. Use unix milliseconds." };
    }
    before = parsed;
  }

  let status: BbbLogStatus | undefined;
  if (statusRaw !== null) {
    if (!isValidStatus(statusRaw)) {
      return { ok: false, error: `Invalid status. Use one of: ${BBB_LOG_STATUSES.join(", ")}` };
    }
    status = statusRaw;
  }

  let query: string | undefined;
  if (queryRaw !== null) {
    const normalized = queryRaw.trim();
    if (normalized.length > MAX_QUERY_LENGTH) {
      return { ok: false, error: `Invalid q. Keep it at or below ${MAX_QUERY_LENGTH} characters.` };
    }
    if (normalized.length > 0) {
      query = normalized;
    }
  }

  return {
    ok: true,
    value: {
      limit,
      before,
      ...(status ? { status } : {}),
      ...(query ? { query } : {}),
    },
  };
};

export const insertBbbLog = async (db: D1Database, input: InsertBbbLogInput): Promise<void> => {
  const logId = crypto.randomUUID();
  const ipHash = await hashIp(input.ip, input.ipSalt);
  await db
    .prepare(
      `INSERT INTO bbb_logs (
        id,
        created_at,
        request_id,
        origin,
        pathname,
        search,
        ip_hash,
        model,
        status,
        latency_ms,
        user_prompt,
        assistant_reply,
        error_message,
        message_count
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      logId,
      input.createdAt,
      input.requestId,
      clampText(input.origin, 500),
      clampText(input.pathname, 500),
      clampText(input.search, 1000),
      ipHash,
      clampText(input.model, 250),
      input.status,
      Math.max(0, Math.trunc(input.latencyMs)),
      clampText(input.userPrompt, MAX_TEXT_FIELD),
      clampText(input.assistantReply, MAX_TEXT_FIELD),
      clampText(input.errorMessage, MAX_ERROR_FIELD),
      Math.max(0, Math.trunc(input.messageCount)),
    )
    .run();
};

export const queryBbbLogs = async (db: D1Database, options: QueryLogsOptions): Promise<BbbLogRecord[]> => {
  const where: string[] = ["created_at <= ?"];
  const bindings: unknown[] = [options.before];

  if (options.status) {
    where.push("status = ?");
    bindings.push(options.status);
  }

  if (options.query) {
    where.push("LOWER(user_prompt) LIKE LOWER(?) ESCAPE '\\'");
    bindings.push(`%${escapeLikeTerm(options.query)}%`);
  }

  const statement = db
    .prepare(
      `SELECT
        id,
        created_at,
        request_id,
        origin,
        pathname,
        search,
        ip_hash,
        model,
        status,
        latency_ms,
        user_prompt,
        assistant_reply,
        error_message,
        message_count
       FROM bbb_logs
       WHERE ${where.join(" AND ")}
       ORDER BY created_at DESC
       LIMIT ?`,
    )
    .bind(...bindings, options.limit);

  const result = await statement.all<BbbLogRecord>();
  return result.results ?? [];
};

export const cleanupOldLogs = async (db: D1Database, retentionDays: number): Promise<number> => {
  const safeDays = Number.isFinite(retentionDays) ? Math.max(1, Math.trunc(retentionDays)) : 30;
  const cutoff = Date.now() - safeDays * 24 * 60 * 60 * 1000;
  const result = await db.prepare("DELETE FROM bbb_logs WHERE created_at < ?").bind(cutoff).run();
  return Number(result.meta?.changes ?? 0);
};
