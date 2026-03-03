const TYPE_STYLES: Record<string, string> = {
  bug: "bg-red-50 text-red-700 ring-red-200",
  feature: "bg-blue-50 text-blue-700 ring-blue-200",
  task: "bg-green-50 text-green-700 ring-green-200",
  question: "bg-purple-50 text-purple-700 ring-purple-200",
};

export function TypeBadge({ type }: { type: string | null }) {
  if (!type) return null;
  const style = TYPE_STYLES[type] ?? "bg-gray-50 text-gray-700 ring-gray-200";
  return (
    <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${style}`}>
      {type}
    </span>
  );
}
