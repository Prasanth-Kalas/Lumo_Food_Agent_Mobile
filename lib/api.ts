/**
 * Chat API client.
 *
 * Talks to the Next.js /api/chat route (Vercel AI SDK data stream protocol).
 * We don't pull in the web `ai/react` useChat hook here because it assumes
 * `fetch` streaming semantics that aren't reliable across RN's fetch
 * polyfill on older devices. So we parse the data stream ourselves — the
 * protocol is small.
 *
 * Data stream chunks look like: `<typeCode>:<json>\n`
 * We care about:
 *   0:"text"         → append to the assistant message's text
 *   9:{toolCall}     → a tool being called (transient)
 *   a:{toolResult}   → a tool's result (this is what we render cards from)
 *   e:{finishReason} → end of a step
 *   d:{finishReason} → end of the whole stream
 *
 * Anything else we ignore. New codes can be added without breaking us.
 */

import Constants from "expo-constants";
import type { ChatMessage, ToolInvocation } from "./types";

export function getApiBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  // Fallback to app.json extra if we want to ship a default build.
  const fromConstants = (Constants.expoConfig?.extra as any)?.apiBaseUrl;
  if (fromConstants) return String(fromConstants).replace(/\/$/, "");
  // Last resort — this will fail fast in dev, which is what we want.
  throw new Error(
    "EXPO_PUBLIC_API_BASE_URL is not set. Copy .env.example to .env and fill it in."
  );
}

export interface StreamHandlers {
  onAssistantTextDelta: (text: string) => void;
  onToolCall: (invocation: ToolInvocation) => void;
  onToolResult: (invocation: ToolInvocation) => void;
  onDone: () => void;
  onError: (err: Error) => void;
}

/**
 * Send the full message history to /api/chat and stream the response.
 * Returns a function that aborts the in-flight request.
 */
export function streamChat(
  messages: ChatMessage[],
  handlers: StreamHandlers
): () => void {
  const ctrl = new AbortController();

  (async () => {
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: messages.map(({ role, content }) => ({ role, content })),
        }),
        signal: ctrl.signal,
      });

      if (!res.ok || !res.body) {
        throw new Error(`Request failed: ${res.status}`);
      }

      const reader = (res.body as ReadableStream<Uint8Array>).getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // The data stream splits on newlines.
        let newlineIdx: number;
        while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
          const raw = buffer.slice(0, newlineIdx);
          buffer = buffer.slice(newlineIdx + 1);
          if (!raw) continue;

          const colonIdx = raw.indexOf(":");
          if (colonIdx < 0) continue;
          const type = raw.slice(0, colonIdx);
          const jsonText = raw.slice(colonIdx + 1);

          try {
            const payload = JSON.parse(jsonText);
            handleChunk(type, payload, handlers);
          } catch {
            // Skip malformed chunks — the stream can recover.
          }
        }
      }

      handlers.onDone();
    } catch (err: any) {
      if (err?.name === "AbortError") return;
      handlers.onError(err instanceof Error ? err : new Error(String(err)));
    }
  })();

  return () => ctrl.abort();
}

function handleChunk(
  type: string,
  payload: any,
  handlers: StreamHandlers
): void {
  switch (type) {
    case "0":
      // Text delta on the assistant message.
      if (typeof payload === "string") handlers.onAssistantTextDelta(payload);
      break;
    case "9":
      // Tool call (args known, result pending).
      handlers.onToolCall({
        toolCallId: payload.toolCallId,
        toolName: payload.toolName,
        args: payload.args,
        state: "call",
      });
      break;
    case "a":
      // Tool result.
      handlers.onToolResult({
        toolCallId: payload.toolCallId,
        toolName: payload.toolName ?? "",
        result: payload.result,
        state: "result",
      });
      break;
    case "3":
      // Error frame.
      handlers.onError(new Error(String(payload)));
      break;
    default:
      // d (finish), e (step finish), f (message id), etc. — ignore.
      break;
  }
}
