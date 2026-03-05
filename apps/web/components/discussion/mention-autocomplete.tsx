"use client";

import { useMemo } from "react";

interface Participant {
  githubId: number;
  username: string;
  avatarUrl: string | null;
}

interface MentionAutocompleteProps {
  query: string;
  participants: Participant[];
  onSelect: (username: string) => void;
  onClose: () => void;
}

const BUILT_IN_MENTIONS = [
  { username: "ai", label: "Skynet AI", avatarUrl: null },
];

export function MentionAutocomplete({
  query,
  participants,
  onSelect,
  onClose,
}: MentionAutocompleteProps) {
  const suggestions = useMemo(() => {
    const q = query.toLowerCase();
    const userSuggestions = participants
      .filter((p) => p.username.toLowerCase().includes(q))
      .map((p) => ({ username: p.username, label: p.username, avatarUrl: p.avatarUrl }));

    const builtIn = BUILT_IN_MENTIONS.filter((b) =>
      b.username.toLowerCase().includes(q),
    );

    return [...builtIn, ...userSuggestions].slice(0, 6);
  }, [query, participants]);

  if (suggestions.length === 0) return null;

  return (
    <div className="absolute bottom-full left-4 right-4 mb-1 overflow-hidden rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] shadow-lg">
      {suggestions.map((s) => (
        <button
          key={s.username}
          onClick={() => onSelect(s.username)}
          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-[var(--bg-hover)]"
        >
          {s.avatarUrl ? (
            <img src={s.avatarUrl} alt={s.username} className="h-5 w-5 rounded-full" />
          ) : (
            <div className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
              s.username === "ai"
                ? "bg-[var(--accent-purple)]/20 text-[var(--accent-purple)]"
                : "bg-[var(--accent-blue)]/20 text-[var(--accent-blue)]"
            }`}>
              {s.username.charAt(0).toUpperCase()}
            </div>
          )}
          <span className="text-[var(--text-primary)]">@{s.username}</span>
          {s.label !== s.username && (
            <span className="text-xs text-[var(--text-quaternary)]">{s.label}</span>
          )}
        </button>
      ))}
    </div>
  );
}
