import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { verifyAccessToken } from "./jwt";
import { issuePlatformSession } from "./platform-session";

const originalJwtSecret = process.env.JWT_SECRET;

describe("issuePlatformSession", () => {
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

  it("issues Bearer token metadata and session cookie", async () => {
    const issued = await issuePlatformSession({
      sub: "github:123",
      username: "octocat",
      role: "engineer",
    });

    expect(issued.tokenType).toBe("Bearer");
    expect(issued.expiresIn).toBe("1h");
    expect(issued.sessionCookie.value).toBe(issued.accessToken);

    const payload = await verifyAccessToken(issued.accessToken);
    expect(payload?.sub).toBe("github:123");
    expect(payload?.username).toBe("octocat");
  });
});
