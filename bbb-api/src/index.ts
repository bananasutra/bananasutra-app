import {
  ClaudeUpstreamError,
  streamClaudeResponse,
  type ChatMessage,
  type ClaudeStreamFinishResult,
} from "./claude-client";
import { LIBRARY_INJECTS } from "./library-data";
import { buildRecommendationContext, type BbbPageContext } from "./recommendation-context";
import { buildSystemPrompt } from "./system-prompt";
import { isAuthorizedAdmin } from "./admin-auth";
import { cleanupOldLogs, insertBbbLog, parseAdminLogsQuery, queryBbbLogs, type BbbLogStatus } from "./logging";

interface Env {
  DB?: D1Database;
  ANTHROPIC_API_KEY?: string;
  BBB_MODEL?: string;
  BBB_ALLOWED_ORIGINS?: string;
  BBB_ALLOW_NO_ORIGIN?: string;
  BBB_MAX_REQUESTS_PER_WINDOW?: string;
  BBB_RATE_LIMIT_WINDOW_SEC?: string;
  BBB_ADMIN_TOKEN?: string;
  BBB_LOG_IP_SALT?: string;
  BBB_LOG_RETENTION_DAYS?: string;
}

interface RequestPayload {
  messages: ChatMessage[];
  pageContext?: BbbPageContext;
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const MEMORY_RATE_LIMIT = new Map<string, RateLimitEntry>();
const DEFAULT_MODEL = "claude-haiku-4-5-20251001";
const DEFAULT_ALLOWED_ORIGINS = ["https://bananasutra.com", "http://localhost:5173"];
const json = (status: number, body: unknown, headers: HeadersInit = {}): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...headers,
    },
  });

const getAllowedOrigins = (env: Env): string[] => {
  const envRaw = env.BBB_ALLOWED_ORIGINS?.trim();
  if (!envRaw) return DEFAULT_ALLOWED_ORIGINS;
  return envRaw
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
};

const getCorsHeaders = (origin: string): HeadersInit => ({
  "access-control-allow-origin": origin,
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "access-control-allow-headers": "content-type,authorization",
  "access-control-max-age": "86400",
  vary: "Origin",
});

const getClientIp = (request: Request): string =>
  request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for") ?? "unknown";

const checkRateLimit = (ip: string, env: Env): { allowed: boolean; retryAfterSec: number } => {
  const maxRequests = Number.parseInt(env.BBB_MAX_REQUESTS_PER_WINDOW ?? "20", 10);
  const windowSec = Number.parseInt(env.BBB_RATE_LIMIT_WINDOW_SEC ?? "3600", 10);
  const now = Date.now();
  const windowMs = windowSec * 1000;
  for (const [key, entry] of MEMORY_RATE_LIMIT.entries()) {
    if (entry.resetAt <= now) MEMORY_RATE_LIMIT.delete(key);
  }
  const existing = MEMORY_RATE_LIMIT.get(ip);

  if (!existing || existing.resetAt <= now) {
    MEMORY_RATE_LIMIT.set(ip, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSec: windowSec };
  }

  if (existing.count >= maxRequests) {
    return { allowed: false, retryAfterSec: Math.ceil((existing.resetAt - now) / 1000) };
  }

  existing.count += 1;
  MEMORY_RATE_LIMIT.set(ip, existing);
  return { allowed: true, retryAfterSec: Math.ceil((existing.resetAt - now) / 1000) };
};

const isChatEndpoint = (url: URL): boolean => url.pathname === "/api/bbb" || url.pathname === "/";
const isAdminLogsEndpoint = (url: URL): boolean => url.pathname === "/api/bbb/admin/logs";
const isAdminCleanupEndpoint = (url: URL): boolean => url.pathname === "/api/bbb/admin/logs/cleanup";

const validateMessages = (payload: unknown): ChatMessage[] | null => {
  if (!payload || typeof payload !== "object") return null;
  const candidate = payload as RequestPayload;
  if (!Array.isArray(candidate.messages)) return null;
  const valid = candidate.messages.every(
    (message) =>
      message &&
      typeof message === "object" &&
      (message.role === "user" || message.role === "assistant") &&
      typeof message.content === "string" &&
      message.content.trim().length > 0,
  );
  return valid ? candidate.messages : null;
};

