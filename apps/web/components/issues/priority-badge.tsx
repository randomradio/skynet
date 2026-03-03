const PRIORITY_STYLES: Record<string, string> = {
  P0: "bg-red-100 text-red-800",
  P1: "bg-orange-100 text-orange-800",
  P2: "bg-amber-100 text-amber-800",
  P3: "bg-gray-100 text-gray-700",
};

export function PriorityBadge({ priority }: { priority: string | null }) {
  if (!priority) return null;
  const style = PRIORITY_STYLES[priority] ?? "bg-gray-100 text-gray-700";
  return (
    <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${style}`}>
      {priority}
    </span>
  );
}
