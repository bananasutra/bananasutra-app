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
  actor_hash: string | null;
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
  actorId?: string | null;
  actorSalt?: string | null;
}

export interface QueryLogsOptions {
  limit: number;
  before: number;
  status?: BbbLogStatus;
  query?: string;
}

export interface InsertBbb404LogInput {
  createdAt: number;
  badPath: string;
  referrer?: string | null;
  ip?: string | null;
  ipSalt?: string | null;
  userAgent?: string | null;
}

export interface Query404LogsOptions {
  limit: number;
  before: number;
  badPath?: string;
}

export interface Bbb404LogRecord {
  id: string;
  created_at: number;
  bad_path: string;
  referrer: string | null;
  ip_hash: string | null;
  user_agent_short: string | null;
}

export interface InsertBbbFeedbackInput {
  createdAt: number;
  requestId?: string | null;
  intentType: string;
  name?: string | null;
  email?: string | null;
  message: string;
  pathname?: string | null;
  search?: string | null;
  conversationTail?: string | null;
  deliveryStatus: string;
  deliveryError?: string | null;
}

export interface QueryFeedbackLogsOptions {
  limit: number;
  before: number;
  intentType?: string;
}

export interface BbbFeedbackRecord {
  id: string;
  created_at: number;
  request_id: string | null;
  intent_type: string;
  name: string | null;
  email: string | null;
  message: string;
  pathname: string | null;
  search: string | null;
  conversation_tail: string | null;
  delivery_status: string;
  delivery_error: string | null;
}

export type ParseAdminLogsQueryResult =
  | { ok: true; value: QueryLogsOptions }
  | { ok: false; error: string };

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
const MAX_QUERY_LENGTH = 200;
const MAX_BAD_PATH_QUERY_LENGTH = 200;
const MAX_INTENT_QUERY_LENGTH = 100;
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

