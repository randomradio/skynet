import { NextRequest, NextResponse } from "next/server";
import type { JWTPayload } from "jose";

import { getRequestToken } from "./request-token";
import { verifyAccessToken } from "./jwt";
import type { ApiErrorResponse } from "@skynet/sdk";

export type AuthenticatedHandler = (
  request: NextRequest,
  user: JWTPayload,
  context: { params: Promise<Record<string, string>> },
) => Promise<NextResponse>;

export function withAuth(handler: AuthenticatedHandler) {
  return async (
    request: NextRequest,
    context: { params: Promise<Record<string, string>> },
  ): Promise<NextResponse> => {
    const token = getRequestToken(request);
    if (!token) {
      const body: ApiErrorResponse = {
        error: { code: "UNAUTHORIZED", message: "Missing authentication token" },
      };
      return NextResponse.json(body, { status: 401 });
    }

    const user = await verifyAccessToken(token);
    if (!user) {
      const body: ApiErrorResponse = {
        error: { code: "UNAUTHORIZED", message: "Not authenticated" },
      };
      return NextResponse.json(body, { status: 401 });
    }

    return handler(request, user, context);
  };
}
