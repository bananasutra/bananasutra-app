/**
 * HTMLRewriter pipeline for bot responses: inject per-route SEO tags into the
 * origin HTML shell. Cloudflare-only API — not available under Node's test
 * runner; verify with `npm run dev` + the curl matrix in `src/index.ts`.
 *
 * When the origin omits `meta[property="og:*"]` / `link[rel="canonical"]` (as
 * on current GitHub Pages HTML), we append a safe escaped fragment right after
 * `<head>` so crawlers still see link-preview tags; existing handlers update
 * those tags when the shell already includes them.
 */

import { buildBotLinkPreviewHeadFragment } from "./seoHeadFragment.ts";

export interface RouteMeta {
  title: string;
  description: string;
  canonical: string;
  image?: string;
  type?: string;
}

function isHtmlResponse(response: Response): boolean {
  const ct = response.headers.get("content-type") ?? "";
  return ct.includes("text/html");
}

/**
 * Returns a new transformed Response; does not mutate the input when rewriting
 * is skipped (non-HTML or missing body).
 */
export function rewriteHtmlMetadata(
  response: Response,
  meta: RouteMeta,
): Response {
  if (!response.body || !isHtmlResponse(response)) {
    return new Response(response.body, response);
  }

  const ogType = meta.type ?? "website";
  const headFragment = buildBotLinkPreviewHeadFragment(meta);

  const rewriter = new HTMLRewriter()
    .on("head", {
      element(el) {
        el.append(headFragment, { html: true });
      },
    })
    .on("title", {
      element(el) {
        el.setInnerContent(meta.title, { html: false });
      },
    })
    .on('meta[property="og:title"]', {
      element(el) {
        el.setAttribute("content", meta.title);
      },
    })
    .on('meta[property="og:description"]', {
      element(el) {
        el.setAttribute("content", meta.description);
      },
    })
    .on('meta[property="og:url"]', {
      element(el) {
        el.setAttribute("content", meta.canonical);
      },
    })
    .on('meta[property="og:type"]', {
      element(el) {
        el.setAttribute("content", ogType);
      },
    })
    .on('meta[property="og:image"]', {
      element(el) {
        if (meta.image) {
          el.setAttribute("content", meta.image);
        }
      },
    })
    .on('meta[name="description"]', {
      element(el) {
        el.setAttribute("content", meta.description);
      },
    })
    .on('meta[name="twitter:title"]', {
      element(el) {
        el.setAttribute("content", meta.title);
      },
    })
    .on('meta[name="twitter:description"]', {
      element(el) {
        el.setAttribute("content", meta.description);
      },
    })
    .on('meta[name="twitter:image"]', {
      element(el) {
        if (meta.image) {
          el.setAttribute("content", meta.image);
        }
      },
    })
    .on('link[rel="canonical"]', {
      element(el) {
        el.setAttribute("href", meta.canonical);
      },
    });

  return rewriter.transform(response);
}
