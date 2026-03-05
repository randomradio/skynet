import { RichText } from "@/components/rich-text/rich-text";

export interface MessageBubbleProps {
  authorType: "user" | "ai" | "system";
  authorProfile?: { username: string; avatarUrl: string | null } | null;
  isCurrentUser?: boolean;
  content: string;
  createdAt?: string;
  isStreaming?: boolean;
  repoContext?: { owner: string; name: string };
  /** Threading */
  id?: string;
  threadCount?: number;
  onReply?: (messageId: string) => void;
}

export function MessageBubble({
  authorType,
  authorProfile,
  isCurrentUser,
  content,
  createdAt,
  isStreaming,
  repoContext,
  id,
  threadCount,
  onReply,
}: MessageBubbleProps) {
  const isAI = authorType === "ai";
  const isSystem = authorType === "system";
  const isUser = authorType === "user";

  const displayName = isAI
    ? "Skynet AI"
    : authorProfile?.username
      ? authorProfile.username
      : isCurrentUser !== false
        ? "You"
        : "User";

  const avatarUrl = authorProfile?.avatarUrl ?? null;

  if (isSystem) {
    return (
      <div className="flex justify-center">
        <div className="max-w-[90%] rounded-lg bg-amber-500/5 px-4 py-2 text-xs text-amber-400/80 border border-amber-500/10">
          <div className="flex items-center gap-2">
            <span className="font-medium text-amber-400/60">System</span>
            {createdAt && (
              <span className="text-amber-500/40">
                {new Date(createdAt).toLocaleTimeString()}
              </span>
            )}
          </div>
          <div className="mt-1">
            <RichText content={content} format="plain" repoContext={repoContext} />
          </div>
        </div>
      </div>
    );
  }

  // Determine alignment: current user right, others left
  const alignRight = isUser && isCurrentUser !== false;

  return (
    <div className={`flex ${alignRight ? "justify-end" : "justify-start"}`}>
      {/* Avatar for left-aligned messages */}
      {!alignRight && (
        <div className="mr-2 flex-shrink-0 mt-0.5">
          {avatarUrl ? (
            <img src={avatarUrl} alt={displayName} className="h-7 w-7 rounded-full" />
          ) : (
            <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
              isAI
                ? "bg-[var(--accent-purple)]/20 text-[var(--accent-purple)]"
                : "bg-[var(--accent-blue)]/20 text-[var(--accent-blue)]"
            }`}>
              {isAI ? "AI" : displayName.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
      )}

      <div className="max-w-[80%]">
        <div
          className={`rounded-lg px-4 py-2.5 text-sm ${
            alignRight
              ? "bg-gradient-to-r from-[var(--accent-blue)] to-blue-600 text-white"
              : isAI
                ? "bg-[var(--bg-elevated)] text-[var(--text-secondary)] border border-[var(--border-subtle)]"
                : "bg-[var(--bg-surface)] text-[var(--text-secondary)] border border-[var(--border-subtle)]"
          }`}
        >
          <div className="mb-1 flex items-center gap-2">
            <span className={`text-xs font-medium ${
              alignRight ? "text-blue-200" : "text-[var(--text-quaternary)]"
            }`}>
              {displayName}
            </span>
            {createdAt && (
              <span className={`text-xs ${alignRight ? "text-blue-200/60" : "text-[var(--text-quaternary)]"}`}>
                {new Date(createdAt).toLocaleTimeString()}
              </span>
            )}
          </div>
          {isAI ? (
            <RichText content={content} format="markdown" repoContext={repoContext} />
          ) : (
            <RichText content={content} format="plain" repoContext={repoContext} />
          )}
          {isStreaming && (
            <span className="inline-block h-4 w-1 animate-pulse bg-[var(--accent-blue)] ml-0.5 rounded-full" />
          )}
        </div>

        {/* Thread reply button */}
        {!isStreaming && id && onReply && (
          <div className="mt-1 flex items-center gap-2">
            <button
              onClick={() => onReply(id)}
              className="text-xs text-[var(--text-quaternary)] hover:text-[var(--accent-blue)] transition-colors"
            >
              Reply
            </button>
            {(threadCount ?? 0) > 0 && (
              <span className="text-xs text-[var(--text-quaternary)]">
                {threadCount} {threadCount === 1 ? "reply" : "replies"}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Avatar for right-aligned messages */}
      {alignRight && (
        <div className="ml-2 flex-shrink-0 mt-0.5">
          {avatarUrl ? (
            <img src={avatarUrl} alt={displayName} className="h-7 w-7 rounded-full" />
          ) : (
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--accent-blue)]/20 text-xs font-bold text-[var(--accent-blue)]">
              {displayName.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
