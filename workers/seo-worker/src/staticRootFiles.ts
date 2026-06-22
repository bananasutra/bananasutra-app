/**
 * Root static files served from GitHub Pages origin — passthrough without bot HTML rewrite.
 * Content-Type overrides fix GH Pages default `application/xml` on `/feed.xml`.
 */
export const STATIC_ROOT_CONTENT_TYPES: Readonly<Record<string, string>> = {
  "/feed.xml": "application/atom+xml; charset=utf-8",
  "/llms.txt": "text/plain; charset=utf-8",
  "/sitemap.xml": "application/xml; charset=utf-8",
  "/robots.txt": "text/plain; charset=utf-8",
  "/seo-metadata.json": "application/json; charset=utf-8",
};

export function staticRootContentType(pathname: string): string | undefined {
  if (pathname === "" || pathname === "/") return undefined;
  try {
    return STATIC_ROOT_CONTENT_TYPES[decodeURI(pathname)];
  } catch {
    return STATIC_ROOT_CONTENT_TYPES[pathname];
  }
}
