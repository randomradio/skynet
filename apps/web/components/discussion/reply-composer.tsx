"use client";

import { useState } from "react";

interface ReplyComposerProps {
  onSubmit: (content: string) => void;
  onCancel: () => void;
  disabled?: boolean;
}

export function ReplyComposer({ onSubmit, onCancel, disabled }: ReplyComposerProps) {
  const [text, setText] = useState("");

  function handleSubmit() {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    setText("");
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === "Escape") {
      onCancel();
    }
  }

  return (
    <div className="mt-1 flex gap-2">
      <textarea
        className="flex-1 resize-none rounded-md border border-[var(--border-default)] bg-[var(--bg-secondary)] px-2 py-1.5 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-quaternary)] focus:border-[var(--accent-blue)] focus:outline-none"
        placeholder="Write a reply..."
        rows={1}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        autoFocus
      />
      <button
        onClick={handleSubmit}
        disabled={!text.trim() || disabled}
        className="rounded-md bg-[var(--accent-blue)] px-2.5 py-1 text-xs font-medium text-white disabled:opacity-40"
      >
        Reply
      </button>
      <button
        onClick={onCancel}
        className="text-xs text-[var(--text-quaternary)] hover:text-[var(--text-secondary)]"
      >
        Cancel
      </button>
    </div>
  );
}
