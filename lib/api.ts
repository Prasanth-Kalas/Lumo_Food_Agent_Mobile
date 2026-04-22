/**
 * Chat API client.
 *
 * Talks to the Next.js /api/chat route (Vercel AI SDK data stream protocol).
 * We don't pull in the web `ai/react` useChat hook because it assumes
 * `fetch().body` is a real ReadableStream. On React Native 0.76 (iOS + New
 * Architecture) `fetch` returns res.body as null/unreadable even on 200 —
 * whatwg-fetch doesn't ship ReadableStream for response bodies by default.
 * We use XMLHttpRequest instead: it's the RN-reliable way to consume a
 * streaming HTTP response. On each readystatechange we slice the new text
 * off the end of xhr.responseText and feed it through the same line parser
 * the web uses.
 *
 * Data stream chunks look like: `<typeCode>:<json>\n`
 * We care about:
 *   0:"text"         → append to the assistant message's text
 *   9:{toolCall}     → a tool being called (transient)
 *   a:{toolResult}   → a tool's result (this is what we render cards from)
 *   e:{finishReason} → end of a step
 *   d:{finishReason} → end of the whole stream
 *   f:{messageId}    → message id (we ignore)
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
 *
 * Implementation notes:
 *  - We track `consumed` so we only process new bytes on each readystate
 *    callback (responseText is cumulative in XHR).
 *  - The backend sends chunks newline-delimited, but XHR can buffer across
 *    TCP packets, so we keep a rolling `buffer` of the tail and only parse
 *    complete lines.
 *  - We rely on xhr.readyState === 3 (LOADING) firing repeatedly during
 *    streaming. In production RN this works; if a device buffers the whole
 *    response before flushing, we still get it in one shot at state 4.
 */
export interface StreamChatOptions {
  /** Forwarded to the backend so it can tailor the system prompt. */
  voiceMode?: boolean;
}

export function streamChat(
  messages: ChatMessage[],
  options: StreamChatOptions,
  handlers: StreamHandlers
): () => void {
  const xhr = new XMLHttpRequest();
  let aborted = false;
  let consumed = 0;
  let buffer = "";
  let done = false;

  function drainBuffer() {
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

  xhr.open("POST", `${getApiBaseUrl()}/api/chat`, true);
  xhr.setRequestHeader("Content-Type", "application/json");
  // Hint to the stack that we want incremental text — some RN network
  // layers will buffer otherwise. "" lets us read responseText.
  xhr.responseType = "text";

  xhr.onreadystatechange = () => {
    if (aborted || done) return;

    // states: 0 UNSENT, 1 OPENED, 2 HEADERS_RECEIVED, 3 LOADING, 4 DONE
    if (xhr.readyState < 3) return;

    // Non-2xx: surface as error once we've seen the status.
    if (xhr.readyState === 3 && xhr.status && (xhr.status < 200 || xhr.status >= 300)) {
      // Wait for DONE to read the full body for a useful message.
      return;
    }

    const text = xhr.responseText ?? "";
    if (text.length > consumed) {
      buffer += text.slice(consumed);
      consumed = text.length;
      drainBuffer();
    }

    if (xhr.readyState === 4) {
      done = true;
      if (xhr.status >= 200 && xhr.status < 300) {
        // Flush any trailing line without a newline.
        if (buffer.length > 0) {
          buffer += "\n";
          drainBuffer();
        }
        handlers.onDone();
      } else {
        handlers.onError(
          new Error(
            `Request failed: ${xhr.status}${xhr.statusText ? " " + xhr.statusText : ""}`
          )
        );
      }
    }
  };

  xhr.onerror = () => {
    if (aborted || done) return;
    done = true;
    handlers.onError(new Error("Network error reaching chat backend."));
  };

  xhr.ontimeout = () => {
    if (aborted || done) return;
    done = true;
    handlers.onError(new Error("Chat request timed out."));
  };

  try {
    xhr.send(
      JSON.stringify({
        messages: messages.map(({ role, content }) => ({ role, content })),
        voiceMode: options.voiceMode === true,
      })
    );
  } catch (err) {
    done = true;
    handlers.onError(err instanceof Error ? err : new Error(String(err)));
  }

  return () => {
    aborted = true;
    try {
      xhr.abort();
    } catch {
      // ignore
    }
  };
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
