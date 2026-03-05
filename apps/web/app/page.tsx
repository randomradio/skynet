import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { GithubLoginButton } from "@/components/home/github-login-button";
import { LandingAuthEntry } from "@/components/home/landing-auth-entry";
import { getSessionUser } from "@/lib/auth/session-user";

export default async function Home(): Promise<React.ReactElement> {
  const cookieStore = await cookies();
  const user = await getSessionUser({ cookies: cookieStore });

  if (user) {
    redirect("/dashboard");
  }

  const githubClientId = process.env.GITHUB_CLIENT_ID;
  const appUrl = process.env.APP_URL;

  return (
    <div className="mesh-gradient flex min-h-screen items-center justify-center p-8">
      {/* Ambient glow */}
      <div className="pointer-events-none fixed left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2 h-[400px] w-[500px] rounded-full bg-[var(--accent-blue)] opacity-[0.04] blur-[100px]" />

      <main className="relative w-full max-w-md space-y-6 animate-fade-in">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--accent-blue)] to-[var(--accent-purple)] shadow-lg shadow-[var(--glow-blue)]">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold tracking-wide text-gradient">
            SKYNET
          </h1>
        </div>

        {/* Main card */}
        <section className="glass rounded-2xl p-8">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">
            Welcome back
          </h2>
          <p className="mt-2 text-sm text-[var(--text-tertiary)] leading-relaxed">
            Sign in to access your AI-native development platform.
          </p>

          <div className="mt-7 space-y-3">
            {githubClientId ? (
              <GithubLoginButton clientId={githubClientId} appUrl={appUrl} />
            ) : (
              <p className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-4 py-3 text-xs text-[var(--text-quaternary)]">
                GitHub OAuth not configured — set GITHUB_CLIENT_ID
              </p>
            )}
          </div>

          <div className="mt-7 flex items-center gap-3">
            <div className="h-px flex-1 bg-[var(--border-default)]" />
            <span className="text-xs font-medium uppercase tracking-widest text-[var(--text-quaternary)]">
              or
            </span>
            <div className="h-px flex-1 bg-[var(--border-default)]" />
          </div>

          <div className="mt-6 flex gap-3">
            <Link
              className="flex-1 rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-4 py-2.5 text-center text-xs font-medium text-[var(--text-secondary)] transition-all hover:border-[var(--border-bright)] hover:bg-[var(--bg-hover)]"
              href="/api/health"
            >
              Health API
            </Link>
            <Link
              className="flex-1 rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-4 py-2.5 text-center text-xs font-medium text-[var(--text-secondary)] transition-all hover:border-[var(--border-bright)] hover:bg-[var(--bg-hover)]"
              href="/api/example"
            >
              Auth API
            </Link>
          </div>
        </section>

        <LandingAuthEntry />
      </main>
    </div>
  );
}
