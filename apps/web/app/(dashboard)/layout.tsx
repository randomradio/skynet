import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth/session-user";
import { LogoutButton } from "@/components/dashboard/logout-button";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const navLinks = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/repos", label: "Repos" },
  { href: "/issues", label: "Issues" },
  { href: "/agents", label: "Agents" },
];

export default async function DashboardLayout({
  children,
}: DashboardLayoutProps): Promise<React.ReactElement> {
  const cookieStore = await cookies();
  const user = await getSessionUser({ cookies: cookieStore });

  if (!user) {
    redirect("/");
  }

  const username =
    typeof user.username === "string" ? user.username : "User";

  return (
    <div className="mesh-gradient min-h-screen">
      <header className="sticky top-0 z-40 border-b border-[var(--border-subtle)] bg-[var(--bg-primary)]/85 backdrop-blur-xl">
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3.5">
          <Link href="/dashboard" className="flex items-center gap-2.5 group">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-[var(--accent-blue)] to-[var(--accent-purple)] shadow-md shadow-[var(--glow-blue)]">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
              </svg>
            </div>
            <span className="text-sm font-semibold tracking-wide text-[var(--text-primary)] group-hover:text-gradient transition-colors">
              SKYNET
            </span>
          </Link>

          <div className="flex items-center gap-0.5">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                className="rounded-md px-3.5 py-2 text-[13px] font-medium text-[var(--text-tertiary)] transition-all hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
                href={link.href}
              >
                {link.label}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-full border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-1.5">
              <div className="h-1.5 w-1.5 rounded-full bg-[var(--accent-emerald)] animate-breathe" />
              <span className="text-xs font-medium text-[var(--text-secondary)]">
                {username}
              </span>
            </div>
            <LogoutButton />
          </div>
        </nav>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-8 animate-fade-in">
        {children}
      </main>
    </div>
  );
}
