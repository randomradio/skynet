const PRIORITY_STYLES: Record<string, string> = {
  P0: "bg-red-500/10 text-red-600 ring-red-500/20",
  P1: "bg-orange-500/10 text-orange-600 ring-orange-500/20",
  P2: "bg-amber-500/10 text-amber-600 ring-amber-500/20",
  P3: "bg-[var(--bg-elevated)] text-[var(--text-tertiary)] ring-[var(--border-default)]",
};

export function PriorityBadge({ priority }: { priority: string | null }) {
  if (!priority) return null;
  const style = PRIORITY_STYLES[priority] ?? PRIORITY_STYLES.P3;
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${style}`}>
      {priority}
    </span>
  );
}
