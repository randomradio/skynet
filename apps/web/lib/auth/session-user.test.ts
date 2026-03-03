import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { signAccessToken } from "./jwt";
import { getSessionUser } from "./session-user";

const originalJwtSecret = process.env.JWT_SECRET;

describe("getSessionUser", () => {
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

  it("returns verified payload when session cookie contains a valid token", async () => {
    const token = await signAccessToken({
      sub: "user_456",
      username: "dashboard-user",
      role: "engineer",
    });

    const user = await getSessionUser({
      cookies: {
        get(name: string) {
          return name === "skynet_access_token" ? { value: token } : undefined;
        },
      },
    });

    expect(user).not.toBeNull();
    expect(user?.sub).toBe("user_456");
    expect(user?.username).toBe("dashboard-user");
  });

  it("returns null when session cookie is missing", async () => {
    const user = await getSessionUser({
      cookies: {
        get() {
          return undefined;
        },
      },
    });

    expect(user).toBeNull();
  });

  it("returns null when session token is invalid", async () => {
    const user = await getSessionUser({
      cookies: {
        get(name: string) {
          return name === "skynet_access_token"
            ? { value: "not-a-valid-token" }
            : undefined;
        },
      },
    });

    expect(user).toBeNull();
  });
});
