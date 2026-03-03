import { NextRequest, NextResponse } from "next/server";

import { verifyWebhookSignature } from "@/lib/github/webhook-verify";
import { syncIssueFromWebhook } from "@/lib/github/sync-issue";
import { syncPRFromWebhook } from "@/lib/github/sync-pr";
import { insertWebhookEvent, findWebhookEventById, markWebhookEventProcessed } from "@skynet/db";

export const runtime = "nodejs";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });
  }

  const body = await request.text();
  const signature = request.headers.get("x-hub-signature-256") ?? "";

  if (!verifyWebhookSignature(body, signature, secret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const event = request.headers.get("x-github-event") ?? "unknown";
  const deliveryId = request.headers.get("x-github-delivery") ?? crypto.randomUUID();

  // Deduplication
  const existing = await findWebhookEventById(deliveryId).catch(() => null);
  if (existing) {
    return NextResponse.json({ status: "duplicate", id: deliveryId });
  }

  // Always store the event
  await insertWebhookEvent({
    id: deliveryId,
    source: "github",
    eventType: event,
    payload: JSON.parse(body),
  }).catch(() => {});

  // Process issue events
  if (event === "issues") {
    const payload = JSON.parse(body);
    const action = payload.action;
    const handled = ["opened", "edited", "closed", "reopened"];

    if (handled.includes(action)) {
      try {
        await syncIssueFromWebhook(payload);
        await markWebhookEventProcessed(deliveryId).catch(() => {});
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        await markWebhookEventProcessed(deliveryId, message).catch(() => {});
      }
    }
  }

  // Process pull request events
  if (event === "pull_request") {
    const payload = JSON.parse(body);
    const action = payload.action;
    const handled = ["opened", "synchronize", "edited", "closed"];

    if (handled.includes(action)) {
      try {
        await syncPRFromWebhook(payload);
        await markWebhookEventProcessed(deliveryId).catch(() => {});
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        await markWebhookEventProcessed(deliveryId, message).catch(() => {});
      }
    }
  }

  // Always return 200 to avoid GitHub retries
  return NextResponse.json({ status: "ok", event, id: deliveryId });
}
