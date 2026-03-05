"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ROUTES, type ApiErrorResponse } from "@skynet/sdk";

type UserRole = "engineer" | "pm" | "designer" | "operator";

interface TokenResponse {
  accessToken: string;
  tokenType: "Bearer";
  expiresIn: "1h";
}

function isApiErrorResponse(value: unknown): value is ApiErrorResponse {
  if (!value || typeof value !== "object") {
    return false;
  }

  const root = value as Record<string, unknown>;
  const error = root.error;
  if (!error || typeof error !== "object") {
    return false;
  }

  const fields = error as Record<string, unknown>;
  return typeof fields.code === "string" && typeof fields.message === "string";
}

function parseApiError(value: unknown, fallback: string): string {
  return isApiErrorResponse(value) ? value.error.message : fallback;
}

function isTokenResponse(value: unknown): value is TokenResponse {
  if (!value || typeof value !== "object") {
    return false;
  }

  const body = value as Record<string, unknown>;
  return (
    typeof body.accessToken === "string" &&
    body.tokenType === "Bearer" &&
    body.expiresIn === "1h"
  );
}

export function LandingAuthEntry(): React.ReactElement {
  const router = useRouter();
  const [sub, setSub] = useState("demo-user");
  const [username, setUsername] = useState("demo");
  const [role, setRole] = useState<UserRole>("engineer");
  const [status, setStatus] = useState("Idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setStatus("Creating session...");
    setError(null);

    const response = await fetch(ROUTES.authToken, {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ sub, username, role }),
    });
    const body = (await response.json().catch(() => null)) as unknown;

    if (!response.ok) {
      setStatus("Failed");
      setError(parseApiError(body, "Failed to create authenticated session."));
      return;
    }

    if (!isTokenResponse(body)) {
      setStatus("Failed");
      setError("Token response format is invalid.");
      return;
    }

    setStatus("Session created. Redirecting...");
    router.push("/dashboard");
    router.refresh();
  }

  const inputClasses =
    "mt-1.5 w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-quaternary)] transition-all focus:border-[var(--accent-blue)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-blue)]/30";

  return (
    <section className="glass rounded-2xl p-6">
      <h2 className="text-sm font-semibold text-[var(--text-primary)]">
        Quick Access
      </h2>
      <p className="mt-1 text-xs text-[var(--text-quaternary)] leading-relaxed">
        Bootstrap a session via{" "}
        <code className="rounded bg-[var(--bg-secondary)] px-1.5 py-0.5 font-mono text-xs text-[var(--accent-blue)]">
          {ROUTES.authToken}
        </code>
      </p>

      <form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={handleSubmit}>
        <label className="text-xs font-medium text-[var(--text-tertiary)]">
          Subject (sub)
          <input
            className={inputClasses}
            onChange={(event) => setSub(event.target.value)}
            required
            value={sub}
          />
        </label>
        <label className="text-xs font-medium text-[var(--text-tertiary)]">
          Username
          <input
            className={inputClasses}
            onChange={(event) => setUsername(event.target.value)}
            value={username}
          />
        </label>
        <label className="text-xs font-medium text-[var(--text-tertiary)]">
          Role
          <select
            className={inputClasses}
            onChange={(event) => setRole(event.target.value as UserRole)}
            value={role}
          >
            <option value="engineer">engineer</option>
            <option value="pm">pm</option>
            <option value="designer">designer</option>
            <option value="operator">operator</option>
          </select>
        </label>
        <div className="flex items-end">
          <button
            className="w-full rounded-lg bg-gradient-to-r from-[var(--accent-blue)] to-[var(--accent-purple)] px-4 py-2 text-sm font-medium text-white transition-all hover:shadow-lg hover:shadow-[var(--glow-blue)]"
            type="submit"
          >
            Sign In
          </button>
        </div>
      </form>

      <div className="mt-4 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-subtle)] px-3 py-2">
        <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-quaternary)]">
          Status
        </p>
        <p className="text-xs text-[var(--text-secondary)]">{status}</p>
      </div>

      {error ? (
        <div className="mt-2 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2">
          <p className="text-xs font-medium text-red-400">Error</p>
          <p className="text-xs text-red-300">{error}</p>
        </div>
      ) : null}
    </section>
  );
}
