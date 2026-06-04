/** Cloudflare Pages R50 production + commit preview hosts (HTTPS only). */
const PAGES_STAGING_HOST_SUFFIX = ".bananasutra-redesign.pages.dev";

export const isAllowedBbbOrigin = (origin: string, allowedOrigins: string[]): boolean => {
  if (allowedOrigins.includes(origin)) return true;
  try {
    const { protocol, hostname } = new URL(origin);
    if (protocol !== "https:") return false;
    if (hostname === "stage.bananasutra.com") return true;
    if (hostname === "bananasutra-redesign.pages.dev") return true;
    if (hostname.endsWith(PAGES_STAGING_HOST_SUFFIX)) return true;
  } catch {
    return false;
  }
  return false;
};
