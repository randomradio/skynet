"use client";

import { useEffect, useRef } from "react";

interface LogEntry {
  timestamp: string;
  level: "info" | "warn" | "error";
  message: string;
  metadata?: Record<string, unknown>;
}

const LEVEL_STYLES: Record<string, string> = {
  info: "text-[var(--text-tertiary)]",
  warn: "text-amber-600",
  error: "text-red-600",
};

export function AgentLogViewer({ logs }: { logs: LogEntry[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs.length]);

  if (logs.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-6 text-center text-sm text-[var(--text-quaternary)]">
        No logs yet
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      className="max-h-96 overflow-y-auto rounded-xl border border-[var(--border-default)] bg-[var(--bg-root)] p-4 font-mono text-xs"
    >
      {logs.map((log, i) => {
        const time = new Date(log.timestamp).toLocaleTimeString();
        const levelStyle = LEVEL_STYLES[log.level] ?? "text-[var(--text-quaternary)]";
        return (
          <div key={i} className="mb-1 flex gap-2">
            <span className="shrink-0 text-[var(--text-quaternary)]">{time}</span>
            <span className={`shrink-0 w-14 ${levelStyle}`}>
              [{log.level.toUpperCase()}]
            </span>
            <span className="text-[var(--text-tertiary)]">{log.message}</span>
          </div>
        );
      })}
    </div>
  );
}
