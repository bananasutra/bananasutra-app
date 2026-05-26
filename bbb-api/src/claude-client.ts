export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ClaudeStreamRequest {
  apiKey: string;
  model: string;
  system: string;
  messages: ChatMessage[];
  maxTokens?: number;
}

export class ClaudeUpstreamError extends Error {
  status: number;
  detail: string;

  constructor(status: number, detail: string) {
    super(`Anthropic upstream error (${status})`);
    this.status = status;
    this.detail = detail;
  }
}

const TEXT_ENCODER = new TextEncoder();

const safeParseJson = (raw: string): unknown => {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
};

const toEventLine = (event: string, payload: unknown): Uint8Array => {
  const body = JSON.stringify(payload);
  return TEXT_ENCODER.encode(`event: ${event}\ndata: ${body}\n\n`);
};

const parseAnthropicSseData = (line: string): string | null => {
  if (!line.startsWith("data:")) return null;
  const payloadRaw = line.slice("data:".length).trim();
  if (!payloadRaw || payloadRaw === "[DONE]") return null;

  const parsed = safeParseJson(payloadRaw);
  if (!parsed || typeof parsed !== "object") return null;

  const typed = parsed as {
    type?: string;
    delta?: { type?: string; text?: string };
  };
  if (typed.type === "content_block_delta" && typed.delta?.type === "text_delta") {
    return (typed.delta.text ?? "").replace(/—/g, ", ");
  }
  return null;
};

export const streamClaudeResponse = async (request: ClaudeStreamRequest): Promise<ReadableStream<Uint8Array>> => {
  const upstreamResponse = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "anthropic-version": "2023-06-01",
      "x-api-key": request.apiKey,
    },
    body: JSON.stringify({
      model: request.model,
      max_tokens: request.maxTokens ?? 1000,
      stream: true,
      system: request.system,
      messages: request.messages,
    }),
  });

  if (!upstreamResponse.ok || !upstreamResponse.body) {
    const detail = await upstreamResponse.text();
    throw new ClaudeUpstreamError(upstreamResponse.status, detail.slice(0, 1500));
  }

  const reader = upstreamResponse.body.getReader();
  const decoder = new TextDecoder();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      let pending = "";
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          pending += decoder.decode(value, { stream: true });
          const lines = pending.split("\n");
          pending = lines.pop() ?? "";

          for (const line of lines) {
            const text = parseAnthropicSseData(line);
            if (text === null) continue;
            controller.enqueue(toEventLine("token", { text }));
          }
        }
        controller.enqueue(toEventLine("done", { ok: true }));
        controller.close();
      } catch (error) {
        controller.enqueue(
          toEventLine("error", {
            message: error instanceof Error ? error.message : "Unknown streaming error",
          }),
        );
        controller.close();
      } finally {
        reader.releaseLock();
      }
    },
  });
};
