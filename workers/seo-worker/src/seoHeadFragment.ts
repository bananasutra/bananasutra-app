/**
 * Escaped `<head>` fragment for bot link previews when the origin HTML omits
 * Open Graph / Twitter / canonical tags.
 */

export interface BotHeadFragmentMeta {
  title: string;
  description: string;
  canonical: string;
  image?: string;
  type?: string;
}

/** Escape text for double-quoted HTML attribute values (Worker-injected head fragment). */
export function escapeHtmlAttributeValue(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

const OG_SITE_NAME = "BANANASUTRA";

/**
 * Injected immediately after `<head>` for bot responses when the origin shell
 * omits Open Graph / Twitter / canonical tags (GitHub Pages currently serves
 * a minimal head). Existing `.on('meta[property="og:title"]', …)` handlers
 * remain for shells that already include those tags.
 */
export function buildBotLinkPreviewHeadFragment(meta: BotHeadFragmentMeta): string {
  const t = escapeHtmlAttributeValue(meta.title);
  const d = escapeHtmlAttributeValue(meta.description);
  const c = escapeHtmlAttributeValue(meta.canonical);
  const ogType = escapeHtmlAttributeValue(meta.type ?? "website");
  const twitterCard = meta.image ? "summary_large_image" : "summary";
  const lines: string[] = [
    `<meta property="og:title" content="${t}" />`,
    `<meta property="og:description" content="${d}" />`,
    `<meta property="og:url" content="${c}" />`,
    `<meta property="og:type" content="${ogType}" />`,
    `<meta property="og:site_name" content="${OG_SITE_NAME}" />`,
    `<meta name="twitter:card" content="${twitterCard}" />`,
    `<meta name="twitter:title" content="${t}" />`,
    `<meta name="twitter:description" content="${d}" />`,
  ];
  if (meta.image) {
    const img = escapeHtmlAttributeValue(meta.image);
    lines.push(
      `<meta property="og:image" content="${img}" />`,
      `<meta name="twitter:image" content="${img}" />`,
    );
  }
  lines.push(`<link rel="canonical" href="${c}" />`);
  return `${lines.join("\n")}\n`;
}
