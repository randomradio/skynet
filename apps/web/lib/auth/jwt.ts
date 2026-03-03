import { SignJWT, jwtVerify, type JWTPayload } from "jose";

const textEncoder = new TextEncoder();

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error(
      "JWT_SECRET is required. TODO: set a user-managed secret in environment variables.",
    );
  }

  return textEncoder.encode(secret);
}

export async function signAccessToken(
  payload: JWTPayload,
  expiresIn = "1h",
): Promise<string> {
  const secret = getJwtSecret();

  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(secret);
}

export async function verifyAccessToken(
  token: string,
): Promise<JWTPayload | null> {
  try {
    const secret = getJwtSecret();
    const { payload } = await jwtVerify(token, secret);
    return payload;
  } catch {
    return null;
  }
}
