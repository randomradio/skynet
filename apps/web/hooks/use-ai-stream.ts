"use client";

import { useCallback, useRef, useState } from "react";

interface UseAIStreamOptions {
  url: string;
}

interface UseAIStreamReturn {
  content: string;
  isStreaming: boolean;
  error: string | null;
  messageId: string | null;
  startStream: () => Promise<void>;
  reset: () => void;
}

export function useAIStream({ url }: UseAIStreamOptions): UseAIStreamReturn {
  const [content, setContent] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messageId, setMessageId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const startStream = useCallback(async () => {
    abortRef.current?.abort();
    const abort = new AbortController();
    abortRef.current = abort;

    setContent("");
    setIsStreaming(true);
    setError(null);
    setMessageId(null);

    try {
      const res = await fetch(url, {
        method: "POST",
        signal: abort.signal,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message ?? `HTTP ${res.status}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (!json) continue;

          try {
            const parsed = JSON.parse(json);
            if (parsed.error) {
              setError(parsed.error);
            } else if (parsed.done) {
              setMessageId(parsed.messageId ?? null);
            } else if (parsed.content) {
              setContent((prev) => prev + parsed.content);
            }
          } catch {
            // skip malformed lines
          }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name !== "AbortError") {
        setError(err.message);
      }
    } finally {
      setIsStreaming(false);
    }
  }, [url]);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setContent("");
    setIsStreaming(false);
    setError(null);
    setMessageId(null);
  }, []);

  return { content, isStreaming, error, messageId, startStream, reset };
}
