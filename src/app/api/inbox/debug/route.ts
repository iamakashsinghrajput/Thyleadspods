import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import UserModel from "@/lib/models/user";
import { SUPERADMIN_EMAIL } from "@/lib/user-approval";
import { fetchAllCampaigns, fetchCampaignLeads, fetchLeadMessageHistory } from "@/lib/smartlead";

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

  const campaignIdParam = req.nextUrl.searchParams.get("campaign");
  const leadIdParam = req.nextUrl.searchParams.get("lead");

  if (leadIdParam && campaignIdParam) {
    const history = await fetchLeadMessageHistory(campaignIdParam, leadIdParam);
    return NextResponse.json({
      sampleCount: history.length,
      firstMessage: history[0] || null,
      types: Array.from(new Set(history.map((m) => m.type))),
      messages: history,
    });
  }

  const campaigns = await fetchAllCampaigns();
  if (!campaignIdParam) {
    return NextResponse.json({
      totalCampaigns: campaigns.length,
      campaigns: campaigns.slice(0, 20).map((c) => ({ id: c.id, name: c.name, status: c.status })),
      hint: "Add ?campaign=<id> to inspect a campaign's first lead page, or ?campaign=<id>&lead=<id> to inspect a lead's message history.",
    });
  }

  const page = await fetchCampaignLeads(campaignIdParam, { limit: 5, offset: 0 });
  const first = page.data?.[0];
  return NextResponse.json({
    campaignId: campaignIdParam,
    totalLeads: page.total_leads,
    rowsReturned: page.data?.length ?? 0,
    firstRowKeysTopLevel: first ? Object.keys(first as Record<string, unknown>) : [],
    firstRowLeadKeys: first?.lead ? Object.keys(first.lead) : [],
    firstRowCampaignLeadMapKeys: first?.campaign_lead_map ? Object.keys(first.campaign_lead_map) : [],
    firstRow: first,
  });
}
