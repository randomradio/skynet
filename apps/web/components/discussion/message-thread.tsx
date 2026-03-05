"use client";

import { useState } from "react";
import { MessageBubble } from "./message-bubble";
import type { Message, AuthorProfile } from "./chat-area";

interface MessageThreadProps {
  parent: Message;
  replies: Message[];
  currentUserId?: string | null;
  authors?: Record<string, AuthorProfile>;
  repoContext?: { owner: string; name: string };
  onReply: (messageId: string) => void;
}

export function MessageThread({
  parent,
  replies,
  currentUserId,
  authors = {},
  repoContext,
  onReply,
}: MessageThreadProps) {
  const [expanded, setExpanded] = useState(replies.length <= 3);

  function getProfile(msg: Message) {
    if (msg.authorId && authors[msg.authorId]) {
      return authors[msg.authorId];
    }
    return null;
  }

  const visibleReplies = expanded ? replies : replies.slice(-2);
  const hiddenCount = replies.length - visibleReplies.length;

  return (
    <div>
      {/* Parent message */}
      <MessageBubble
        id={parent.id}
        authorType={parent.authorType}
        authorProfile={getProfile(parent)}
        isCurrentUser={
          parent.authorType === "user" &&
          !!currentUserId &&
          parent.authorId === currentUserId
        }
        content={parent.content}
        createdAt={parent.createdAt}
        repoContext={repoContext}
        threadCount={parent.threadCount}
        onReply={onReply}
      />

      {/* Replies */}
      <div className="ml-9 mt-1 space-y-2 border-l-2 border-[var(--border-subtle)] pl-3">
        {hiddenCount > 0 && (
          <button
            onClick={() => setExpanded(true)}
            className="text-xs text-[var(--accent-blue)] hover:underline"
          >
            Show {hiddenCount} earlier {hiddenCount === 1 ? "reply" : "replies"}
          </button>
        )}
        {visibleReplies.map((reply) => (
          <MessageBubble
            key={reply.id}
            id={reply.id}
            authorType={reply.authorType}
            authorProfile={getProfile(reply)}
            isCurrentUser={
              reply.authorType === "user" &&
              !!currentUserId &&
              reply.authorId === currentUserId
            }
            content={reply.content}
            createdAt={reply.createdAt}
            repoContext={repoContext}
            onReply={() => onReply(parent.id)}
          />
        ))}
      </div>
    </div>
  );
}
