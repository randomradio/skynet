import type { JWTPayload } from "jose";

import { verifyAccessToken } from "./jwt";
import { getSessionToken } from "./session";

interface CookieValue {
  value: string;
}

interface CookieStoreLike {
  get(name: string): CookieValue | undefined;
}

interface SessionRequestLike {
  cookies: CookieStoreLike;
}

export async function getSessionUser(
  request: SessionRequestLike,
): Promise<JWTPayload | null> {
  const token = getSessionToken(request);
  if (!token) {
    return null;
  }

  return verifyAccessToken(token);
}
