import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import UserModel from "@/lib/models/user";
import { SUPERADMIN_EMAIL } from "@/lib/user-approval";
import InboxThread from "@/lib/models/inbox-thread";
import InboxMessage from "@/lib/models/inbox-message";
import { syncThreadMessages, refreshThreadCategory } from "@/lib/inbox-sync";
import { updateLeadCategory } from "@/lib/smartlead";

async function actorRole(email: string): Promise<string> {
  if ((email || "").toLowerCase() === SUPERADMIN_EMAIL) return "superadmin";
  const e = (email || "").toLowerCase().trim();
  if (!e) return "";
  await connectDB();
  const u = await UserModel.findOne({ email: e }).select("role").lean<{ role?: string }>();
  return u?.role || "";
}

const STALE_HISTORY_MS = 2 * 60_000;

export async function GET(req: NextRequest, { params }: { params: Promise<{ leadId: string; campaignId: string }> }) {
  const { leadId: leadIdStr, campaignId: campaignIdStr } = await params;
  const actor = req.nextUrl.searchParams.get("actor") || "";
  const role = await actorRole(actor);
  if (!["superadmin", "admin"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const leadId = Number(leadIdStr);
  const campaignId = Number(campaignIdStr);
  if (!Number.isFinite(leadId) || !Number.isFinite(campaignId)) {
    return NextResponse.json({ error: "invalid ids" }, { status: 400 });
  }

  await connectDB();
  const threadKey = `${leadId}:${campaignId}`;
  const thread = await InboxThread.findOne({ threadKey }).lean<{ messageHistorySyncedAt?: Date | null }>();

  const stale = !thread?.messageHistorySyncedAt || Date.now() - new Date(thread.messageHistorySyncedAt).getTime() > STALE_HISTORY_MS;
  if (stale) {
    // For first-load (no history yet) wait for the fetch so the user sees messages.
    // For stale-but-present, kick off background refresh and serve current data.
    const hasAny = await InboxMessage.exists({ threadKey });
    if (!hasAny) {
      await syncThreadMessages(leadId, campaignId);
    } else {
      void syncThreadMessages(leadId, campaignId);
    }
  }

  // Pull the latest category from Smartlead so changes made in the Smartlead
  // master inbox flow back here. Wait for it so the response reflects the
  // current state. ?force=1 bypasses the 5s TTL — useful when the user clicks
  // the refresh button after just changing a category in Smartlead.
  const force = req.nextUrl.searchParams.get("force") === "1";
  await refreshThreadCategory(leadId, campaignId, { force }).catch((e) => {
    console.warn(`[thread-route] refreshThreadCategory failed for ${threadKey}:`, e instanceof Error ? e.message : e);
  });

  const [updatedThread, messages] = await Promise.all([
    InboxThread.findOne({ threadKey }).lean(),
    InboxMessage.find({ threadKey }).sort({ time: -1 }).lean(),
  ]);

  return NextResponse.json({ thread: updatedThread, messages });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ leadId: string; campaignId: string }> }) {
  const { leadId: leadIdStr, campaignId: campaignIdStr } = await params;
  const body = await req.json().catch(() => ({}));
  const actor = String(body.actor || "");
  const role = await actorRole(actor);
  if (!["superadmin", "admin"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const leadId = Number(leadIdStr);
  const campaignId = Number(campaignIdStr);
  const threadKey = `${leadId}:${campaignId}`;

  await connectDB();

  if (body.action === "mark-read") {
    await InboxThread.updateOne({ threadKey }, { $set: { locallyReadAt: new Date() } });
    return NextResponse.json({ ok: true });
  }
  if (body.action === "mark-unread") {
    await InboxThread.updateOne({ threadKey }, { $set: { locallyReadAt: null } });
    return NextResponse.json({ ok: true });
  }
  if (body.action === "set-category") {
    const categoryId = Number(body.categoryId);
    const categoryName = String(body.categoryName || "");
    if (!Number.isFinite(categoryId)) {
      return NextResponse.json({ error: "categoryId required" }, { status: 400 });
    }
    try {
      await updateLeadCategory(String(campaignId), String(leadId), categoryId);
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : "Smartlead update failed" }, { status: 502 });
    }
    await InboxThread.updateOne({ threadKey }, { $set: { category: categoryName } });
    return NextResponse.json({ ok: true, category: categoryName });
  }
  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
