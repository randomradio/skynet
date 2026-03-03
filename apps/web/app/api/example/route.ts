import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "@/lib/auth/jwt";
import { getRequestToken } from "@/lib/auth/request-token";

interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
  };
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const token = getRequestToken(request);
  if (!token) {
    const body: ApiErrorResponse = {
      error: { code: "UNAUTHORIZED", message: "Missing authentication token" },
    };
    return NextResponse.json(body, { status: 401 });
  }
  const user = token ? await verifyAccessToken(token) : null;

  if (!user) {
    const body: ApiErrorResponse = {
      error: { code: "UNAUTHORIZED", message: "Not authenticated" },
    };
    return NextResponse.json(body, { status: 401 });
  }

  return NextResponse.json({
    data: {
      message: "Authenticated request",
      user,
    },
  });
}
