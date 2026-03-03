import { NextRequest, NextResponse } from "next/server";

import { issuePlatformSession } from "@/lib/auth/platform-session";
import type { ApiErrorResponse } from "@skynet/sdk";

interface TokenRequestBody {
  sub?: string;
  username?: string;
  role?: "engineer" | "pm" | "designer" | "operator";
}

interface TokenResponse {
  accessToken: string;
  tokenType: "Bearer";
  expiresIn: "1h";
}

function badRequest(message: string): NextResponse<ApiErrorResponse> {
  return NextResponse.json(
    { error: { code: "BAD_REQUEST", message } },
    { status: 400 },
  );
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: TokenRequestBody;
  try {
    body = (await request.json()) as TokenRequestBody;
  } catch {
    return badRequest("Request body must be valid JSON");
  }

  if (!body.sub) {
    return badRequest("`sub` is required to issue a JWT");
  }

  try {
    const issuedSession = await issuePlatformSession({
      sub: body.sub,
      username: body.username,
      role: body.role,
    });

    const responseBody: TokenResponse = {
      accessToken: issuedSession.accessToken,
      tokenType: issuedSession.tokenType,
      expiresIn: issuedSession.expiresIn,
    };

    const response = NextResponse.json(responseBody, { status: 201 });
    response.cookies.set(issuedSession.sessionCookie);
    return response;
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Server JWT configuration is missing";

    const apiError: ApiErrorResponse = {
      error: {
        code: "SERVER_MISCONFIGURED",
        message,
      },
    };

    return NextResponse.json(apiError, { status: 500 });
  }
}