const validatePageContext = (payload: unknown): BbbPageContext | undefined => {
  if (!payload || typeof payload !== "object") return undefined;
  const candidate = payload as RequestPayload;
  if (!candidate.pageContext || typeof candidate.pageContext !== "object") return undefined;
  const pathname = candidate.pageContext.pathname;
  const search = candidate.pageContext.search;
  if (typeof pathname !== "string" || !pathname.startsWith("/")) return undefined;
  if (typeof search !== "undefined" && (typeof search !== "string" || (search.length > 0 && !search.startsWith("?")))) {
    return undefined;
  }
  return { pathname, ...(typeof search === "string" ? { search } : {}) };
};

const getLatestUserPrompt = (messages: ChatMessage[]): string =>
  [...messages].reverse().find((message) => message.role === "user")?.content ?? "";

const getRetentionDays = (env: Env): number => {
  const parsed = Number.parseInt(env.BBB_LOG_RETENTION_DAYS ?? "30", 10);
  if (!Number.isFinite(parsed) || parsed < 1) return 30;
  return parsed;
};

const toLogStatusFromStreamError = (streamError: string | null): BbbLogStatus => {
  if (!streamError) return "ok";
  return /abort/i.test(streamError) ? "aborted" : "network_error";
};

const hasLogDatabase = (env: Env): env is Env & { DB: D1Database } => Boolean(env.DB);

const queueChatLog = (
  ctx: ExecutionContext,
  env: Env,
  input: {
    requestId: string;
    startedAt: number;
    ip: string;
    origin: string | null;
    pageContext?: BbbPageContext;
    model: string;
    latestUserPrompt: string;
    messageCount: number;
    status: BbbLogStatus;
    assistantReply?: string;
    errorMessage?: string;
  },
): void => {
  if (!hasLogDatabase(env)) return;
  ctx.waitUntil(
    insertBbbLog(env.DB, {
      requestId: input.requestId,
      createdAt: Date.now(),
      origin: input.origin,
      pathname: input.pageContext?.pathname ?? null,
      search: input.pageContext?.search ?? null,
      ip: input.ip,
      ipSalt: env.BBB_LOG_IP_SALT,
      model: input.model,
      status: input.status,
      latencyMs: Date.now() - input.startedAt,
      userPrompt: input.latestUserPrompt,
      assistantReply: input.assistantReply ?? null,
      errorMessage: input.errorMessage ?? null,
      messageCount: input.messageCount,
    }).catch(() => undefined),
  );
};

