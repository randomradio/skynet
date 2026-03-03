import { NextResponse } from "next/server";
import type { JWTPayload } from "jose";

import { withAuth } from "@/lib/auth/with-auth";

export const GET = withAuth(
  async (_request, user: JWTPayload): Promise<NextResponse> => {
    return NextResponse.json({
      data: {
        message: "Authenticated request",
        user,
      },
    });
  },
);
