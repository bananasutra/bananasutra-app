import type { RouteMeta } from "./metaRewriter.ts";

/** Same origin URL the static site serves after task 12. */
export const SEO_METADATA_JSON_URL =
  "https://bananasutra.com/seo-metadata.json";

export interface SeoMetadataFile {
  routes: Record<string, RouteMeta>;
  generatedAt: string;
}

/**
 * Homepage defaults when the metadata file is unreachable or invalid — mirrors
 * the `/` entry in `apps/banana-catalog-prototype/dist/seo-metadata.json`.
 */
export const HOMEPAGE_DEFAULT_META: RouteMeta = {
  title: "Songs for a World Gone Bananas · BANANASUTRA",
  description:
    "Explore the BANANASUTRA catalog — songs organized by sutra, topic, intention, and sound. Browse songbooks, read lyrics, watch videos, and listen to tracks.",
  canonical: "https://bananasutra.com/",
  type: "website",
  image: "https://bananasutra.com/og/site.png",
};

/** Successful fetches stay warm for this long. */
export const SEO_METADATA_TTL_MS = 60 * 60 * 1000;

/**
 * After a failed fetch or invalid body, keep serving the homepage fallback but
 * retry sooner than `SEO_METADATA_TTL_MS` so a transient outage recovers
 * quickly without refetching on every request.
 */
export const SEO_METADATA_ERROR_RETRY_MS = 60 * 1000;

let cachedMetadata: SeoMetadataFile | null = null;
let cachedAt = 0;
let cachedFromError = false;

function fallbackMetadataFile(): SeoMetadataFile {
  return {
    routes: { "/": { ...HOMEPAGE_DEFAULT_META } },
    generatedAt: "1970-01-01T00:00:00.000Z",
  };
}

interface FetchMetadataResult {
  metadata: SeoMetadataFile;
  /** False when we used the homepage fallback after a network/HTTP/parse error. */
  networkOk: boolean;
}

async function fetchAndParseMetadata(
  fetcher: typeof fetch,
): Promise<FetchMetadataResult> {
  let response: Response;
  try {
    response = await fetcher(SEO_METADATA_JSON_URL, {
      headers: { Accept: "application/json" },
    });
  } catch {
    return { metadata: fallbackMetadataFile(), networkOk: false };
  }

  if (!response.ok) {
    return { metadata: fallbackMetadataFile(), networkOk: false };
  }

  try {
    const data = (await response.json()) as unknown;
    if (!isSeoMetadataFile(data)) {
      return { metadata: fallbackMetadataFile(), networkOk: false };
    }
    if (!data.routes["/"]) {
      data.routes["/"] = { ...HOMEPAGE_DEFAULT_META };
    }
    return { metadata: data, networkOk: true };
  } catch {
    return { metadata: fallbackMetadataFile(), networkOk: false };
  }
}

function isSeoMetadataFile(value: unknown): value is SeoMetadataFile {
  if (value === null || typeof value !== "object") {
    return false;
  }
  const o = value as Record<string, unknown>;
  if (typeof o.generatedAt !== "string" || typeof o.routes !== "object") {
    return false;
  }
  if (o.routes === null || Array.isArray(o.routes)) {
    return false;
  }
  return true;
}

/**
 * Fetches `seo-metadata.json` from the live site, caches in the isolate for
 * ~1h on success, and falls back to homepage defaults on any failure so bots
 * never see a hard error from this layer. Failed fetches use a shorter cache
 * TTL (`SEO_METADATA_ERROR_RETRY_MS`) so the next attempt retries soon.
 *
 * @param fetcher optional `fetch` (e.g. mock in unit tests)
 */
export async function getSeoMetadata(
  fetcher: typeof fetch = globalThis.fetch.bind(globalThis),
): Promise<SeoMetadataFile> {
  const now = Date.now();
  const ttl = cachedFromError
    ? SEO_METADATA_ERROR_RETRY_MS
    : SEO_METADATA_TTL_MS;
  if (cachedMetadata !== null && now - cachedAt < ttl) {
    return cachedMetadata;
  }

  const { metadata, networkOk } = await fetchAndParseMetadata(fetcher);
  cachedMetadata = metadata;
  cachedAt = now;
  cachedFromError = !networkOk;
  return metadata;
}

/** Strip query/hash; trim trailing slash except preserve `/`. */
export function normalizePathnameForLookup(url: URL): string {
  let path = url.pathname;
  if (path.length > 1 && path.endsWith("/")) {
    path = path.slice(0, -1);
  }
  return path === "" ? "/" : path;
}

/**
 * Absolute URL for this request’s pathname only: same path normalization as
 * route keys, `origin` from the incoming URL, no query or hash. Used for
 * unknown routes so `link[rel=canonical]` and `og:url` match what was
 * requested (task 17).
 */
export function canonicalUrlForUrl(url: URL): string {
  const path = normalizePathnameForLookup(url);
  return `${url.origin}${path}`;
}

/**
 * Resolves `RouteMeta` for a request.
 *
 * Known keys (normalized pathname) use the catalog row as-is (title,
 * description, canonical, image, type).
 *
 * Unknown keys reuse the `/` row for copy (title, description, image, type)
 * but set `canonical` to {@link canonicalUrlForUrl} so bots do not advertise
 * the homepage URL for garbage paths.
 */
export function getRouteMeta(
  request: Request,
  metadata: SeoMetadataFile,
): RouteMeta {
  const url = new URL(request.url);
  const key = normalizePathnameForLookup(url);
  const home = metadata.routes["/"] ?? HOMEPAGE_DEFAULT_META;

  if (Object.hasOwn(metadata.routes, key)) {
    const direct = metadata.routes[key]!;
    return {
      title: direct.title,
      description: direct.description,
      canonical: direct.canonical,
      image: direct.image,
      type: direct.type ?? "website",
    };
  }

  return {
    title: home.title,
    description: home.description,
    canonical: canonicalUrlForUrl(url),
    image: home.image,
    type: home.type ?? "website",
  };
}

/** Test-only: clear isolate cache between cases. */
export function __resetSeoMetadataCacheForTests(): void {
  cachedMetadata = null;
  cachedAt = 0;
  cachedFromError = false;
}

/** Test-only: seed cache as if fetched at `cachedAtMs` (for TTL expiry). */
export function __primeSeoMetadataCacheForTests(
  data: SeoMetadataFile,
  cachedAtMs: number,
  options?: { fromError?: boolean },
): void {
  cachedMetadata = data;
  cachedAt = cachedAtMs;
  cachedFromError = options?.fromError ?? false;
}