const handler: ExportedHandler<Env> = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const origin = request.headers.get("origin");
    const allowedOrigins = getAllowedOrigins(env);
    const corsOrigin = origin && allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
    const corsHeaders = getCorsHeaders(corsOrigin);
    const allowNoOrigin = env.BBB_ALLOW_NO_ORIGIN === "true";

    if ((!origin && !allowNoOrigin) || (origin && !allowedOrigins.includes(origin))) {
      return json(403, { error: "Origin not allowed." }, corsHeaders);
    }

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const url = new URL(request.url);
    if (isAdminLogsEndpoint(url) || isAdminCleanupEndpoint(url)) {
      if (!isAuthorizedAdmin(request, env.BBB_ADMIN_TOKEN)) {
        return json(401, { error: "Unauthorized." }, corsHeaders);
      }
      if (!hasLogDatabase(env)) {
        return json(500, { error: "Server missing DB binding." }, corsHeaders);
      }

      if (isAdminLogsEndpoint(url)) {
        if (request.method !== "GET") {
          return json(405, { error: "Method not allowed. Use GET." }, corsHeaders);
        }
        const parsed = parseAdminLogsQuery(url);
        if (!parsed.ok) {
          return json(400, { error: parsed.error }, corsHeaders);
        }
        const logs = await queryBbbLogs(env.DB, parsed.value);
        const nextBefore = logs.length ? logs[logs.length - 1]?.created_at ?? null : null;
        return json(200, { logs, nextBefore }, corsHeaders);
      }

      if (request.method !== "POST") {
        return json(405, { error: "Method not allowed. Use POST." }, corsHeaders);
      }
      const retentionDays = getRetentionDays(env);
      const deleted = await cleanupOldLogs(env.DB, retentionDays);
      return json(200, { ok: true, deleted, retentionDays }, corsHeaders);
    }

    if (!isChatEndpoint(url)) return json(404, { error: "Not found." }, corsHeaders);
    if (request.method !== "POST") return json(405, { error: "Method not allowed. Use POST." }, corsHeaders);

    const apiKey = env.ANTHROPIC_API_KEY?.trim();
    if (!apiKey) return json(500, { error: "Server missing ANTHROPIC_API_KEY secret." }, corsHeaders);

    const requestId = crypto.randomUUID();
    const startedAt = Date.now();
    const ip = getClientIp(request);
    const rate = checkRateLimit(ip, env);
    const model = env.BBB_MODEL?.trim() || DEFAULT_MODEL;
    if (!rate.allowed) {
      queueChatLog(ctx, env, {
        requestId,
        startedAt,
        ip,
        origin,
        model,
        latestUserPrompt: "",
        messageCount: 0,
        status: "validation_error",
        errorMessage: "rate_limit_reached",
      });
      return json(
        429,
        { error: "Rate limit reached. Please retry soon." },
        { ...corsHeaders, "retry-after": String(rate.retryAfterSec) },
      );
    }

    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      queueChatLog(ctx, env, {
        requestId,
        startedAt,
        ip,
        origin,
        model,
        latestUserPrompt: "",
        messageCount: 0,
        status: "validation_error",
        errorMessage: "invalid_json",
      });
      return json(400, { error: "Invalid JSON body." }, corsHeaders);
    }

    const messages = validateMessages(payload);
    const pageContext = validatePageContext(payload);
    if (!messages) {
      queueChatLog(ctx, env, {
        requestId,
        startedAt,
        ip,
        origin,
        pageContext,
        model,
        latestUserPrompt: "",
        messageCount: 0,
        status: "validation_error",
        errorMessage: "invalid_messages",
      });
      return json(
        400,
        {
          error: "Body must include messages: Array<{ role: 'user' | 'assistant', content: string }>.",
        },
        corsHeaders,
      );
    }
    const latestUserPrompt = getLatestUserPrompt(messages);

    try {
      const systemStatic = buildSystemPrompt(LIBRARY_INJECTS);
      const systemDynamic = buildRecommendationContext(messages, LIBRARY_INJECTS, pageContext);
      let resolveStreamResult: ((value: ClaudeStreamFinishResult) => void) | null = null;
      const streamResultPromise = new Promise<ClaudeStreamFinishResult>((resolve) => {
        resolveStreamResult = resolve;
      });
      const stream = await streamClaudeResponse({
        apiKey,
        model,
        systemStatic,
        systemDynamic: systemDynamic || undefined,
        messages,
        onFinish: (result) => {
          resolveStreamResult?.(result);
          resolveStreamResult = null;
        },
      });
      if (hasLogDatabase(env)) {
        ctx.waitUntil(
          streamResultPromise
            .then((result) =>
              insertBbbLog(env.DB, {
                requestId,
                createdAt: Date.now(),
                origin,
                pathname: pageContext?.pathname ?? null,
                search: pageContext?.search ?? null,
                ip,
                ipSalt: env.BBB_LOG_IP_SALT,
                model,
                status: toLogStatusFromStreamError(result.streamError),
                latencyMs: Date.now() - startedAt,
                userPrompt: latestUserPrompt,
                assistantReply: result.assistantText,
                errorMessage: result.streamError,
                messageCount: messages.length,
              }),
            )
            .catch(() => undefined),
        );
      }

      return new Response(stream, {
        status: 200,
        headers: {
          ...corsHeaders,
          "content-type": "text/event-stream; charset=utf-8",
          "cache-control": "no-cache, no-transform",
          connection: "keep-alive",
        },
      });
    } catch (error) {
      if (error instanceof ClaudeUpstreamError) {
        queueChatLog(ctx, env, {
          requestId,
          startedAt,
          ip,
          origin,
          pageContext,
          model,
          latestUserPrompt,
          messageCount: messages.length,
          status: "upstream_error",
          errorMessage: error.detail,
        });
        const upstreamStatus = error.status >= 500 ? 502 : 500;
        return json(
          upstreamStatus,
          {
            error: "Model request failed. Please retry shortly.",
          },
          corsHeaders,
        );
      }
      queueChatLog(ctx, env, {
        requestId,
        startedAt,
        ip,
        origin,
        pageContext,
        model,
        latestUserPrompt,
        messageCount: messages.length,
        status: "network_error",
        errorMessage: error instanceof Error ? error.message : "unknown_error",
      });
      return json(
        500,
        {
          error: "Unexpected server error.",
        },
        corsHeaders,
      );
    }
  },
};

export default handler;
