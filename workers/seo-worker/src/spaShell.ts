/**
 * GitHub Pages serves only static files; deep client routes (React Router in
 * `apps/banana-catalog-prototype/src/App.tsx`) 404 at origin. The Worker
 * substitutes the `/` HTML shell with status 200 for GET/HEAD so document
 * requests are HTTP-correct before any client-side `404.html` redirect.
 *
 * Keep this list aligned with `<Routes>` path props (same file). Order does not
 * matter: each prefix is matched independently.
 */
export const SPA_PATH_PREFIXES: readonly string[] = [
  "/songs",
  "/words",
  "/search",
  "/about",
  "/sutras",
  "/muses",
  "/quotes",
  "/songbooks",
  "/tracks",
  "/videos",
  "/learn",
  "/listen",
  "/watch",
  "/manifesto",
  "/privacy",
  "/style-guide",
  "/sitemap",
] as const;

const RESERVED_ROOT_FILES = new Set([
  "/robots.txt",
  "/feed.xml",
  "/llms.txt",
  "/sitemap.xml",
  "/favicon.ico",
  "/seo-metadata.json",
  "/404.html",
  "/index.html",
]);

function normalizePathname(pathname: string): string {
  if (pathname === "" || pathname === "/") return "/";
  try {
    return decodeURI(pathname);
  } catch {
    return pathname;
  }
}

/**
 * True when `pathname` is a client-routed URL that should receive the SPA
 * shell when origin would otherwise 404 (GitHub Pages).
 */
export function pathnameNeedsSpaShell(pathname: string): boolean {
  const path = normalizePathname(pathname);
  if (path === "/") return false;
  if (path.startsWith("/assets/")) return false;
  if (RESERVED_ROOT_FILES.has(path)) return false;

  for (const prefix of SPA_PATH_PREFIXES) {
    if (path === prefix || path.startsWith(`${prefix}/`)) {
      return true;
    }
  }
  return false;
}

/** GET or HEAD document-style request to a path that may need shell substitution. */
export function requestMayNeedSpaShell(request: Request): boolean {
  if (request.method !== "GET" && request.method !== "HEAD") return false;
  const url = new URL(request.url);
  return pathnameNeedsSpaShell(url.pathname);
}
