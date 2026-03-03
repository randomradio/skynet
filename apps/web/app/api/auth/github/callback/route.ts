import { NextRequest, NextResponse } from "next/server";

import {
  exchangeGithubCodeForAccessToken,
  fetchGithubUserProfile,
  GithubOAuthError,
} from "@/lib/auth/github-oauth";
import { issuePlatformSession } from "@/lib/auth/platform-session";
import { upsertUser } from "@skynet/db";
import type { ApiErrorResponse } from "@skynet/sdk";

export const runtime = "nodejs";

function errorResponse(
  status: number,
  code: string,
  message: string,
): NextResponse<ApiErrorResponse> {
  return NextResponse.json(
    { error: { code, message } },
    {
      status,
    },
  );
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const githubAuthError = request.nextUrl.searchParams.get("error");
  if (githubAuthError) {
    const description =
      request.nextUrl.searchParams.get("error_description") ??
      "GitHub OAuth authorization was rejected.";
    return errorResponse(400, "GITHUB_OAUTH_DENIED", description);
  }

  const code = request.nextUrl.searchParams.get("code");
  if (!code) {
    return errorResponse(400, "BAD_REQUEST", "`code` query parameter is required.");
  }

  try {
    const githubAccessToken = await exchangeGithubCodeForAccessToken(code);
    const githubUser = await fetchGithubUserProfile(githubAccessToken);

    // Persist or update the user in the database (fire-and-forget if DB not configured)
    upsertUser({
      githubId: githubUser.id,
      username: githubUser.login,
      avatarUrl: githubUser.avatarUrl,
    }).catch(() => {
      // Silently ignore DB errors — login should still succeed
    });

    const platformSub = `github:${githubUser.id}`;
    const issuedSession = await issuePlatformSession({
      sub: platformSub,
      username: githubUser.login,
      role: "engineer",
      provider: "github",
      githubId: githubUser.id,
    });

    const response = NextResponse.redirect(new URL("/dashboard", request.url));
    response.cookies.set(issuedSession.sessionCookie);

    return response;
  } catch (error) {
    if (error instanceof GithubOAuthError) {
      return errorResponse(error.status, error.code, error.message);
    }

    const message =
      error instanceof Error ? error.message : "GitHub OAuth callback failed.";

    return errorResponse(500, "SERVER_MISCONFIGURED", message);
  }
}
