import { useCallback, useRef, useState } from "react";
import { streamChat } from "@/lib/api";
import type { ChatMessage, ToolInvocation } from "@/lib/types";

/**
 * Minimal replacement for `ai/react`'s useChat that works cleanly on RN.
 * Drives the mobile chat screen: keeps messages, streams assistant text +
 * tool invocations, exposes `append(text)` and `stop()`.
 *
 * Options:
 *   voiceMode — forwarded to /api/chat so the backend can inject the
 *     "write for the ear" prompt block when the user has voice replies on.
 */
export function useLumoChat(opts: { voiceMode?: boolean } = {}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const abortRef = useRef<(() => void) | null>(null);
  // Pin latest options in a ref so the closure stays stable across re-renders.
  const optsRef = useRef(opts);
  optsRef.current = opts;

  const sendCore = useCallback((nextMessages: ChatMessage[]) => {
    setMessages(nextMessages);
    setIsLoading(true);

    // Placeholder assistant message that we mutate as deltas come in.
    const assistantId = `a_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    setMessages((prev) => [
      ...prev,
      { id: assistantId, role: "assistant", content: "", toolInvocations: [] },
    ]);

    const abort = streamChat(nextMessages, { voiceMode: optsRef.current.voiceMode === true }, {
      onAssistantTextDelta: (delta) => {
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id !== assistantId) return m;
            // Glue-space fix: when the model streams text, then calls a tool,
            // then resumes streaming text, the two halves concat directly —
            // producing "near you!Got three options..." because the voice-mode
            // prompt tells the model not to emit markdown/line breaks. If the
            // existing content ends with sentence-terminating punctuation and
            // the next delta starts with a letter, insert a single space.
            const needsSpace =
              m.content.length > 0 &&
              /[.!?]$/.test(m.content) &&
              /^[A-Za-z]/.test(delta);
            const sep = needsSpace ? " " : "";
            return { ...m, content: m.content + sep + delta };
          })
        );
      },
      onToolCall: (inv) => {
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id !== assistantId) return m;
            const existing = m.toolInvocations ?? [];
            if (existing.some((e) => e.toolCallId === inv.toolCallId)) return m;
            return { ...m, toolInvocations: [...existing, inv] };
          })
        );
      },
      onToolResult: (inv) => {
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id !== assistantId) return m;
            const existing = m.toolInvocations ?? [];
            const idx = existing.findIndex(
              (e) => e.toolCallId === inv.toolCallId
            );
            const merged: ToolInvocation = idx >= 0
              ? { ...existing[idx], ...inv, state: "result" }
              : inv;
            const next =
              idx >= 0
                ? existing.map((e, i) => (i === idx ? merged : e))
                : [...existing, merged];
            return { ...m, toolInvocations: next };
          })
        );
      },
      onDone: () => {
        setIsLoading(false);
        abortRef.current = null;
      },
      onError: (err) => {
        console.warn("[useLumoChat] stream error", err);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  content:
                    m.content ||
                    "Hmm — I lost the connection. Try again in a moment.",
                }
              : m
          )
        );
        setIsLoading(false);
        abortRef.current = null;
      },
    });
    abortRef.current = abort;
  }, []);

  const append = useCallback(
    (text: string) => {
      if (!text.trim()) return;
      const userMessage: ChatMessage = {
        id: `u_${Date.now()}`,
        role: "user",
        content: text.trim(),
      };
      setMessages((prev) => {
        const next = [...prev, userMessage];
        // Defer the stream so React applies the user message first.
        queueMicrotask(() => sendCore(next));
        return next;
      });
    },
    [sendCore]
  );

  const stop = useCallback(() => {
    abortRef.current?.();
    abortRef.current = null;
    setIsLoading(false);
  }, []);

  return { messages, isLoading, append, stop };
}
