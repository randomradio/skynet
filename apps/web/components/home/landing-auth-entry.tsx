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

  return (
    <section className="rounded-lg border bg-white p-6 shadow-sm">
      <h2 className="text-base font-semibold text-slate-900">
        Authenticate To Continue
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        Bootstrap a cookie-backed session via <code>{ROUTES.authToken}</code>{" "}
        and redirect to the protected dashboard.
      </p>
      <p className="mt-1 text-xs text-slate-500">
        Requires user-provided <code>JWT_SECRET</code> in environment.
      </p>

      <form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={handleSubmit}>
        <label className="text-sm text-slate-700">
          Subject (sub)
          <input
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
            onChange={(event) => setSub(event.target.value)}
            required
            value={sub}
          />
        </label>
        <label className="text-sm text-slate-700">
          Username
          <input
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
            onChange={(event) => setUsername(event.target.value)}
            value={username}
          />
        </label>
        <label className="text-sm text-slate-700">
          Role
          <select
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
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
            className="w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white"
            type="submit"
          >
            Sign In To Dashboard
          </button>
        </div>
      </form>

      <div className="mt-4 rounded-md bg-slate-50 px-3 py-2 text-sm">
        <p className="font-medium text-slate-700">Status</p>
        <p className="text-slate-600">{status}</p>
      </div>

      {error ? (
        <div className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm">
          <p className="font-medium text-red-700">Error</p>
          <p className="text-red-700">{error}</p>
        </div>
      ) : null}
    </section>
  );
}
