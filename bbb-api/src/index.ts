import { ClaudeUpstreamError, streamClaudeResponse, type ChatMessage } from "./claude-client";
import { LIBRARY_INJECTS } from "./library-data";
import { buildSystemPrompt } from "./system-prompt";

interface Env {
  ANTHROPIC_API_KEY?: string;
  BBB_MODEL?: string;
  BBB_ALLOWED_ORIGINS?: string;
  BBB_MAX_REQUESTS_PER_WINDOW?: string;
  BBB_RATE_LIMIT_WINDOW_SEC?: string;
}

interface RequestPayload {
  messages: ChatMessage[];
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const MEMORY_RATE_LIMIT = new Map<string, RateLimitEntry>();
const DEFAULT_MODEL = "claude-haiku-4-5-20241022";
const DEFAULT_ALLOWED_ORIGINS = ["https://bananasutra.com", "http://localhost:5173"];
const TEXT_ENCODER = new TextEncoder();

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
  "access-control-allow-methods": "POST,OPTIONS",
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

const handler: ExportedHandler<Env> = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get("origin");
    const allowedOrigins = getAllowedOrigins(env);
    const corsOrigin = origin && allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
    const corsHeaders = getCorsHeaders(corsOrigin);

    if (origin && !allowedOrigins.includes(origin)) {
      return json(403, { error: "Origin not allowed." }, corsHeaders);
    }

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const url = new URL(request.url);
    if (!isChatEndpoint(url)) return json(404, { error: "Not found." }, corsHeaders);
    if (request.method !== "POST") return json(405, { error: "Method not allowed. Use POST." }, corsHeaders);

    const apiKey = env.ANTHROPIC_API_KEY?.trim();
    if (!apiKey) return json(500, { error: "Server missing ANTHROPIC_API_KEY secret." }, corsHeaders);

    const ip = getClientIp(request);
    const rate = checkRateLimit(ip, env);
    if (!rate.allowed) {
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
      return json(400, { error: "Invalid JSON body." }, corsHeaders);
    }

    const messages = validateMessages(payload);
    if (!messages) {
      return json(
        400,
        {
          error: "Body must include messages: Array<{ role: 'user' | 'assistant', content: string }>.",
        },
        corsHeaders,
      );
    }

    try {
      const system = buildSystemPrompt(LIBRARY_INJECTS);
      const model = env.BBB_MODEL?.trim() || DEFAULT_MODEL;
      const stream = await streamClaudeResponse({
        apiKey,
        model,
        system,
        messages,
      });

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
        const upstreamStatus = error.status >= 500 ? 502 : 500;
        return json(
          upstreamStatus,
          {
            error: "Model request failed. Please retry shortly.",
          },
          corsHeaders,
        );
      }
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