export const hashActorId = async (
  actorId: string | null | undefined,
  salt: string | null | undefined,
): Promise<string | null> => {
  const normalizedActorId = actorId?.trim();
  const normalizedSalt = salt?.trim();
  if (!normalizedActorId || !normalizedSalt) return null;
  const payload = new TextEncoder().encode(`${normalizedSalt}:${normalizedActorId}`);
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

export const parseAdmin404LogsQuery = (
  url: URL,
): { ok: true; value: Query404LogsOptions } | { ok: false; error: string } => {
  const limitRaw = url.searchParams.get("limit");
  const beforeRaw = url.searchParams.get("before") ?? url.searchParams.get("cursor");
  const badPathRaw = url.searchParams.get("bad_path");

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

  let badPath: string | undefined;
  if (badPathRaw !== null) {
    const normalized = badPathRaw.trim();
    if (normalized.length > MAX_BAD_PATH_QUERY_LENGTH) {
      return { ok: false, error: `Invalid bad_path. Keep it at or below ${MAX_BAD_PATH_QUERY_LENGTH} characters.` };
    }
    if (normalized.length > 0) {
      badPath = normalized;
    }
  }

  return {
    ok: true,
    value: {
      limit,
      before,
      ...(badPath ? { badPath } : {}),
    },
  };
};

export const parseAdminFeedbackLogsQuery = (
  url: URL,
): { ok: true; value: QueryFeedbackLogsOptions } | { ok: false; error: string } => {
  const limitRaw = url.searchParams.get("limit");
  const beforeRaw = url.searchParams.get("before") ?? url.searchParams.get("cursor");
  const intentTypeRaw = url.searchParams.get("intent_type");

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

  let intentType: string | undefined;
  if (intentTypeRaw !== null) {
    const normalized = intentTypeRaw.trim().toLowerCase();
    if (normalized.length > MAX_INTENT_QUERY_LENGTH) {
      return { ok: false, error: `Invalid intent_type. Keep it at or below ${MAX_INTENT_QUERY_LENGTH} characters.` };
    }
    if (normalized.length > 0) {
      intentType = normalized;
    }
  }

  return {
    ok: true,
    value: {
      limit,
      before,
      ...(intentType ? { intentType } : {}),
    },
  };
};

export const insertBbbLog = async (db: D1Database, input: InsertBbbLogInput): Promise<void> => {
  const logId = crypto.randomUUID();
  const ipHash = await hashIp(input.ip, input.ipSalt);
  const actorHash = await hashActorId(input.actorId, input.actorSalt);
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
        actor_hash,
        model,
        status,
        latency_ms,
        user_prompt,
        assistant_reply,
        error_message,
        message_count
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      logId,
      input.createdAt,
      input.requestId,
      clampText(input.origin, 500),
      clampText(input.pathname, 500),
      clampText(input.search, 1000),
      ipHash,
      actorHash,
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
        actor_hash,
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

export const insertBbb404Log = async (db: D1Database, input: InsertBbb404LogInput): Promise<void> => {
  const logId = crypto.randomUUID();
  const ipHash = await hashIp(input.ip, input.ipSalt);
  await db
    .prepare(
      `INSERT INTO bbb_404_logs (
        id,
        created_at,
        bad_path,
        referrer,
        ip_hash,
        user_agent_short
      ) VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      logId,
      input.createdAt,
      clampText(input.badPath, 500),
      clampText(input.referrer, 1000),
      ipHash,
      clampText(input.userAgent, 100),
    )
    .run();
};

export const queryBbb404Logs = async (db: D1Database, options: Query404LogsOptions): Promise<Bbb404LogRecord[]> => {
  const where: string[] = ["created_at <= ?"];
  const bindings: unknown[] = [options.before];

  if (options.badPath) {
    where.push("LOWER(bad_path) LIKE LOWER(?) ESCAPE '\\'");
    bindings.push(`%${escapeLikeTerm(options.badPath)}%`);
  }

  const statement = db
    .prepare(
      `SELECT
        id,
        created_at,
        bad_path,
        referrer,
        ip_hash,
        user_agent_short
       FROM bbb_404_logs
       WHERE ${where.join(" AND ")}
       ORDER BY created_at DESC
       LIMIT ?`,
    )
    .bind(...bindings, options.limit);

  const result = await statement.all<Bbb404LogRecord>();
  return result.results ?? [];
};

export const cleanupOldLogs = async (db: D1Database, retentionDays: number): Promise<number> => {
  const safeDays = Number.isFinite(retentionDays) ? Math.max(1, Math.trunc(retentionDays)) : 30;
  const cutoff = Date.now() - safeDays * 24 * 60 * 60 * 1000;
  const result = await db.prepare("DELETE FROM bbb_logs WHERE created_at < ?").bind(cutoff).run();
  return Number(result.meta?.changes ?? 0);
};

export const cleanupOld404Logs = async (db: D1Database, retentionDays: number): Promise<number> => {
  const safeDays = Number.isFinite(retentionDays) ? Math.max(1, Math.trunc(retentionDays)) : 30;
  const cutoff = Date.now() - safeDays * 24 * 60 * 60 * 1000;
  const result = await db.prepare("DELETE FROM bbb_404_logs WHERE created_at < ?").bind(cutoff).run();
  return Number(result.meta?.changes ?? 0);
};

export const insertBbbFeedback = async (db: D1Database, input: InsertBbbFeedbackInput): Promise<void> => {
  const logId = crypto.randomUUID();
  await db
    .prepare(
      `INSERT INTO bbb_feedback (
        id,
        created_at,
        request_id,
        intent_type,
        name,
        email,
        message,
        pathname,
        search,
        conversation_tail,
        delivery_status,
        delivery_error
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      logId,
      input.createdAt,
      clampText(input.requestId, 200),
      clampText(input.intentType, 100),
      clampText(input.name, 250),
      clampText(input.email, 250),
      clampText(input.message, MAX_TEXT_FIELD),
      clampText(input.pathname, 500),
      clampText(input.search, 1000),
      clampText(input.conversationTail, 700),
      clampText(input.deliveryStatus, 50),
      clampText(input.deliveryError, MAX_ERROR_FIELD),
    )
    .run();
};

export const queryBbbFeedback = async (db: D1Database, options: QueryFeedbackLogsOptions): Promise<BbbFeedbackRecord[]> => {
  const where: string[] = ["created_at <= ?"];
  const bindings: unknown[] = [options.before];

  if (options.intentType) {
    where.push("intent_type = ?");
    bindings.push(options.intentType);
  }

  const statement = db
    .prepare(
      `SELECT
        id,
        created_at,
        request_id,
        intent_type,
        name,
        email,
        message,
        pathname,
        search,
        conversation_tail,
        delivery_status,
        delivery_error
       FROM bbb_feedback
       WHERE ${where.join(" AND ")}
       ORDER BY created_at DESC
       LIMIT ?`,
    )
    .bind(...bindings, options.limit);

  const result = await statement.all<BbbFeedbackRecord>();
  return result.results ?? [];
};

export const cleanupOldFeedbackLogs = async (db: D1Database, retentionDays: number): Promise<number> => {
  const safeDays = Number.isFinite(retentionDays) ? Math.max(1, Math.trunc(retentionDays)) : 30;
  const cutoff = Date.now() - safeDays * 24 * 60 * 60 * 1000;
  const result = await db.prepare("DELETE FROM bbb_feedback WHERE created_at < ?").bind(cutoff).run();
  return Number(result.meta?.changes ?? 0);
};
