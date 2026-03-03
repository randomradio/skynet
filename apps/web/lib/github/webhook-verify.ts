import crypto from "node:crypto";

export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string,
): boolean {
  if (!signature || !secret) return false;

  const sig = signature.startsWith("sha256=") ? signature.slice(7) : signature;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(payload, "utf8")
    .digest("hex");

  if (sig.length !== expected.length) return false;

  return crypto.timingSafeEqual(
    Buffer.from(sig, "hex"),
    Buffer.from(expected, "hex"),
  );
}
