/**
 * Bot User-Agent detection (Phase 3, task 14).
 *
 * Source of truth: SEO-ENHANCEMENT-EPIC.md §1.3 — keep BOT_UA_PATTERNS in
 * lock-step with the epic. If you add or remove a pattern here, update both
 * the epic and tests/botDetection.test.ts.
 *
 * Deliberate deviations from the epic's array order:
 *   - "TelegramBot" is placed before "Twitterbot" because Telegram's real UA
 *     identifies as "TelegramBot (like TwitterBot)" — it embeds "TwitterBot"
 *     to ride Twitter whitelists. Without the reorder, our case-insensitive
 *     substring match would attribute Telegram traffic to Twitter in the
 *     debug header. Functional behavior (both treated as bots) is unchanged.
 *
 * Deliberate omissions from the epic's array:
 *   - "iMessageBot" — never seen in real Apple link-preview traffic; Apple
 *     uses Applebot and (indirectly) facebookexternalhit. Add back if it
 *     ever appears in Worker logs.
 *
 * Matching rules:
 *   - Case-insensitive substring match against the request's User-Agent.
 *   - Empty / missing User-Agent → treated as human (passthrough). The
 *     alternative (treating missing UA as bot) would over-trigger SEO
 *     rewrites for curl probes, health checks, and clients that strip UA.
 */

export const BOT_UA_PATTERNS: readonly string[] = [
  "facebookexternalhit",
  "Facebot",
  "TelegramBot",
  "Twitterbot",
  "LinkedInBot",
  "Slackbot",
  "WhatsApp",
  "Discordbot",
  "Googlebot",
  "bingbot",
  "Baiduspider",
  "YandexBot",
  "Applebot",
  "PinterestBot",
  "Embedly",
  "Quora Link Preview",
  "Showyoubot",
  "outbrain",
  "rogerbot",
  "vkShare",
  "W3C_Validator",
  "redditbot",
] as const;

/**
 * Returns the first BOT_UA_PATTERNS entry that matches the given User-Agent
 * (case-insensitively), or null when the request is from a human or has no
 * usable UA string.
 *
 * Exposing the matched pattern (rather than a plain boolean) makes downstream
 * debugging easier — Worker logs and the x-banana-bot-detected debug header
 * can show *which* bot triggered the rewrite path.
 */
export function detectBotPattern(
  userAgent: string | null | undefined,
): string | null {
  if (!userAgent) return null;
  const ua = userAgent.toLowerCase();
  for (const pattern of BOT_UA_PATTERNS) {
    if (ua.includes(pattern.toLowerCase())) {
      return pattern;
    }
  }
  return null;
}

/**
 * Convenience wrapper for callers that only need a boolean.
 */
export function isBot(userAgent: string | null | undefined): boolean {
  return detectBotPattern(userAgent) !== null;
}
