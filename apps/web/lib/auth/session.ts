const SESSION_COOKIE_NAME = "skynet_access_token";
const SESSION_MAX_AGE_SECONDS = 60 * 60;

interface CookieValue {
  value: string;
}

interface CookieStoreLike {
  get(name: string): CookieValue | undefined;
}

interface RequestWithCookies {
  cookies: CookieStoreLike;
}

export interface SessionCookie {
  name: string;
  value: string;
  httpOnly: true;
  sameSite: "lax";
  secure: boolean;
  path: "/";
  maxAge: number;
}

function baseSessionCookie(): Omit<SessionCookie, "value" | "maxAge"> {
  return {
    name: SESSION_COOKIE_NAME,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  };
}

export function buildSessionCookie(token: string): SessionCookie {
  return {
    ...baseSessionCookie(),
    value: token,
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}

export function buildClearedSessionCookie(): SessionCookie {
  return {
    ...baseSessionCookie(),
    value: "",
    maxAge: 0,
  };
}

export function getSessionToken(request: RequestWithCookies): string | null {
  return request.cookies.get(SESSION_COOKIE_NAME)?.value ?? null;
}
