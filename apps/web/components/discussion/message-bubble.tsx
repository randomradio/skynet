interface MessageBubbleProps {
  authorType: "user" | "ai";
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
