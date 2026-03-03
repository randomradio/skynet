import { checkDatabaseHealth } from "@skynet/db";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(): Promise<NextResponse> {
  const database = await checkDatabaseHealth();
  const status = database.status === "down" ? "degraded" : "ok";
  const statusCode = database.status === "down" ? 503 : 200;

  return NextResponse.json(
    {
      status,
      services: {
        web: "up",
        database,
      },
      checkedAt: new Date().toISOString(),
    },
    { status: statusCode },
  );
}
