const STATUS_STYLES: Record<string, { bg: string; label: string }> = {
  planning: { bg: "bg-blue-100 text-blue-800", label: "Planning" },
  coding: { bg: "bg-purple-100 text-purple-800", label: "Coding" },
  testing: { bg: "bg-yellow-100 text-yellow-800", label: "Testing" },
  review: { bg: "bg-indigo-100 text-indigo-800", label: "Review" },
  completed: { bg: "bg-green-100 text-green-800", label: "Completed" },
  failed: { bg: "bg-red-100 text-red-800", label: "Failed" },
  cancelled: { bg: "bg-gray-100 text-gray-600", label: "Cancelled" },
};

export function AgentStatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? { bg: "bg-gray-100 text-gray-700", label: status };
  const isActive = status === "planning" || status === "coding" || status === "testing";

  return (
    <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium ${style.bg}`}>
      {isActive && (
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-current" />
        </span>
      )}
      {style.label}
    </span>
  );
}
