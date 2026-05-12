import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import UserModel from "@/lib/models/user";
import { SUPERADMIN_EMAIL } from "@/lib/user-approval";
import InboxThread from "@/lib/models/inbox-thread";
import { getSyncState, isStale, syncMasterInbox } from "@/lib/inbox-sync";

async function actorRole(email: string): Promise<string> {
  if ((email || "").toLowerCase() === SUPERADMIN_EMAIL) return "superadmin";
  const e = (email || "").toLowerCase().trim();
  if (!e) return "";
  await connectDB();
  const u = await UserModel.findOne({ email: e }).select("role").lean<{ role?: string }>();
  return u?.role || "";
}

export async function GET(req: NextRequest) {
  const actor = req.nextUrl.searchParams.get("actor") || "";
  const role = await actorRole(actor);
  if (!["superadmin", "admin"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const campaignParam = req.nextUrl.searchParams.get("campaign") || "all";
  const category = req.nextUrl.searchParams.get("category") || "all";
  const unread = req.nextUrl.searchParams.get("unread") === "1";
  const q = (req.nextUrl.searchParams.get("q") || "").trim();
  const limit = Math.min(200, Math.max(1, Number(req.nextUrl.searchParams.get("limit") || 100)));
  const offset = Math.max(0, Number(req.nextUrl.searchParams.get("offset") || 0));

  await connectDB();

  // Sync is disabled (INBOX_SYNC_ENABLED) — don't auto-kick anything.
  const state = await getSyncState();
  if (process.env.INBOX_SYNC_ENABLED === "true" && isStale(state.lastSyncedAt) && !state.syncingAt) {
    void syncMasterInbox();
  }

  const filter: Record<string, unknown> = {};
  if (campaignParam !== "all") {
    const id = Number(campaignParam);
    if (Number.isFinite(id)) filter.campaignId = id;
  }
  if (category !== "all") filter.category = category;
  if (unread) filter.locallyReadAt = null;
  if (q) {
    const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [
      { leadEmail: rx },
      { leadFirstName: rx },
      { leadLastName: rx },
      { leadCompany: rx },
      { campaignName: rx },
      { lastReplySubject: rx },
    ];
  }

  const [threads, total, campaigns, categories, unreadCount] = await Promise.all([
    InboxThread.find(filter).sort({ lastReplyAt: -1 }).skip(offset).limit(limit).lean(),
    InboxThread.countDocuments(filter),
    InboxThread.aggregate<{ _id: number; name: string; count: number }>([
      { $group: { _id: "$campaignId", name: { $last: "$campaignName" }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    InboxThread.aggregate<{ _id: string; count: number }>([
      { $match: { category: { $ne: "" } } },
      { $group: { _id: "$category", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    InboxThread.countDocuments({ locallyReadAt: null }),
  ]);

  return NextResponse.json({
    threads,
    total,
    unreadCount,
    facets: {
      campaigns: campaigns.map((c) => ({ id: c._id, name: c.name, count: c.count })),
      categories: categories.map((c) => ({ key: c._id, count: c.count })),
    },
    sync: {
      lastSyncedAt: state.lastSyncedAt,
      syncingAt: state.syncingAt,
      heartbeatAt: state.heartbeatAt,
      cancelRequested: !!state.cancelRequested,
      progress: state.progress || null,
      stale: isStale(state.lastSyncedAt),
      lastError: state.lastError || "",
    },
  });
}
