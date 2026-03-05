const STATE_STYLES: Record<string, { bg: string; label: string }> = {
  open: { bg: "bg-emerald-500/10 text-emerald-600", label: "Open" },
  closed: { bg: "bg-[var(--bg-elevated)] text-[var(--text-quaternary)]", label: "Closed" },
  merged: { bg: "bg-purple-500/10 text-purple-700", label: "Merged" },
};

export function PrStateBadge({ state }: { state: string }) {
  const style = STATE_STYLES[state] ?? {
    bg: "bg-[var(--bg-elevated)] text-[var(--text-quaternary)]",
    label: state,
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium ${style.bg}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          state === "open"
            ? "bg-emerald-400"
            : state === "merged"
              ? "bg-purple-400"
              : "bg-[var(--text-quaternary)]"
        }`}
      />
      {style.label}
    </span>
  );
}
