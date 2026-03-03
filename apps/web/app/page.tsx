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

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-8">
      <main className="w-full max-w-3xl space-y-6">
        <section className="rounded-xl border bg-white p-8 shadow-sm">
          <h1 className="text-3xl font-semibold tracking-tight">
            Skynet Phase 1 Foundation
          </h1>
          <p className="mt-3 text-slate-600">
            Sign in below to create a cookie-backed session, then continue to
            the protected dashboard experience.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            {githubClientId ? (
              <GithubLoginButton clientId={githubClientId} />
            ) : (
              <span className="text-sm text-slate-500">
                GitHub OAuth not configured (set GITHUB_CLIENT_ID)
              </span>
            )}
            <Link
              className="rounded-md border px-4 py-2 text-sm font-medium text-slate-900"
              href="/api/health"
            >
              Health API
            </Link>
            <Link
              className="rounded-md border px-4 py-2 text-sm font-medium text-slate-900"
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
