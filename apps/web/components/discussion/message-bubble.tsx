interface MessageBubbleProps {
  authorType: "user" | "ai" | "system";
  content: string;
  createdAt?: string;
  isStreaming?: boolean;
}

export function MessageBubble({
  authorType,
  content,
  createdAt,
  isStreaming,
}: MessageBubbleProps) {
  const isAI = authorType === "ai";
  const isSystem = authorType === "system";

  if (isSystem) {
    return (
      <div className="flex justify-center">
        <div className="max-w-[90%] rounded-lg bg-amber-50 px-4 py-2 text-xs text-amber-800 border border-amber-200">
          <div className="flex items-center gap-2">
            <span className="font-medium">System</span>
            {createdAt && (
              <span className="text-amber-500">
                {new Date(createdAt).toLocaleTimeString()}
              </span>
            )}
          </div>
          <div className="mt-1 whitespace-pre-wrap">{content}</div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex ${isAI ? "justify-start" : "justify-end"}`}>
      <div
        className={`max-w-[80%] rounded-lg px-4 py-2.5 text-sm ${
          isAI
            ? "bg-slate-100 text-slate-800"
            : "bg-blue-600 text-white"
        }`}
      >
        <div className="mb-1 flex items-center gap-2">
          {isAI && (
            <span className="text-xs font-medium text-slate-500">AI</span>
          )}
          {!isAI && (
            <span className="text-xs font-medium text-blue-200">You</span>
          )}
          {createdAt && (
            <span className={`text-xs ${isAI ? "text-slate-400" : "text-blue-200"}`}>
              {new Date(createdAt).toLocaleTimeString()}
            </span>
          )}
        </div>
        <div className="whitespace-pre-wrap">{content}</div>
        {isStreaming && (
          <span className="inline-block h-4 w-1 animate-pulse bg-slate-400 ml-0.5" />
        )}
      </div>
    </div>
  );
}
