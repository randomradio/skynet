import { getBearerToken } from "./bearer";
import { getSessionToken } from "./session";

interface HeadersLike {
  get(name: string): string | null;
}

interface RequestWithAuthSources {
  headers: HeadersLike;
  cookies: {
    get(name: string): { value: string } | undefined;
  };
}

export function getRequestToken(request: RequestWithAuthSources): string | null {
  const bearerToken = getBearerToken(request.headers.get("authorization"));
  if (bearerToken) {
    return bearerToken;
  }

  return getSessionToken(request);
}
