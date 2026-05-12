import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import UserModel from "@/lib/models/user";
import { SUPERADMIN_EMAIL } from "@/lib/user-approval";
import InboxSyncState from "@/lib/models/inbox-sync-state";
import { getSyncState, requestSyncCancel, syncMasterInbox } from "@/lib/inbox-sync";

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
  if (!process.env.SMARTLEAD_API_KEY) {
    return NextResponse.json({ error: "SMARTLEAD_API_KEY missing on server" }, { status: 503 });
  }

  // Inbox sync is disabled by default. Allow only the two recovery actions
  // (cancel + force-unlock) so we can clear any in-flight state. Block
  // sync starts entirely until INBOX_SYNC_ENABLED is set true.
  const action = String(body.action || req.nextUrl.searchParams.get("action") || "").toLowerCase();
  if (process.env.INBOX_SYNC_ENABLED !== "true" && action !== "cancel" && action !== "force-unlock") {
    await requestSyncCancel();
    await connectDB();
    await InboxSyncState.updateOne(
      { key: "global" },
      { $set: { syncingAt: null, heartbeatAt: null, cancelRequested: false } },
    );
    return NextResponse.json({ error: "Inbox sync is disabled. Set INBOX_SYNC_ENABLED=true in .env.local and restart to re-enable.", disabled: true }, { status: 503 });
  }

  if (action === "cancel") {
    await requestSyncCancel();
    const state = await getSyncState();
    return NextResponse.json({ ok: true, cancelRequested: true, sync: { lastSyncedAt: state.lastSyncedAt, syncingAt: state.syncingAt } });
  }

  if (action === "force-unlock") {
    await connectDB();
    await InboxSyncState.updateOne(
      { key: "global" },
      { $set: { syncingAt: null, heartbeatAt: null, cancelRequested: false } },
    );
    const state = await getSyncState();
    return NextResponse.json({ ok: true, unlocked: true, sync: { lastSyncedAt: state.lastSyncedAt, syncingAt: state.syncingAt } });
  }

  const wait = body.wait === true || req.nextUrl.searchParams.get("wait") === "1";
  if (wait) {
    const result = await syncMasterInbox();
    const state = await getSyncState();
    return NextResponse.json({ ok: true, result, sync: { lastSyncedAt: state.lastSyncedAt, syncingAt: state.syncingAt } });
  }
  void syncMasterInbox();
  const state = await getSyncState();
  return NextResponse.json({ ok: true, queued: true, sync: { lastSyncedAt: state.lastSyncedAt, syncingAt: state.syncingAt } });
}
