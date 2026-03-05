import { NextRequest, NextResponse } from "next/server";
import { searchUsers } from "@skynet/db";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q") ?? "";
  if (q.length < 1) {
    return NextResponse.json({ users: [] });
  }

  const users = await searchUsers(q, 10);
  return NextResponse.json({ users });
}
