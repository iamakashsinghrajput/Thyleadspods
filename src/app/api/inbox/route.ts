import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import UserModel from "@/lib/models/user";
import Project from "@/lib/models/project";
import { SUPERADMIN_EMAIL } from "@/lib/user-approval";
import InboxThread from "@/lib/models/inbox-thread";
import { getSyncState, isStale, syncMasterInbox } from "@/lib/inbox-sync";
import { fetchLeadCategories } from "@/lib/smartlead";

async function actorRole(email: string): Promise<string> {
  if ((email || "").toLowerCase() === SUPERADMIN_EMAIL) return "superadmin";
  const e = (email || "").toLowerCase().trim();
  if (!e) return "";
  await connectDB();
  const u = await UserModel.findOne({ email: e }).select("role").lean<{ role?: string }>();
  return u?.role || "";
}

const UNMATCHED = "Other";

function normalize(s: string): string {
  return (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

export async function GET(req: NextRequest) {
  const actor = req.nextUrl.searchParams.get("actor") || "";
  const role = await actorRole(actor);
  if (!["superadmin", "admin"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const campaignParam = req.nextUrl.searchParams.get("campaign") || "all";
  const clientParam = (req.nextUrl.searchParams.get("client") || "all").trim();
  const categoryRaw = req.nextUrl.searchParams.get("category") || "all";
  const categoryList = categoryRaw === "all" || categoryRaw === ""
    ? []
    : categoryRaw.split(",").map((s) => s.trim()).filter(Boolean);
  const unread = req.nextUrl.searchParams.get("unread") === "1";
  const q = (req.nextUrl.searchParams.get("q") || "").trim();
  const limit = Math.min(200, Math.max(1, Number(req.nextUrl.searchParams.get("limit") || 100)));
  const offset = Math.max(0, Number(req.nextUrl.searchParams.get("offset") || 0));

  await connectDB();

  const state = await getSyncState();
  if (process.env.INBOX_SYNC_ENABLED === "true" && isStale(state.lastSyncedAt) && !state.syncingAt) {
    void syncMasterInbox();
  }

  // Build client keyword list from projects.
  const projects = await Project.find({}).select("clientName").lean<Array<{ clientName?: string }>>();
  const clientKeywords = Array.from(new Map(
    projects
      .map((p) => (p.clientName || "").trim())
      .filter(Boolean)
      .map((name) => [name, { name, key: normalize(name) }])
  ).values()).filter((c) => c.key);

  function clientFor(campaignName: string): string {
    const cn = normalize(campaignName || "");
    for (const c of clientKeywords) {
      if (c.key && cn.includes(c.key)) return c.name;
    }
    return UNMATCHED;
  }

  // Build a campaignId → client map from the threads we have.
  const allCampaigns = await InboxThread.aggregate<{ _id: number; name: string; count: number }>([
    { $group: { _id: "$campaignId", name: { $last: "$campaignName" }, count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);
  const campaignsWithClient = allCampaigns.map((c) => ({
    id: c._id,
    name: c.name,
    count: c.count,
    client: clientFor(c.name),
  }));

  // Group campaigns by client + compute client totals.
  const clientGroups = new Map<string, { name: string; count: number; campaigns: Array<{ id: number; name: string; count: number }> }>();
  for (const c of campaignsWithClient) {
    if (!clientGroups.has(c.client)) clientGroups.set(c.client, { name: c.client, count: 0, campaigns: [] });
    const g = clientGroups.get(c.client)!;
    g.count += c.count;
    g.campaigns.push({ id: c.id, name: c.name, count: c.count });
  }
  const clientsFacet = Array.from(clientGroups.values())
    .map((g) => ({
      name: g.name,
      count: g.count,
      campaigns: g.campaigns.sort((a, b) => b.count - a.count),
    }))
    .sort((a, b) => {
      if (a.name === UNMATCHED) return 1;
      if (b.name === UNMATCHED) return -1;
      return b.count - a.count;
    });

  // Compose the thread filter.
  const filter: Record<string, unknown> = {};
  if (campaignParam !== "all") {
    const id = Number(campaignParam);
    if (Number.isFinite(id)) filter.campaignId = id;
  } else if (clientParam !== "all") {
    const ids = (clientGroups.get(clientParam)?.campaigns || []).map((c) => c.id);
    filter.campaignId = ids.length > 0 ? { $in: ids } : -1; // no match if client has no campaigns
  }
  if (categoryList.length > 0) filter.category = { $in: categoryList };
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

  const [threads, total, categories, unreadCount, availableCategories] = await Promise.all([
    InboxThread.find(filter).sort({ lastReplyAt: -1 }).skip(offset).limit(limit).lean(),
    InboxThread.countDocuments(filter),
    InboxThread.aggregate<{ _id: string; count: number }>([
      { $match: { category: { $ne: "" } } },
      { $group: { _id: "$category", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    InboxThread.countDocuments({ locallyReadAt: null }),
    fetchLeadCategories().catch(() => []),
  ]);

  return NextResponse.json({
    threads,
    total,
    unreadCount,
    facets: {
      clients: clientsFacet,
      campaigns: campaignsWithClient,
      categories: categories.map((c) => ({ key: c._id, count: c.count })),
    },
    availableCategories: (availableCategories || []).map((c) => ({ id: c.id, name: c.name, description: c.description || "" })),
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
