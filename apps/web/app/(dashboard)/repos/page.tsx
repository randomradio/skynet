"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Repository {
  id: string;
  owner: string;
  name: string;
  description: string | null;
  isPrivate: boolean;
  lastSyncedAt: string | null;
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "never";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function ReposPage() {
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/dashboard");
        const data = await res.json();
        setRepositories(data.repositories ?? []);
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-[var(--text-primary)]">
          Repositories
        </h1>
        <p className="mt-0.5 text-xs text-[var(--text-quaternary)]">
          GitHub repositories synced with Skynet.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-[var(--text-quaternary)]">Loading...</p>
      ) : repositories.length === 0 ? (
        <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-8 text-center">
          <p className="text-sm text-[var(--text-tertiary)]">
            No repositories synced yet.
          </p>
          <p className="mt-1 text-xs text-[var(--text-quaternary)]">
            Configure a GitHub repository webhook to start syncing.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {repositories.map((repo) => (
            <Link
              key={repo.id}
              href={`/repos/${repo.owner}/${repo.name}/issues`}
              className="card-glow rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 transition-all hover:border-[var(--border-bright)]"
            >
              <p className="text-sm font-semibold text-[var(--text-primary)]">
                <span className="text-[var(--text-tertiary)]">{repo.owner}</span>
                <span className="mx-0.5 text-[var(--text-quaternary)]">/</span>
                {repo.name}
              </p>
              {repo.description && (
                <p className="mt-1 text-xs text-[var(--text-quaternary)] line-clamp-2">
                  {repo.description}
                </p>
              )}
              <p className="mt-2 text-xs text-[var(--text-quaternary)]">
                Synced {timeAgo(repo.lastSyncedAt)}
              </p>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
