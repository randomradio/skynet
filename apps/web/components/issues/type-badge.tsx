const TYPE_STYLES: Record<string, string> = {
  bug: "bg-red-500/10 text-red-600 ring-red-500/20",
  feature: "bg-[var(--accent-blue)]/10 text-[var(--accent-blue)] ring-[var(--accent-blue)]/20",
  task: "bg-emerald-500/10 text-emerald-700 ring-emerald-500/20",
  question: "bg-purple-500/10 text-purple-700 ring-purple-500/20",
};

export function TypeBadge({ type }: { type: string | null }) {
  if (!type) return null;
  const style = TYPE_STYLES[type] ?? "bg-[var(--bg-elevated)] text-[var(--text-tertiary)] ring-[var(--border-default)]";
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${style}`}>
      {type}
    </span>
  );
}
