import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import InboxSyncState from "@/lib/models/inbox-sync-state";
import InboxThread from "@/lib/models/inbox-thread";
import InboxMessage from "@/lib/models/inbox-message";
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
  campaignId?: number | string;
  leadId?: number | string;
  data?: Record<string, unknown>;
  // Inline reply fields seen on EMAIL_REPLY events:
  reply_message?: { message_id?: string; subject?: string; html?: string; text?: string; time?: string };
  email_body?: string;
  email_subject?: string;
  reply_time?: string;
  time_replied?: string;
  from?: string;
  lead_email?: string;
};

function parseDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function previewText(html: string, max = 240): string {
  return html.replace(/<[^>]+>/g, " ").replace(/&nbsp;|&#160;/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

async function persistInlineReply({ leadId, campaignId, event }: { leadId: number; campaignId: number; event?: WebhookEvent }): Promise<boolean> {
  if (!event) return false;
  const data = (event.data || {}) as Record<string, unknown>;
  const rm = event.reply_message || (data.reply_message as WebhookEvent["reply_message"]) || null;
  const body = (rm?.html as string | undefined) || (rm?.text as string | undefined) || event.email_body || (data.email_body as string | undefined) || "";
  const subject = rm?.subject || event.email_subject || (data.email_subject as string | undefined) || "";
  const timeIso = rm?.time || event.reply_time || (data.reply_time as string | undefined) || event.time_replied || (data.time_replied as string | undefined) || null;
  const from = event.from || event.lead_email || (data.from as string | undefined) || (data.lead_email as string | undefined) || "";

  // Skip if there's no usable inline content. We still rely on syncThreadMessages
  // (called by caller) to pull the message-history in that case.
  if (!body && !subject && !timeIso) return false;

  const threadKey = `${leadId}:${campaignId}`;
  const time = parseDate(timeIso) || new Date();
  const messageId = rm?.message_id || (data.message_id as string | undefined) || `webhook-${leadId}-${campaignId}-${time.getTime()}`;

  await InboxMessage.updateOne(
    { messageId },
    {
      $set: {
        messageId,
        threadKey,
        leadId,
        campaignId,
        time,
        type: "REPLY",
        subject,
        body,
        fromEmail: from,
        toEmail: "",
        syncedAt: new Date(),
      },
    },
    { upsert: true },
  );

  // Upsert thread so it shows in the inbox even if syncThreadMessages can't
  // reach Smartlead. Names get filled in later by syncThreadMessages via
  // fetchLead / fetchCampaign.
  await InboxThread.updateOne(
    { threadKey },
    {
      $set: {
        threadKey,
        leadId,
        campaignId,
        lastReplyAt: time,
        lastReplyPreview: previewText(body),
        lastReplySubject: subject,
        leadEmail: from,
        syncedAt: new Date(),
      },
      $inc: { replyCount: 1 },
    },
    { upsert: true },
  );
  return true;
}

function isPlausibleId(v: unknown): boolean {
  if (typeof v === "number") return Number.isFinite(v) && v > 0;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) && n > 0;
  }
  return false;
}

// Walk the payload tree and find the first plausible numeric value for any
// key matching the given predicate. Smartlead's webhook shape varies between
// event types so we try every nested object.
function findIdByKey(obj: unknown, keyMatches: (k: string) => boolean, seen = new WeakSet<object>()): number | null {
  if (!obj || typeof obj !== "object") return null;
  if (seen.has(obj as object)) return null;
  seen.add(obj as object);
  const o = obj as Record<string, unknown>;
  for (const [k, v] of Object.entries(o)) {
    if (keyMatches(k.toLowerCase()) && isPlausibleId(v)) return Number(v);
  }
  for (const v of Object.values(o)) {
    if (v && typeof v === "object") {
      const r = findIdByKey(v, keyMatches, seen);
      if (r != null) return r;
    }
  }
  return null;
}

function extractIds(e: WebhookEvent): { campaignId: number | null; leadId: number | null } {
  const campaignId = findIdByKey(e, (k) =>
    k === "campaign_id" || k === "campaignid" || k === "sl_campaign_id" || k === "sl_campaignid" || k === "campaign"
  );
  const leadId = findIdByKey(e, (k) =>
    k === "lead_id" || k === "leadid" || k === "sl_lead_id" || k === "sl_leadid" || k === "lead"
    || k === "sl_email_lead_id" || k === "sl_email_leadid"
  );
  return { campaignId, leadId };
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) {
    console.warn("[smartlead-webhook] rejected: secret mismatch");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try { body = await req.json(); } catch { body = null; }
  // Log the full payload so we can see Smartlead's real field shape.
  console.log("[smartlead-webhook] received:", JSON.stringify(body));
  if (body && typeof body === "object") {
    console.log("[smartlead-webhook] top-level keys:", Object.keys(body as Record<string, unknown>).join(", "));
  }

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

  // Build a map of (leadId, campaignId) -> inline payload data we can persist
  // directly. EMAIL_REPLY events usually carry the new message in the payload
  // itself, which avoids any indexing-lag race on Smartlead's side.
  const targets = new Map<string, { campaignId: number; leadId: number; inline?: WebhookEvent }>();
  for (const e of events) {
    const { campaignId, leadId } = extractIds(e);
    if (campaignId == null || leadId == null) continue;
    const key = `${leadId}:${campaignId}`;
    if (!targets.has(key)) targets.set(key, { campaignId, leadId, inline: e });
  }

  const results = await Promise.all(Array.from(targets.values()).slice(0, 50).map(async ({ leadId, campaignId, inline }) => {
    try {
      const persisted = await persistInlineReply({ leadId, campaignId, event: inline });
      const sync = await syncThreadMessages(leadId, campaignId, { force: true });
      return { messages: sync.messages, inlinePersisted: persisted, error: sync.error };
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

  const targetList = Array.from(targets.keys());
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
