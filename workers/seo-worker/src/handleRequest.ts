/**
 * Worker fetch handler: SPA shell fix for GitHub Pages 404s + bot metadata rewrite.
 */

import { detectBotPattern } from "./botDetection.ts";
import { rewriteHtmlMetadata } from "./metaRewriter.ts";
import { getRouteMeta, getSeoMetadata } from "./seoMetadata.ts";
import { requestMayNeedSpaShell } from "./spaShell.ts";

function isHtmlResponse(response: Response): boolean {
  const ct = response.headers.get("content-type") ?? "";
  return ct.includes("text/html");
}

function cloneHeadersForShellResponse(source: Headers): Headers {
  const out = new Headers(source);
  out.delete("content-length");
  out.delete("content-encoding");
  return out;
}

async function fetchShellDocumentGet(
  origin: string,
  fetcher: typeof fetch,
): Promise<Response> {
  return fetcher(new Request(`${origin}/`, { method: "GET" }));
}

async function applyBotRewrite(
  originResponse: Response,
  request: Request,
  fetcher: typeof fetch,
  botPattern: string,
): Promise<Response> {
  const metadata = await getSeoMetadata(fetcher);
  const meta = getRouteMeta(request, metadata);
  const rewritten = rewriteHtmlMetadata(originResponse, meta);
  const out = new Response(rewritten.body, rewritten);
  out.headers.set("x-banana-bot-detected", botPattern);
  return out;
}

export interface HandleRequestDeps {
  fetcher: typeof fetch;
}

const defaultFetcher = globalThis.fetch.bind(globalThis);

export async function handleRequest(
  request: Request,
  deps: HandleRequestDeps = { fetcher: defaultFetcher },
): Promise<Response> {
  const { fetcher } = deps;
  const botPattern = detectBotPattern(request.headers.get("user-agent"));
  const tryShell = requestMayNeedSpaShell(request);

  if (!tryShell) {
    if (botPattern === null) {
      return fetcher(request);
    }
    const originResponse = await fetcher(request);
    return applyBotRewrite(originResponse, request, fetcher, botPattern);
  }

  const originResponse = await fetcher(request);

  if (originResponse.status !== 404) {
    if (botPattern === null) {
      return originResponse;
    }
    return applyBotRewrite(originResponse, request, fetcher, botPattern);
  }

  const url = new URL(request.url);

  if (request.method === "HEAD") {
    const headRes = await fetcher(new Request(`${url.origin}/`, { method: "HEAD" }));
    if (headRes.ok && isHtmlResponse(headRes)) {
      const headers = cloneHeadersForShellResponse(headRes.headers);
      const out = new Response(null, { status: 200, headers });
      if (botPattern !== null) {
        out.headers.set("x-banana-bot-detected", botPattern);
      }
      return out;
    }
    const shellProbe = await fetchShellDocumentGet(url.origin, fetcher);
    if (!shellProbe.ok || !isHtmlResponse(shellProbe)) {
      return originResponse;
    }
    const headers = cloneHeadersForShellResponse(shellProbe.headers);
    const out = new Response(null, { status: 200, headers });
    if (botPattern !== null) {
      out.headers.set("x-banana-bot-detected", botPattern);
    }
    return out;
  }

  const shellGet = await fetchShellDocumentGet(url.origin, fetcher);
  if (!shellGet.ok || !isHtmlResponse(shellGet)) {
    return originResponse;
  }

  if (botPattern === null) {
    return new Response(shellGet.body, {
      status: 200,
      statusText: "OK",
      headers: cloneHeadersForShellResponse(shellGet.headers),
    });
  }

  return applyBotRewrite(shellGet, request, fetcher, botPattern);
}
