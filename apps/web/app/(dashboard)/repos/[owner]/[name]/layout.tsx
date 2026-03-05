"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";

interface RepoLayoutProps {
  children: React.ReactNode;
}

export default function RepoLayout({ children }: RepoLayoutProps) {
  const params = useParams<{ owner: string; name: string }>();
  const pathname = usePathname();

  const owner = params.owner;
  const name = params.name;
  const base = `/repos/${owner}/${name}`;

  const tabs = [
    { href: `${base}/issues`, label: "Issues" },
    { href: `${base}/pulls`, label: "Pull Requests" },
  ];

  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/dashboard"
          className="text-xs text-[var(--text-quaternary)] transition-colors hover:text-[var(--text-secondary)]"
        >
          Dashboard
        </Link>
        <span className="mx-1.5 text-xs text-[var(--text-quaternary)]">/</span>
        <span className="text-xs text-[var(--text-secondary)]">
          {owner} / {name}
        </span>
      </div>

      <h1 className="text-xl font-semibold tracking-tight text-[var(--text-primary)]">
        <span className="text-[var(--text-tertiary)]">{owner}</span>
        <span className="mx-1 text-[var(--text-quaternary)]">/</span>
        {name}
      </h1>

      <div className="flex gap-0 border-b border-[var(--border-subtle)]">
        {tabs.map((tab) => {
          const isActive = pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`relative px-4 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "text-[var(--text-primary)]"
                  : "text-[var(--text-quaternary)] hover:text-[var(--text-secondary)]"
              }`}
            >
              {tab.label}
              {isActive && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--accent-blue)]" />
              )}
            </Link>
          );
        })}
      </div>

      {children}
    </div>
  );
}
