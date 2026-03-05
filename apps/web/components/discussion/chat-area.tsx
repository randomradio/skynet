"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MessageBubble } from "./message-bubble";
import { MessageThread } from "./message-thread";
import { ReplyComposer } from "./reply-composer";
import { MentionAutocomplete } from "./mention-autocomplete";
import { useAIStream } from "@/hooks/use-ai-stream";

export interface Message {
  id: string;
  authorId?: string | null;
  authorType: "user" | "ai" | "system";
  content: string;
  createdAt: string;
  parentId?: string | null;
  threadCount?: number;
}

export interface AuthorProfile {
  username: string;
  avatarUrl: string | null;
}

interface ChatAreaProps {
  issueId: string;
  initialMessages: Message[];
  finalized: boolean;
  currentUserId?: string | null;
  authors?: Record<string, AuthorProfile>;
  repoContext?: { owner: string; name: string };
  participants?: Array<{ githubId: number; username: string; avatarUrl: string | null }>;
}

function generateId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

interface ThreadedMessage extends Message {
  replies: Message[];
}

function organizeThreads(messages: Message[]): ThreadedMessage[] {
  const roots = messages.filter((m) => !m.parentId);
  const replyMap = new Map<string, Message[]>();
  for (const m of messages) {
    if (m.parentId) {
      const arr = replyMap.get(m.parentId) ?? [];
      arr.push(m);
      replyMap.set(m.parentId, arr);
    }
  }
  return roots.map((root) => ({ ...root, replies: replyMap.get(root.id) ?? [] }));
}

export function ChatArea({
  issueId,
  initialMessages,
  finalized,
  currentUserId,
  authors = {},
  repoContext,
  participants = [],
}: ChatAreaProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

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

  async function handleSend(parentId?: string) {
    const text = input.trim();
    if (!text || sending || isStreaming || finalized) return;

    setInput("");
    setSending(true);
    setReplyingTo(null);

    try {
      const res = await fetch(`/api/issues/${issueId}/discussion/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text, parentId: parentId ?? undefined }),
      });

      const data = await res.json();
      if (data.message) {
        setMessages((prev) => [
          ...prev,
          {
            id: data.message.id,
            authorId: currentUserId ?? null,
            authorType: "user",
            content: text,
            createdAt: new Date().toISOString(),
            parentId: parentId ?? null,
          },
        ]);
        // Update parent thread count
        if (parentId) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === parentId ? { ...m, threadCount: (m.threadCount ?? 0) + 1 } : m,
            ),
          );
        }
      }

      if (data.aiResponsePending) {
        await startStream();
      }
    } catch {
      // error silently
    } finally {
      setSending(false);
    }
  }

  // When streaming finishes, add the AI message
  useEffect(() => {
    if (!isStreaming && streamContent) {
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.authorType === "ai" && last.content === streamContent) {
          return prev;
        }
        return [
          ...prev,
          {
            id: generateId(),
            authorType: "ai",
            content: streamContent,
            createdAt: new Date().toISOString(),
          },
        ];
      });
    }
  }, [isStreaming, streamContent]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend(replyingTo ?? undefined);
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value;
    setInput(val);

    // Detect @mention trigger
    const cursorPos = e.target.selectionStart;
    const textBefore = val.slice(0, cursorPos);
    const mentionMatch = textBefore.match(/@(\w*)$/);
    if (mentionMatch) {
      setShowMentions(true);
      setMentionQuery(mentionMatch[1] ?? "");
    } else {
      setShowMentions(false);
    }
  }

  function handleMentionSelect(username: string) {
    const cursorPos = inputRef.current?.selectionStart ?? input.length;
    const textBefore = input.slice(0, cursorPos);
    const textAfter = input.slice(cursorPos);
    const replaced = textBefore.replace(/@\w*$/, `@${username} `);
    setInput(replaced + textAfter);
    setShowMentions(false);
    inputRef.current?.focus();
  }

  const threads = organizeThreads(messages);

  function getAuthorProfile(msg: Message) {
    if (msg.authorId && authors[msg.authorId]) {
      return authors[msg.authorId];
    }
    return null;
  }

  return (
    <div className="flex h-full flex-col">
      {/* Messages */}
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
        {threads.map((thread) => {
          if (thread.replies.length > 0) {
            return (
              <MessageThread
                key={thread.id}
                parent={thread}
                replies={thread.replies}
                currentUserId={currentUserId}
                authors={authors}
                repoContext={repoContext}
                onReply={(id) => setReplyingTo(id)}
              />
            );
          }

          return (
            <MessageBubble
              key={thread.id}
              id={thread.id}
              authorType={thread.authorType}
              authorProfile={getAuthorProfile(thread)}
              isCurrentUser={
                thread.authorType === "user" &&
                !!currentUserId &&
                thread.authorId === currentUserId
              }
              content={thread.content}
              createdAt={thread.createdAt}
              repoContext={repoContext}
              threadCount={thread.threadCount}
              onReply={(id) => setReplyingTo(id)}
            />
          );
        })}
        {isStreaming && streamContent && (
          <MessageBubble
            authorType="ai"
            content={streamContent}
            isStreaming
            repoContext={repoContext}
          />
        )}
        {streamError && (
          <p className="text-center text-xs text-red-400">{streamError}</p>
        )}
      </div>

      {/* Reply indicator */}
      {replyingTo && (
        <div className="flex items-center gap-2 border-t border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-4 py-2">
          <span className="text-xs text-[var(--text-tertiary)]">
            Replying to message
          </span>
          <button
            onClick={() => setReplyingTo(null)}
            className="text-xs text-[var(--text-quaternary)] hover:text-[var(--accent-red)]"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Input */}
      {!finalized && (
        <div className="relative border-t border-[var(--border-subtle)] bg-[var(--bg-primary)] p-4">
          {showMentions && (
            <MentionAutocomplete
              query={mentionQuery}
              participants={participants}
              onSelect={handleMentionSelect}
              onClose={() => setShowMentions(false)}
            />
          )}
          <div className="flex gap-2">
            <textarea
              ref={inputRef}
              className="flex-1 resize-none rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-quaternary)] focus:border-[var(--accent-blue)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-blue)]/30"
              placeholder={replyingTo ? "Write a reply..." : "Type a message... (use @ai to ask AI)"}
              rows={2}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              disabled={sending || isStreaming}
            />
            <button
              onClick={() => handleSend(replyingTo ?? undefined)}
              disabled={!input.trim() || sending || isStreaming}
              className="rounded-lg bg-gradient-to-r from-[var(--accent-blue)] to-blue-600 px-4 py-2 text-sm font-medium text-white transition-all hover:shadow-lg hover:shadow-[var(--glow-blue)] disabled:opacity-40 disabled:hover:shadow-none"
            >
              {sending || isStreaming ? "..." : "Send"}
            </button>
          </div>
        </div>
      )}

      {finalized && (
        <div className="border-t border-amber-500/20 bg-amber-500/5 p-3 text-center text-xs text-amber-400">
          This discussion has been finalized.
        </div>
      )}
    </div>
  );
}
