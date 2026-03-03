import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { NextRequest, NextResponse } from "next/server";

import { signAccessToken } from "./jwt";
import { withAuth } from "./with-auth";

const originalJwtSecret = process.env.JWT_SECRET;

describe("withAuth", () => {
  beforeAll(() => {
    process.env.JWT_SECRET = "test-jwt-secret-value";
  });

  afterAll(() => {
    if (originalJwtSecret === undefined) {
      delete process.env.JWT_SECRET;
      return;
    }

    process.env.JWT_SECRET = originalJwtSecret;
  });

  const dummyParams = Promise.resolve({});
  const handler = withAuth(async (_req, user) => {
    return NextResponse.json({ sub: user.sub });
  });

  it("returns 401 when no token is provided", async () => {
    const request = new NextRequest("http://localhost/api/test");
    const response = await handler(request, { params: dummyParams });

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error.code).toBe("UNAUTHORIZED");
    expect(body.error.message).toBe("Missing authentication token");
  });

  it("returns 401 when token is invalid", async () => {
    const request = new NextRequest("http://localhost/api/test", {
      headers: { authorization: "Bearer invalid-token" },
    });
    const response = await handler(request, { params: dummyParams });

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error.code).toBe("UNAUTHORIZED");
    expect(body.error.message).toBe("Not authenticated");
  });

  it("passes verified user to handler when token is valid", async () => {
    const token = await signAccessToken({ sub: "user_42", username: "tester" });
    const request = new NextRequest("http://localhost/api/test", {
      headers: { authorization: `Bearer ${token}` },
    });
    const response = await handler(request, { params: dummyParams });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.sub).toBe("user_42");
  });
});
