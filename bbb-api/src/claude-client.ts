export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ClaudeStreamRequest {
  apiKey: string;
  model: string;
  systemStatic: string;
  systemDynamic?: string;
  messages: ChatMessage[];
  maxTokens?: number;
  bufferUntilDone?: boolean;
  finalizeAssistantText?: (text: string) => string;
  onFinish?: (result: ClaudeStreamFinishResult) => void;
}

export interface ClaudeStreamFinishResult {
  assistantText: string;
  streamError: string | null;
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

interface ClaudeSystemTextBlock {
  type: "text";
  text: string;
  cache_control?: {
    type: "ephemeral";
  };
}

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
    return (typed.delta.text ?? "").replace(/\s*—\s*/g, ", ");
  }
  return null;
};

export const streamClaudeResponse = async (request: ClaudeStreamRequest): Promise<ReadableStream<Uint8Array>> => {
  const system: ClaudeSystemTextBlock[] = [
    {
      type: "text",
      text: request.systemStatic,
      cache_control: { type: "ephemeral" },
    },
  ];
  if (request.systemDynamic) {
    system.push({
      type: "text",
      text: request.systemDynamic,
    });
  }

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
      system,
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
      let assistantText = "";
      const notifyFinish = (streamError: string | null) => {
        try {
          request.onFinish?.({ assistantText, streamError });
        } catch {
          // Do not allow optional callback failures to affect the stream.
        }
      };
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
            assistantText += text;
            if (!request.bufferUntilDone) {
              controller.enqueue(toEventLine("token", { text }));
            }
          }
        }
        if (request.finalizeAssistantText) {
          assistantText = request.finalizeAssistantText(assistantText);
        }
        if (request.bufferUntilDone && assistantText.length > 0) {
          controller.enqueue(toEventLine("token", { text: assistantText }));
        }
        notifyFinish(null);
        controller.enqueue(toEventLine("done", { ok: true }));
        controller.close();
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown streaming error";
        notifyFinish(message);
        controller.enqueue(
          toEventLine("error", {
            message,
          }),
        );
        controller.close();
      } finally {
        reader.releaseLock();
      }
    },
  });
};
