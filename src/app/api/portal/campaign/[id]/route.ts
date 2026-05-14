import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Project from "@/lib/models/project";
import {
  fetchCampaign,
  fetchCampaignAnalytics,
  fetchCampaignSequences,
  fetchCampaignEmailAccounts,
  fetchAllCampaigns,
} from "@/lib/smartlead";

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

// Client portal — full detail for a single campaign. Verifies the campaign
// belongs to the requesting client's project either via explicit
// smartleadCampaignIds or by client-name-match (same rule used by
// /api/portal/smartlead). Returns 403 if the project doesn't own the campaign.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const projectId = req.nextUrl.searchParams.get("projectId") || "";
  if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });
  if (!process.env.SMARTLEAD_API_KEY) {
    return NextResponse.json({ error: "Smartlead not configured" }, { status: 503 });
  }

  await connectDB();
  const project = await Project.findOne({ id: projectId }).lean<{ smartleadCampaignIds?: string[]; clientName?: string }>();
  if (!project) return NextResponse.json({ error: "project not found" }, { status: 404 });

  // Authorization: campaignId must be in this project's configured list, or
  // match by client-name normalization.
  const idStr = String(id);
  let allowed = (project.smartleadCampaignIds || []).map((s) => String(s).trim()).includes(idStr);

  if (!allowed) {
    const all = await fetchAllCampaigns().catch(() => []);
    const needle = normalize(project.clientName || "");
    const match = all.find((c) => String(c.id) === idStr);
    if (match && needle && normalize(match.name || "").includes(needle)) {
      allowed = true;
    }
  }

  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const [meta, analytics, sequences, accounts] = await Promise.all([
      fetchCampaign(idStr).catch(() => null),
      fetchCampaignAnalytics(idStr).catch(() => null),
      fetchCampaignSequences(idStr).catch(() => []),
      fetchCampaignEmailAccounts(idStr).catch(() => []),
    ]);
    if (!meta) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    return NextResponse.json({ campaign: meta, analytics, sequences, accounts });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Smartlead error" }, { status: 502 });
  }
}
