const STATUS_STYLES: Record<string, { bg: string; label: string }> = {
  planning: { bg: "bg-[var(--accent-blue)]/10 text-[var(--accent-blue)]", label: "Planning" },
  coding: { bg: "bg-purple-500/10 text-purple-400", label: "Coding" },
  testing: { bg: "bg-amber-500/10 text-amber-400", label: "Testing" },
  review: { bg: "bg-indigo-500/10 text-indigo-400", label: "Review" },
  completed: { bg: "bg-emerald-500/10 text-emerald-400", label: "Completed" },
  failed: { bg: "bg-red-500/10 text-red-400", label: "Failed" },
  waiting_for_input: { bg: "bg-orange-500/10 text-orange-400", label: "Waiting for Input" },
  paused: { bg: "bg-yellow-500/10 text-yellow-400", label: "Paused" },
  cancelled: { bg: "bg-[var(--bg-elevated)] text-[var(--text-quaternary)]", label: "Cancelled" },
};

export function AgentStatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? { bg: "bg-[var(--bg-elevated)] text-[var(--text-quaternary)]", label: status };
  const isActive = status === "planning" || status === "coding" || status === "testing" || status === "waiting_for_input";

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-medium ${style.bg}`}>
      {isActive && (
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" />
        </span>
      )}
      {style.label}
    </span>
  );
}
