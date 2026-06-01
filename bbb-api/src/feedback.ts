import type { BbbPageContext } from "./recommendation-context";

export const FEEDBACK_INTENT_TYPES = ["feedback", "song-idea", "bug-report", "broken-link"] as const;
export type FeedbackIntentType = (typeof FEEDBACK_INTENT_TYPES)[number];
export type FeedbackDeliveryStatus = "delivered" | "apps_script_error" | "dropped";

export interface FeedbackPayload {
  name?: string;
  email?: string;
  message: string;
  intentType: FeedbackIntentType;
  conversationTail?: string;
  requestId?: string;
  pageContext?: BbbPageContext;
  sendCopy?: boolean;
}

const intentSubject = (intent: FeedbackIntentType): string => {
  if (intent === "song-idea") return "song idea";
  if (intent === "bug-report") return "bug report";
  if (intent === "broken-link") return "broken link";
  return "feedback";
};

const normalizeName = (name?: string): string => {
  const trimmed = name?.trim();
  return trimmed ? trimmed : "Anonymous via BBB";
};

const normalizeEmail = (email?: string): string => {
  const trimmed = email?.trim();
  return trimmed ? trimmed : "no reply requested";
};

const clip = (value: string | undefined, maxChars: number): string | undefined => {
  if (!value) return undefined;
  const normalized = value.trim();
  if (!normalized) return undefined;
  return normalized.length > maxChars ? normalized.slice(0, maxChars) : normalized;
};

const buildAppsScriptBody = (payload: FeedbackPayload): Record<string, string> => {
  const subject = `[BBB] ${intentSubject(payload.intentType)}`;
  const name = normalizeName(payload.name);
  const email = normalizeEmail(payload.email);
  const pathname = payload.pageContext?.pathname?.trim() || "/";
  const search = payload.pageContext?.search?.trim() || "";
  const requestId = clip(payload.requestId, 200) ?? "n/a";
  const conversationTail = clip(payload.conversationTail, 600);
  const location = `${pathname}${search}`;

  const lines = [
    `Name: ${name}`,
    `Email: ${email}`,
    `Intent: ${payload.intentType}`,
    `Request ID: ${requestId}`,
    `Path: ${location}`,
    "",
    payload.message.trim(),
  ];

  if (conversationTail) {
    lines.push("", "Conversation tail:", conversationTail);
  }

  return {
    name,
    email: payload.email?.trim() ?? "",
    subject,
    message: lines.join("\n"),
    userMessage: payload.message.trim(),
    ...(payload.sendCopy ? { sendCopy: "true" } : {}),
  };
};

const parseAppsScriptBody = async (
  response: Response,
): Promise<{ ok: boolean; error?: string }> => {
  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    return {
      ok: false,
      error: "Apps Script returned invalid JSON.",
    };
  }

  if (!response.ok) {
    const error =
      typeof payload === "object" && payload && "error" in payload && typeof payload.error === "string"
        ? payload.error
        : `Apps Script returned HTTP ${response.status}.`;
    return { ok: false, error };
  }

  if (typeof payload === "object" && payload && "ok" in payload) {
    const ok = Boolean((payload as { ok?: unknown }).ok);
    if (!ok) {
      const error =
        typeof (payload as { error?: unknown }).error === "string"
          ? ((payload as { error?: string }).error ?? "Apps Script rejected request.")
          : "Apps Script rejected request.";
      return { ok: false, error };
    }
  }

  return { ok: true };
};

export const postFeedbackToAppsScript = async (input: {
  url: string;
  payload: FeedbackPayload;
}): Promise<{ ok: boolean; error?: string }> => {
  const response = await fetch(input.url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(buildAppsScriptBody(input.payload)),
  });
  return parseAppsScriptBody(response);
};
