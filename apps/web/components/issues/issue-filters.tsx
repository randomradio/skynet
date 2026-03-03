"use client";

interface IssueFiltersProps {
  state: string;
  aiType: string;
  aiPriority: string;
  onStateChange: (v: string) => void;
  onAiTypeChange: (v: string) => void;
  onAiPriorityChange: (v: string) => void;
}

export function IssueFilters({
  state,
  aiType,
  aiPriority,
  onStateChange,
  onAiTypeChange,
  onAiPriorityChange,
}: IssueFiltersProps) {
  return (
    <div className="flex flex-wrap gap-3">
      <select
        className="rounded border px-3 py-1.5 text-sm"
        value={state}
        onChange={(e) => onStateChange(e.target.value)}
      >
        <option value="">All States</option>
        <option value="open">Open</option>
        <option value="closed">Closed</option>
      </select>

      <select
        className="rounded border px-3 py-1.5 text-sm"
        value={aiType}
        onChange={(e) => onAiTypeChange(e.target.value)}
      >
        <option value="">All Types</option>
        <option value="bug">Bug</option>
        <option value="feature">Feature</option>
        <option value="task">Task</option>
        <option value="question">Question</option>
      </select>

      <select
        className="rounded border px-3 py-1.5 text-sm"
        value={aiPriority}
        onChange={(e) => onAiPriorityChange(e.target.value)}
      >
        <option value="">All Priorities</option>
        <option value="P0">P0 - Critical</option>
        <option value="P1">P1 - High</option>
        <option value="P2">P2 - Medium</option>
        <option value="P3">P3 - Low</option>
      </select>
    </div>
  );
}
