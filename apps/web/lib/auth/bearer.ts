import { AUTH_SCHEME } from "@skynet/sdk";

export function getBearerToken(authorizationHeader: string | null): string | null {
  if (!authorizationHeader) {
    return null;
  }

  const [scheme, token] = authorizationHeader.split(" ");
  if (scheme?.toLowerCase() !== AUTH_SCHEME.toLowerCase() || !token) {
    return null;
  }

  return token;
}
