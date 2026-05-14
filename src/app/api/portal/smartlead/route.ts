import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Project from "@/lib/models/project";
import { fetchAllCampaigns, fetchCampaignAnalytics, fetchCampaignWithAnalytics, getCampaignReplyMetrics } from "@/lib/smartlead";

const EMPTY_TOTALS = {
  sent: 0, replies: 0, uniqueReplies: 0, positiveReplies: 0, bounces: 0, unsubscribes: 0,
  replyRate: 0, uniqueReplyRate: 0, positiveReplyRate: 0, bounceRate: 0, unsubscribeRate: 0,
};

async function enrichWithReplyMetrics<T extends { campaign_id?: number; id?: number }>(rows: T[]): Promise<Array<T & { unique_reply_count: number; positive_reply_count: number }>> {
  return Promise.all(rows.map(async (r) => {
    const id = r.campaign_id ?? r.id;
    if (id == null) return { ...r, unique_reply_count: 0, positive_reply_count: 0 };
    const { uniqueReplyCount, positiveReplyCount } = await getCampaignReplyMetrics(String(id)).catch(() => ({ uniqueReplyCount: 0, positiveReplyCount: 0 }));
    return { ...r, unique_reply_count: uniqueReplyCount, positive_reply_count: positiveReplyCount };
  }));
}

function aggregateClientTotals(rows: Array<{ sent_count?: number; reply_count?: number; bounce_count?: number; unsubscribed_count?: number; unique_reply_count?: number; positive_reply_count?: number }>) {
  const n = (v: unknown) => (typeof v === "number" ? v : Number(v) || 0);
  const totals = rows.reduce((acc, r) => {
    acc.sent += n(r.sent_count);
    acc.replies += n(r.reply_count);
    acc.uniqueReplies += n(r.unique_reply_count);
    acc.positiveReplies += n(r.positive_reply_count);
    acc.bounces += n(r.bounce_count);
    acc.unsubscribes += n(r.unsubscribed_count);
    return acc;
  }, { sent: 0, replies: 0, uniqueReplies: 0, positiveReplies: 0, bounces: 0, unsubscribes: 0 });
  const pct = (num: number, den: number) => (den > 0 ? Math.round((num / den) * 1000) / 10 : 0);
  return {
    ...totals,
    replyRate: pct(totals.replies, totals.sent),
    uniqueReplyRate: pct(totals.uniqueReplies, totals.sent),
    positiveReplyRate: pct(totals.positiveReplies, totals.sent),
    bounceRate: pct(totals.bounces, totals.sent),
    unsubscribeRate: pct(totals.unsubscribes, totals.sent),
  };
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get("projectId");
  if (!projectId) {
    return NextResponse.json({ error: "projectId required" }, { status: 400 });
  }

  await connectDB();
  const project = await Project.findOne({ id: projectId }).lean<{ smartleadCampaignIds?: string[]; clientName?: string }>();
  if (!project) return NextResponse.json({ error: "project not found" }, { status: 404 });

  const campaignIds = (project.smartleadCampaignIds || []).map((s) => String(s).trim()).filter(Boolean);
  const clientName = (project.clientName || "").trim();
  const hasKey = !!process.env.SMARTLEAD_API_KEY;

  if (!hasKey) {
    return NextResponse.json({
      error: "SMARTLEAD_API_KEY missing on server",
      campaigns: [],
      totals: EMPTY_TOTALS,
      configured: false,
      reason: "no-key",
    }, { status: 503 });
  }

  // Path 1: admin has explicitly chosen campaign IDs for this client.
  if (campaignIds.length > 0) {
    const settled = await Promise.all(campaignIds.map((id) => fetchCampaignWithAnalytics(id)));
    const base = settled.filter((c): c is NonNullable<typeof c> => c !== null);
    const campaigns = await enrichWithReplyMetrics(base);
    const totals = aggregateClientTotals(campaigns);
    return NextResponse.json({ campaigns, totals, configured: true, source: "manual" });
  }

  // Path 2: auto-match by client name — campaigns whose name contains the client name.
  if (!clientName) {
    return NextResponse.json({
      campaigns: [],
      totals: EMPTY_TOTALS,
      configured: false,
      reason: "no-campaigns",
    });
  }

  try {
    const all = await fetchAllCampaigns();
    const needle = normalize(clientName);
    const matched = needle ? all.filter((c) => normalize(c.name || "").includes(needle)) : [];
    if (matched.length === 0) {
      return NextResponse.json({
        campaigns: [],
        totals: EMPTY_TOTALS,
        configured: false,
        reason: "no-name-match",
        clientName,
      });
    }
    const settled = await Promise.all(matched.map(async (m) => {
      try {
        const stats = await fetchCampaignAnalytics(String(m.id));
        return {
          ...stats,
          campaign_id: m.id,
          name: m.name || stats.campaign_name || `Campaign ${m.id}`,
          status: m.status || stats.campaign_status || "unknown",
          created_at: m.created_at,
          start_date: m.start_date,
        };
      } catch {
        return null;
      }
    }));
    const base = settled.filter((c): c is NonNullable<typeof c> => c !== null);
    const campaigns = await enrichWithReplyMetrics(base);
    const totals = aggregateClientTotals(campaigns);
    return NextResponse.json({ campaigns, totals, configured: true, source: "auto-name-match", clientName });
  } catch (e) {
    return NextResponse.json({
      error: e instanceof Error ? e.message : "Smartlead error",
      campaigns: [],
      totals: EMPTY_TOTALS,
      configured: false,
      reason: "fetch-failed",
    }, { status: 502 });
  }
}
