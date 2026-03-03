"use client";

interface Activity {
  id: string;
  type: string;
  title: string;
  description: string | null;
  actorType: string;
  createdAt: string;
}

const TYPE_ICONS: Record<string, string> = {
  issue_created: "+",
  issue_updated: "~",
  issue_closed: "x",
  agent_started: ">",
  agent_completed: "v",
  pr_created: "PR",
};

interface ActivityFeedProps {
  activities: Activity[];
}

export function ActivityFeed({ activities }: ActivityFeedProps) {
  if (activities.length === 0) {
    return (
      <p className="text-sm text-slate-500">No recent activity.</p>
    );
  }

  return (
    <div className="space-y-2">
      {activities.map((a) => (
        <div key={a.id} className="flex items-start gap-3 rounded border bg-white p-3 text-sm shadow-sm">
          <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded bg-slate-100 text-xs font-medium text-slate-600">
            {TYPE_ICONS[a.type] ?? "?"}
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-medium text-slate-900">{a.title}</p>
            {a.description && (
              <p className="text-xs text-slate-500 line-clamp-1">{a.description}</p>
            )}
          </div>
          <span className="flex-shrink-0 text-xs text-slate-400">
            {timeAgo(a.createdAt)}
          </span>
        </div>
      ))}
    </div>
  );
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
