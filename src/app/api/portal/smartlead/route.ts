import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Project from "@/lib/models/project";
import { aggregateAnalytics, fetchAllCampaigns, fetchCampaignAnalytics, fetchCampaignWithAnalytics } from "@/lib/smartlead";

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
      totals: aggregateAnalytics([]),
      configured: false,
      reason: "no-key",
    }, { status: 503 });
  }

  // Path 1: admin has explicitly chosen campaign IDs for this client.
  if (campaignIds.length > 0) {
    const settled = await Promise.all(campaignIds.map((id) => fetchCampaignWithAnalytics(id)));
    const campaigns = settled.filter((c): c is NonNullable<typeof c> => c !== null);
    const totals = aggregateAnalytics(campaigns);
    return NextResponse.json({ campaigns, totals, configured: true, source: "manual" });
  }

  // Path 2: auto-match by client name — campaigns whose name contains the client name.
  if (!clientName) {
    return NextResponse.json({
      campaigns: [],
      totals: aggregateAnalytics([]),
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
        totals: aggregateAnalytics([]),
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
    const campaigns = settled.filter((c): c is NonNullable<typeof c> => c !== null);
    const totals = aggregateAnalytics(campaigns);
    return NextResponse.json({ campaigns, totals, configured: true, source: "auto-name-match", clientName });
  } catch (e) {
    return NextResponse.json({
      error: e instanceof Error ? e.message : "Smartlead error",
      campaigns: [],
      totals: aggregateAnalytics([]),
      configured: false,
      reason: "fetch-failed",
    }, { status: 502 });
  }
}
