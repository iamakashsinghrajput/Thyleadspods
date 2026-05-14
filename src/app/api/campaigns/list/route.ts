import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import UserModel from "@/lib/models/user";
import { SUPERADMIN_EMAIL } from "@/lib/user-approval";
import CampaignsListSnapshot from "@/lib/models/campaigns-list-snapshot";
import { fetchAllCampaigns, fetchCampaignAnalytics, mapLimited } from "@/lib/smartlead";

const STALE_MS = 5 * 60_000;
const REFRESH_LOCK_TIMEOUT_MS = 2 * 60_000;

async function actorRole(email: string): Promise<string> {
  if ((email || "").toLowerCase() === SUPERADMIN_EMAIL) return "superadmin";
  const e = (email || "").toLowerCase().trim();
  if (!e) return "";
  await connectDB();
  const u = await UserModel.findOne({ email: e }).select("role").lean<{ role?: string }>();
  return u?.role || "";
}

type Row = {
  id: number;
  name: string;
  status: string;
  createdAt: string | null;
  sentCount: number;
  openCount: number;
  clickCount: number;
  replyCount: number;
  bounceCount: number;
  unsubscribedCount: number;
  totalCount: number;
  uniqueOpenCount: number;
  uniqueClickCount: number;
};

async function buildFreshSnapshot(): Promise<{ campaigns: Row[]; counts: Record<string, number> }> {
  const campaigns = await fetchAllCampaigns();
  const rows = await mapLimited(campaigns, async (c) => {
    const id = c.id;
    if (id === undefined) return null;
    const stats = await fetchCampaignAnalytics(String(id)).catch(() => null);
    return {
      id,
      name: c.name || `Campaign ${id}`,
      status: (c.status || stats?.campaign_status || "unknown").toLowerCase(),
      createdAt: c.created_at || null,
      sentCount: stats?.sent_count || 0,
      openCount: stats?.open_count || 0,
      clickCount: stats?.click_count || 0,
      replyCount: stats?.reply_count || 0,
      bounceCount: stats?.bounce_count || 0,
      unsubscribedCount: stats?.unsubscribed_count || 0,
      totalCount: stats?.total_count || 0,
      uniqueOpenCount: stats?.unique_open_count || 0,
      uniqueClickCount: stats?.unique_click_count || 0,
    } as Row;
  });
  const filtered = rows.filter((r): r is Row => r !== null);
  filtered.sort((a, b) => {
    const at = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bt = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return bt - at;
  });
  const counts = {
    all: filtered.length,
    active: filtered.filter((c) => c.status === "active").length,
    paused: filtered.filter((c) => c.status === "paused").length,
    stopped: filtered.filter((c) => c.status === "stopped").length,
    completed: filtered.filter((c) => c.status === "completed").length,
    drafted: filtered.filter((c) => c.status === "drafted").length,
  };
  return { campaigns: filtered, counts };
}

// Background refresher. Acquires a soft lock via `refreshingAt`. Fire-and-forget
// from the GET handler — never awaited by the request.
async function refreshSnapshot(): Promise<void> {
  await connectDB();
  // Try to acquire the lock (skip if another refresh is in flight and fresh).
  const lockCutoff = new Date(Date.now() - REFRESH_LOCK_TIMEOUT_MS);
  const acquired = await CampaignsListSnapshot.updateOne(
    {
      key: "global",
      $or: [
        { refreshingAt: null },
        { refreshingAt: { $lt: lockCutoff } },
      ],
    },
    { $set: { refreshingAt: new Date() } },
    { upsert: true },
  );
  if (acquired.modifiedCount === 0 && acquired.upsertedCount === 0) {
    return; // someone else is refreshing
  }

  try {
    const fresh = await buildFreshSnapshot();
    await CampaignsListSnapshot.updateOne(
      { key: "global" },
      { $set: { campaigns: fresh.campaigns, counts: fresh.counts, updatedAt: new Date(), refreshingAt: null, lastError: "" } },
      { upsert: true },
    );
  } catch (e) {
    await CampaignsListSnapshot.updateOne(
      { key: "global" },
      { $set: { refreshingAt: null, lastError: e instanceof Error ? e.message : "refresh failed" } },
    );
  }
}

export async function GET(req: NextRequest) {
  const actor = req.nextUrl.searchParams.get("actor") || "";
  const role = await actorRole(actor);
  if (role !== "superadmin" && role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!process.env.SMARTLEAD_API_KEY) {
    return NextResponse.json({ error: "SMARTLEAD_API_KEY missing", campaigns: [] }, { status: 503 });
  }

  await connectDB();
  const force = req.nextUrl.searchParams.get("fresh") === "1";
  const snapshot = await CampaignsListSnapshot.findOne({ key: "global" }).lean<{
    campaigns?: Row[];
    counts?: Record<string, number>;
    updatedAt?: Date | null;
    refreshingAt?: Date | null;
    lastError?: string;
  }>();

  const hasData = snapshot && Array.isArray(snapshot.campaigns) && snapshot.campaigns.length > 0;
  const isStale = !snapshot?.updatedAt || Date.now() - new Date(snapshot.updatedAt).getTime() > STALE_MS;
  const isRefreshing = !!snapshot?.refreshingAt
    && Date.now() - new Date(snapshot.refreshingAt).getTime() < REFRESH_LOCK_TIMEOUT_MS;

  // Force refresh OR no data at all → fetch fresh synchronously.
  if (force || !hasData) {
    try {
      const fresh = await buildFreshSnapshot();
      await CampaignsListSnapshot.updateOne(
        { key: "global" },
        { $set: { campaigns: fresh.campaigns, counts: fresh.counts, updatedAt: new Date(), refreshingAt: null, lastError: "" } },
        { upsert: true },
      );
      return NextResponse.json({
        ...fresh,
        source: "fresh",
        updatedAt: new Date().toISOString(),
      });
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : "Smartlead error", campaigns: [] }, { status: 502 });
    }
  }

  // Stale-while-revalidate: serve cached, kick off refresh if stale.
  if (isStale && !isRefreshing) {
    void refreshSnapshot();
  }

  return NextResponse.json({
    campaigns: snapshot!.campaigns || [],
    counts: snapshot!.counts || {},
    source: isStale ? "stale" : "cache",
    refreshing: isStale,
    updatedAt: snapshot!.updatedAt?.toISOString?.() || null,
  });
}
