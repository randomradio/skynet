"use client";

import { useEffect, useRef } from "react";

// Strip ANSI escape sequences for display
function stripAnsi(text: string): string {
  return text.replace(
    // eslint-disable-next-line no-control-regex
    /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nq-uy=><~]/g,
    "",
  );
}

interface InteractiveTerminalProps {
  output: string;
  isStreaming: boolean;
}

export function InteractiveTerminal({
  output,
  isStreaming,
}: InteractiveTerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const shouldAutoScroll = useRef(true);

  // Auto-scroll to bottom when new output arrives
  useEffect(() => {
    const el = containerRef.current;
    if (el && shouldAutoScroll.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [output]);

  // Track if user has scrolled up
  const handleScroll = () => {
    const el = containerRef.current;
    if (!el) return;
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    shouldAutoScroll.current = isAtBottom;
  };

  const cleanOutput = stripAnsi(output);

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="min-h-[300px] max-h-[600px] overflow-auto rounded-xl border border-[var(--border-default)] bg-[var(--bg-elevated)] p-5 font-mono text-[13px] leading-relaxed text-[var(--text-secondary)]"
    >
      {cleanOutput ? (
        <pre className="whitespace-pre-wrap break-words">{cleanOutput}</pre>
      ) : (
        <span className="text-[var(--text-quaternary)]">Waiting for output...</span>
      )}
      {isStreaming && (
        <span className="inline-block h-4 w-1.5 animate-pulse bg-[var(--text-tertiary)]" />
      )}
    </div>
  );
}
