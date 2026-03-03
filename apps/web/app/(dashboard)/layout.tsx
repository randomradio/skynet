import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth/session-user";
import { LogoutButton } from "@/components/dashboard/logout-button";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

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
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <span className="text-lg font-semibold">Skynet</span>
          <div className="flex items-center gap-4 text-sm">
            <Link className="hover:underline" href="/">
              Home
            </Link>
            <Link className="hover:underline" href="/dashboard">
              Dashboard
            </Link>
            <Link className="hover:underline" href="/issues">
              Issues
            </Link>
            <Link className="hover:underline" href="/repositories">
              Repositories
            </Link>
            <Link className="hover:underline" href="/agents">
              Agents
            </Link>
            <span className="text-slate-600">{username}</span>
            <LogoutButton />
          </div>
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
