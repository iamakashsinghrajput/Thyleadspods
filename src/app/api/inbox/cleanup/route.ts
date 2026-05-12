import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import UserModel from "@/lib/models/user";
import { SUPERADMIN_EMAIL } from "@/lib/user-approval";
import SmartleadCache from "@/lib/models/smartlead-cache";
import InboxMessage from "@/lib/models/inbox-message";
import InboxThread from "@/lib/models/inbox-thread";
import InboxSyncState from "@/lib/models/inbox-sync-state";

async function actorRole(email: string): Promise<string> {
  if ((email || "").toLowerCase() === SUPERADMIN_EMAIL) return "superadmin";
  const e = (email || "").toLowerCase().trim();
  if (!e) return "";
  await connectDB();
  const u = await UserModel.findOne({ email: e }).select("role").lean<{ role?: string }>();
  return u?.role || "";
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const actor = String(body.actor || req.nextUrl.searchParams.get("actor") || "");
  const role = await actorRole(actor);
  if (!["superadmin", "admin"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await connectDB();
  const action = String(body.action || "cache").toLowerCase();

  if (action === "cache") {
    const c1 = await SmartleadCache.deleteMany({});
    const c2 = await InboxMessage.updateMany({}, { $unset: { raw: 1 } });
    await InboxSyncState.updateOne({ key: "global" }, { $set: { syncingAt: null, heartbeatAt: null, cancelRequested: false } });
    return NextResponse.json({ ok: true, smartleadCacheCleared: c1.deletedCount, rawStripped: c2.modifiedCount });
  }

  if (action === "inbox") {
    const c1 = await InboxMessage.deleteMany({});
    const c2 = await InboxThread.deleteMany({});
    await InboxSyncState.updateOne({ key: "global" }, { $set: { lastSyncedAt: null, lastSyncedThreadCount: 0, syncingAt: null, heartbeatAt: null } });
    return NextResponse.json({ ok: true, inboxMessagesDeleted: c1.deletedCount, inboxThreadsDeleted: c2.deletedCount });
  }

  if (action === "all") {
    const c1 = await SmartleadCache.deleteMany({});
    const c2 = await InboxMessage.deleteMany({});
    const c3 = await InboxThread.deleteMany({});
    await InboxSyncState.deleteOne({ key: "global" });
    return NextResponse.json({ ok: true, smartleadCacheCleared: c1.deletedCount, inboxMessagesDeleted: c2.deletedCount, inboxThreadsDeleted: c3.deletedCount });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}

export async function GET(req: NextRequest) {
  const actor = req.nextUrl.searchParams.get("actor") || "";
  const role = await actorRole(actor);
  if (!["superadmin", "admin"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  await connectDB();
  const [cache, messages, threads] = await Promise.all([
    SmartleadCache.estimatedDocumentCount(),
    InboxMessage.estimatedDocumentCount(),
    InboxThread.estimatedDocumentCount(),
  ]);
  return NextResponse.json({ counts: { smartleadCache: cache, inboxMessages: messages, inboxThreads: threads } });
}
