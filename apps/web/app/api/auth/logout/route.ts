import { NextResponse } from "next/server";
import { buildClearedSessionCookie } from "@/lib/auth/session";

export async function POST(): Promise<NextResponse> {
  const response = NextResponse.json(
    { data: { message: "Session cleared" } },
    { status: 200 },
  );
  response.cookies.set(buildClearedSessionCookie());
  return response;
}
