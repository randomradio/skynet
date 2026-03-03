"use client";

import { useEffect, useState } from "react";
import { ActivityFeed } from "@/components/dashboard/activity-feed";

interface DashboardStats {
  openIssues: number;
  closedIssues: number;
  p0p1Issues: number;
}

interface Activity {
  id: string;
  type: string;
  title: string;
  description: string | null;
  actorType: string;
  createdAt: string;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/dashboard");
        const data = await res.json();
        setStats(data.stats ?? null);
        setActivities(data.recentActivity ?? []);
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const cards = [
    { label: "Open Issues", value: stats?.openIssues ?? 0 },
    { label: "P0/P1 Issues", value: stats?.p0p1Issues ?? 0 },
    { label: "Closed Issues", value: stats?.closedIssues ?? 0 },
  ];

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-slate-600">Overview of your development activity.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <article
            key={card.label}
            className="rounded-lg border bg-white p-4 shadow-sm"
          >
            <p className="text-sm text-slate-500">{card.label}</p>
            <p className="mt-2 text-2xl font-semibold">
              {loading ? "-" : String(card.value)}
            </p>
          </article>
        ))}
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold">Recent Activity</h2>
        {loading ? (
          <p className="text-sm text-slate-500">Loading...</p>
        ) : (
          <ActivityFeed activities={activities} />
        )}
      </div>
    </section>
  );
}
