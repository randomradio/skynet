import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { signAccessToken, verifyAccessToken } from "./jwt";

const originalJwtSecret = process.env.JWT_SECRET;

describe("jwt helpers", () => {
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

  it("signs and verifies an access token", async () => {
    const token = await signAccessToken({
      sub: "user_123",
      username: "momo",
      role: "engineer",
    });

    const payload = await verifyAccessToken(token);
    expect(payload).not.toBeNull();
    expect(payload?.sub).toBe("user_123");
    expect(payload?.username).toBe("momo");
  });

  it("returns null for malformed token", async () => {
    const payload = await verifyAccessToken("not-a-jwt");
    expect(payload).toBeNull();
  });
});
