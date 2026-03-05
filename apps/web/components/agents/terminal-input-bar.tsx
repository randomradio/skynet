"use client";

import { useState, useCallback, type FormEvent, type KeyboardEvent } from "react";

interface TerminalInputBarProps {
  onSend: (input: string) => void;
  onInterrupt: () => void;
  waitingForInput: boolean;
  disabled: boolean;
}

export function TerminalInputBar({
  onSend,
  onInterrupt,
  waitingForInput,
  disabled,
}: TerminalInputBarProps) {
  const [value, setValue] = useState("");

  const handleSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      if (disabled || !value.trim()) return;
      onSend(value);
      setValue("");
    },
    [value, disabled, onSend],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (!disabled && value.trim()) {
          onSend(value);
          setValue("");
        }
      }
    },
    [value, disabled, onSend],
  );

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <div className={`flex flex-1 items-center rounded-lg border bg-[var(--bg-surface)] px-3 py-2 transition-all ${
        waitingForInput
          ? "border-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.3)]"
          : "border-[var(--border-default)]"
      }`}>
        <span className="mr-2 select-none font-mono text-xs text-[var(--text-quaternary)]">&gt;</span>
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={
            waitingForInput
              ? "Agent is waiting for input..."
              : disabled
                ? "Process not running"
                : "Type input and press Enter"
          }
          className="flex-1 bg-transparent font-mono text-xs text-[var(--text-primary)] placeholder:text-[var(--text-quaternary)] outline-none disabled:opacity-40"
        />
      </div>
      <button
        type="submit"
        disabled={disabled || !value.trim()}
        className="rounded-lg bg-[var(--accent-blue)] px-3 py-2 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-30"
      >
        Send
      </button>
      <button
        type="button"
        onClick={onInterrupt}
        disabled={disabled}
        className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-600 transition-opacity hover:bg-red-500/20 disabled:opacity-30"
        title="Send Ctrl+C"
      >
        Ctrl+C
      </button>
    </form>
  );
}
