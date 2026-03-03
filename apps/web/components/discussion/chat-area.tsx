"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MessageBubble } from "./message-bubble";
import { useAIStream } from "@/hooks/use-ai-stream";

interface Message {
  id: string;
  authorType: "user" | "ai";
  content: string;
  createdAt: string;
}

interface ChatAreaProps {
  issueId: string;
  initialMessages: Message[];
  finalized: boolean;
}

export function ChatArea({ issueId, initialMessages, finalized }: ChatAreaProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const {
    content: streamContent,
    isStreaming,
    error: streamError,
    startStream,
  } = useAIStream({
    url: `/api/issues/${issueId}/discussion/ai-respond`,
  });

  const scrollToBottom = useCallback(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamContent, scrollToBottom]);

  async function handleSend() {
    const text = input.trim();
    if (!text || sending || isStreaming || finalized) return;

    setInput("");
    setSending(true);

    try {
      const res = await fetch(`/api/issues/${issueId}/discussion/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text }),
      });

      const data = await res.json();
      if (data.message) {
        setMessages((prev) => [
          ...prev,
          {
            id: data.message.id,
            authorType: "user",
            content: text,
            createdAt: new Date().toISOString(),
          },
        ]);
      }

      // Trigger AI response
      await startStream();

      // After streaming completes, add AI message to the list
      // We need to re-read streamContent after completion
    } catch {
      // error silently
    } finally {
      setSending(false);
    }
  }

  // When streaming finishes, add the AI message to the messages list
  useEffect(() => {
    if (!isStreaming && streamContent) {
      setMessages((prev) => {
        // Avoid duplicate: check if last message is same content
        const last = prev[prev.length - 1];
        if (last?.authorType === "ai" && last.content === streamContent) {
          return prev;
        }
        return [
          ...prev,
          {
            id: crypto.randomUUID(),
            authorType: "ai",
            content: streamContent,
            createdAt: new Date().toISOString(),
          },
        ];
      });
    }
  }, [isStreaming, streamContent]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Messages */}
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.map((m) => (
          <MessageBubble
            key={m.id}
            authorType={m.authorType}
            content={m.content}
            createdAt={m.createdAt}
          />
        ))}
        {isStreaming && streamContent && (
          <MessageBubble
            authorType="ai"
            content={streamContent}
            isStreaming
          />
        )}
        {streamError && (
          <p className="text-center text-xs text-red-500">{streamError}</p>
        )}
      </div>

      {/* Input */}
      {!finalized && (
        <div className="border-t bg-white p-4">
          <div className="flex gap-2">
            <textarea
              className="flex-1 resize-none rounded border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Type a message..."
              rows={2}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={sending || isStreaming}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || sending || isStreaming}
              className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {sending || isStreaming ? "..." : "Send"}
            </button>
          </div>
        </div>
      )}

      {finalized && (
        <div className="border-t bg-amber-50 p-3 text-center text-sm text-amber-700">
          This discussion has been finalized.
        </div>
      )}
    </div>
  );
}
