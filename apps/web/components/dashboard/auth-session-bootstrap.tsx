"use client";

import { type FormEvent, useState } from "react";
import { ROUTES, type ApiErrorResponse } from "@skynet/sdk";

type UserRole = "engineer" | "pm" | "designer" | "operator";

interface TokenResponse {
  accessToken: string;
  tokenType: "Bearer";
  expiresIn: "1h";
}

interface ExampleResponse {
  data: {
    message: string;
    user: Record<string, unknown>;
  };
}

interface LogoutResponse {
  data: {
    message: string;
  };
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

function isExampleResponse(value: unknown): value is ExampleResponse {
  if (!value || typeof value !== "object") {
    return false;
  }

  const body = value as Record<string, unknown>;
  const data = body.data;
  if (!data || typeof data !== "object") {
    return false;
  }

  const fields = data as Record<string, unknown>;
  return typeof fields.message === "string" && typeof fields.user === "object";
}

function isLogoutResponse(value: unknown): value is LogoutResponse {
  if (!value || typeof value !== "object") {
    return false;
  }

  const body = value as Record<string, unknown>;
  const data = body.data;
  if (!data || typeof data !== "object") {
    return false;
  }

  const fields = data as Record<string, unknown>;
  return typeof fields.message === "string";
}

export function AuthSessionBootstrap(): React.ReactElement {
  const [sub, setSub] = useState("demo-user");
  const [username, setUsername] = useState("demo");
  const [role, setRole] = useState<UserRole>("engineer");
  const [status, setStatus] = useState("Idle");
  const [error, setError] = useState<string | null>(null);
  const [sessionStatus, setSessionStatus] = useState<string | null>(null);
  const [protectedResult, setProtectedResult] = useState<string | null>(null);
  const [logoutStatus, setLogoutStatus] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setStatus("Creating session...");
    setError(null);
    setSessionStatus(null);
    setProtectedResult(null);
    setLogoutStatus(null);

    const tokenResponse = await fetch(ROUTES.authToken, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sub, username, role }),
    });

    const tokenBody = (await tokenResponse.json().catch(() => null)) as unknown;
    if (!tokenResponse.ok) {
      setStatus("Failed");
      setError(parseApiError(tokenBody, "Failed to request access token."));
      return;
    }

    if (!isTokenResponse(tokenBody)) {
      setStatus("Failed");
      setError("Token response format is invalid.");
      return;
    }

    setSessionStatus(
      `Session cookie issued (token type ${tokenBody.tokenType}, expires ${tokenBody.expiresIn}).`,
    );
    setStatus("Calling protected API via session cookie...");

    const protectedResponse = await fetch(ROUTES.authExample, {
      credentials: "same-origin",
    });

    const protectedBody = (await protectedResponse
      .json()
      .catch(() => null)) as unknown;
    if (!protectedResponse.ok) {
      setStatus("Failed");
      setError(parseApiError(protectedBody, "Protected API request failed."));
      return;
    }

    if (!isExampleResponse(protectedBody)) {
      setStatus("Failed");
      setError("Protected API response format is invalid.");
      return;
    }

    setProtectedResult(
      `${protectedBody.data.message} (${JSON.stringify(protectedBody.data.user)})`,
    );
    setStatus("Done");
  }

  async function handleLogout(): Promise<void> {
    setStatus("Clearing session...");
    setError(null);
    setLogoutStatus(null);

    const logoutResponse = await fetch(ROUTES.authLogout, {
      method: "POST",
      credentials: "same-origin",
    });
    const logoutBody = (await logoutResponse
      .json()
      .catch(() => null)) as unknown;

    if (!logoutResponse.ok) {
      setStatus("Failed");
      setError(parseApiError(logoutBody, "Failed to clear session."));
      return;
    }

    if (!isLogoutResponse(logoutBody)) {
      setStatus("Failed");
      setError("Logout response format is invalid.");
      return;
    }

    setSessionStatus(null);
    setProtectedResult(null);
    setLogoutStatus(logoutBody.data.message);
    setStatus("Idle");
  }

  return (
    <section className="rounded-lg border bg-white p-4 shadow-sm">
      <h2 className="text-base font-semibold text-slate-900">
        Auth Session Bootstrap
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        Requests a JWT from {ROUTES.authToken}, stores it in an HTTP-only cookie,
        then calls {ROUTES.authExample}.
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
            Bootstrap Session
          </button>
        </div>
        <div className="flex items-end">
          <button
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700"
            onClick={() => {
              void handleLogout();
            }}
            type="button"
          >
            Clear Session
          </button>
        </div>
      </form>

      <dl className="mt-4 grid gap-2 text-sm">
        <div className="rounded-md bg-slate-50 px-3 py-2">
          <dt className="font-medium text-slate-700">Status</dt>
          <dd className="text-slate-600">{status}</dd>
        </div>
        {sessionStatus ? (
          <div className="rounded-md bg-slate-50 px-3 py-2">
            <dt className="font-medium text-slate-700">Session</dt>
            <dd className="break-all text-slate-600">{sessionStatus}</dd>
          </div>
        ) : null}
        {protectedResult ? (
          <div className="rounded-md bg-slate-50 px-3 py-2">
            <dt className="font-medium text-slate-700">Protected API Result</dt>
            <dd className="break-all text-slate-600">{protectedResult}</dd>
          </div>
        ) : null}
        {logoutStatus ? (
          <div className="rounded-md bg-slate-50 px-3 py-2">
            <dt className="font-medium text-slate-700">Logout</dt>
            <dd className="break-all text-slate-600">{logoutStatus}</dd>
          </div>
        ) : null}
        {error ? (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2">
            <dt className="font-medium text-red-700">Error</dt>
            <dd className="text-red-700">{error}</dd>
          </div>
        ) : null}
      </dl>
    </section>
  );
}
