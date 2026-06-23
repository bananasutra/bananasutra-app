import catalogRedirectsFile from "../../../apps/banana-catalog-prototype/catalog-redirects.json" with { type: "json" };

type CatalogRedirectEntry = {
  from: string;
  to: string;
  reason?: string;
};

/** Strip trailing slash except preserve `/`. */
export function normalizeRedirectPathname(pathname: string): string {
  let path = pathname.trim() || "/";
  if (path.length > 1 && path.endsWith("/")) {
    path = path.slice(0, -1);
  }
  return path;
}

const REDIRECT_LOOKUP = new Map<string, string>(
  (catalogRedirectsFile.redirects as CatalogRedirectEntry[]).map((entry) => [
    normalizeRedirectPathname(entry.from),
    entry.to,
  ]),
);

export function resolveCatalogRedirect(pathname: string): string | null {
  return REDIRECT_LOOKUP.get(normalizeRedirectPathname(pathname)) ?? null;
}

/** Absolute redirect URL preserving query + hash. */
export function catalogRedirectResponse(request: Request): Response | null {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return null;
  }
  const url = new URL(request.url);
  const targetPath = resolveCatalogRedirect(url.pathname);
  if (!targetPath) {
    return null;
  }
  const destination = new URL(targetPath, url.origin);
  destination.search = url.search;
  destination.hash = url.hash;
  return Response.redirect(destination.toString(), 301);
}
