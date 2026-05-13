import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import InboxSyncState from "@/lib/models/inbox-sync-state";
import { syncThreadMessages } from "@/lib/inbox-sync";

function authorized(req: NextRequest): boolean {
  const expected = (process.env.INBOX_WEBHOOK_SECRET || "").trim();
  if (!expected) return true; // no secret configured -> allow (dev mode)
  const provided = req.headers.get("x-smartlead-secret")
    || req.headers.get("authorization")?.replace(/^Bearer\s+/i, "")
    || req.nextUrl.searchParams.get("secret")
    || "";
  return provided === expected;
}

type WebhookEvent = {
  event_type?: string;
  campaign_id?: number | string;
  lead_id?: number | string;
  // Allow Smartlead-shape variants:
  campaignId?: number | string;
  leadId?: number | string;
  data?: { campaign_id?: number | string; lead_id?: number | string };
};

function extractIds(e: WebhookEvent): { campaignId: number | null; leadId: number | null } {
  const c = e.campaign_id ?? e.campaignId ?? e.data?.campaign_id ?? null;
  const l = e.lead_id ?? e.leadId ?? e.data?.lead_id ?? null;
  const campaignId = c != null ? Number(c) : null;
  const leadId = l != null ? Number(l) : null;
  return {
    campaignId: Number.isFinite(campaignId as number) ? (campaignId as number) : null,
    leadId: Number.isFinite(leadId as number) ? (leadId as number) : null,
  };
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) {
    console.warn("[smartlead-webhook] rejected: secret mismatch");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try { body = await req.json(); } catch { body = null; }
  console.log("[smartlead-webhook] received:", JSON.stringify(body).slice(0, 500));

  // Normalize to an array of events. Smartlead may send a single event object
  // or { events: [...] } or an array directly.
  const events: WebhookEvent[] = Array.isArray(body)
    ? body as WebhookEvent[]
    : (body && typeof body === "object" && Array.isArray((body as { events?: unknown }).events))
      ? ((body as { events: WebhookEvent[] }).events)
      : body
        ? [body as WebhookEvent]
        : [];

  if (events.length === 0) return NextResponse.json({ ok: true, processed: 0 });

  await connectDB();

  // Refresh each thread that has a recognizable campaign+lead. Do it in
  // parallel-but-bounded so a burst of events doesn't blow rate budgets.
  const targets = new Set<string>();
  for (const e of events) {
    const { campaignId, leadId } = extractIds(e);
    if (campaignId == null || leadId == null) continue;
    targets.add(`${leadId}:${campaignId}`);
  }

  const results = await Promise.all(Array.from(targets).slice(0, 50).map(async (key) => {
    const [leadId, campaignId] = key.split(":").map(Number);
    try {
      return await syncThreadMessages(leadId, campaignId);
    } catch (e) {
      return { messages: 0, error: e instanceof Error ? e.message : "sync failed" };
    }
  }));

  // Bump lastSyncedAt so the inbox UI's "syncing/stale" indicator stays fresh.
  await InboxSyncState.updateOne(
    { key: "global" },
    { $set: { lastSyncedAt: new Date() } },
    { upsert: true },
  );

  const targetList = Array.from(targets);
  const detailed = results.map((r, i) => ({ key: targetList[i], messages: r.messages, error: r.error }));
  console.log("[smartlead-webhook] processed:", targets.size, "results:", JSON.stringify(detailed).slice(0, 500));

  return NextResponse.json({
    ok: true,
    processed: targets.size,
    results: detailed,
  });
}

export async function GET() {
  // Smartlead pings GET to verify the URL is reachable when you save the webhook.
  return NextResponse.json({ ok: true, hint: "POST events here to trigger live sync." });
}
