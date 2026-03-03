import crypto from "node:crypto";
import { describe, it, expect } from "vitest";
import { verifyWebhookSignature } from "./webhook-verify";

function sign(payload: string, secret: string): string {
  return "sha256=" + crypto.createHmac("sha256", secret).update(payload, "utf8").digest("hex");
}

describe("verifyWebhookSignature", () => {
  const secret = "test-secret";
  const payload = '{"action":"opened"}';

  it("returns true for valid signature", () => {
    const sig = sign(payload, secret);
    expect(verifyWebhookSignature(payload, sig, secret)).toBe(true);
  });

  it("returns false for wrong secret", () => {
    const sig = sign(payload, "wrong-secret");
    expect(verifyWebhookSignature(payload, sig, secret)).toBe(false);
  });

  it("returns false for tampered payload", () => {
    const sig = sign(payload, secret);
    expect(verifyWebhookSignature('{"action":"closed"}', sig, secret)).toBe(false);
  });

  it("returns false for empty signature", () => {
    expect(verifyWebhookSignature(payload, "", secret)).toBe(false);
  });

  it("returns false for empty secret", () => {
    expect(verifyWebhookSignature(payload, "sha256=abc", "")).toBe(false);
  });

  it("handles signature without sha256= prefix", () => {
    const raw = crypto.createHmac("sha256", secret).update(payload, "utf8").digest("hex");
    expect(verifyWebhookSignature(payload, raw, secret)).toBe(true);
  });
});
