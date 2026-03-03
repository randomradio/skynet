import type { JWTPayload } from "jose";

import { signAccessToken } from "./jwt";
import { buildSessionCookie, type SessionCookie } from "./session";

export interface IssuedPlatformSession {
  accessToken: string;
  tokenType: "Bearer";
  expiresIn: "1h";
  sessionCookie: SessionCookie;
}

export async function issuePlatformSession(
  payload: JWTPayload,
): Promise<IssuedPlatformSession> {
  const accessToken = await signAccessToken(payload);

  return {
    accessToken,
    tokenType: "Bearer",
    expiresIn: "1h",
    sessionCookie: buildSessionCookie(accessToken),
  };
}
