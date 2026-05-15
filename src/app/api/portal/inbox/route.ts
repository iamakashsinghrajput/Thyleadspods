import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Project from "@/lib/models/project";
import InboxThread from "@/lib/models/inbox-thread";
import { fetchAllCampaigns } from "@/lib/smartlead";

function normalize(s: string): string {
  return (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

async function resolveCampaignIds(projectId: string): Promise<{ ids: number[]; clientName: string; reason?: string }> {
  await connectDB();
  const project = await Project.findOne({ id: projectId })
    .select("id clientName smartleadCampaignIds")
    .lean<{ id: string; clientName?: string; smartleadCampaignIds?: string[] }>();
  if (!project) return { ids: [], clientName: "", reason: "project-not-found" };

  const explicit = (project.smartleadCampaignIds || [])
    .map((s) => Number(String(s).trim()))
    .filter((n) => Number.isFinite(n));
  if (explicit.length > 0) {
    return { ids: explicit, clientName: project.clientName || "" };
  }

  const clientName = (project.clientName || "").trim();
  if (!clientName) return { ids: [], clientName: "", reason: "no-client-name" };

  if (!process.env.SMARTLEAD_API_KEY) {
    return { ids: [], clientName, reason: "no-key" };
  }

  try {
    const all = await fetchAllCampaigns();
    const needle = normalize(clientName);
    const matched = all
      .filter((c) => needle && normalize(c.name || "").includes(needle))
      .map((c) => Number(c.id))
      .filter((n) => Number.isFinite(n));
    return { ids: matched, clientName };
  } catch {
    return { ids: [], clientName, reason: "smartlead-error" };
  }
}

export async function GET(req: NextRequest) {
  const projectId = (req.nextUrl.searchParams.get("projectId") || "").trim();
  if (!projectId) {
    return NextResponse.json({ error: "projectId required" }, { status: 400 });
  }

  const campaignParam = (req.nextUrl.searchParams.get("campaign") || "all").trim();
  const q = (req.nextUrl.searchParams.get("q") || "").trim();
  const unread = req.nextUrl.searchParams.get("unread") === "1";
  const limit = Math.min(200, Math.max(1, Number(req.nextUrl.searchParams.get("limit") || 50)));
  const offset = Math.max(0, Number(req.nextUrl.searchParams.get("offset") || 0));

  const { ids, clientName, reason } = await resolveCampaignIds(projectId);
  if (ids.length === 0) {
    return NextResponse.json({
      threads: [],
      total: 0,
      campaigns: [],
      campaignIds: [],
      unreadCount: 0,
      clientName,
      reason: reason || "no-campaigns",
    });
  }

  const filter: Record<string, unknown> = { campaignId: { $in: ids } };
  if (campaignParam !== "all") {
    const oneId = Number(campaignParam);
    if (Number.isFinite(oneId) && ids.includes(oneId)) {
      filter.campaignId = oneId;
    }
  }
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

  await connectDB();
  const [threads, total, campaignsAgg, unreadCount] = await Promise.all([
    InboxThread.find(filter)
      .sort({ lastReplyAt: -1 })
      .skip(offset)
      .limit(limit)
      .select("threadKey leadId campaignId campaignName leadFirstName leadLastName leadEmail leadCompany leadTitle category replyCount lastReplyAt lastReplyPreview lastReplySubject locallyReadAt")
      .lean(),
    InboxThread.countDocuments(filter),
    InboxThread.aggregate<{ _id: number; name: string; count: number }>([
      { $match: { campaignId: { $in: ids } } },
      { $group: { _id: "$campaignId", name: { $last: "$campaignName" }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    InboxThread.countDocuments({ campaignId: { $in: ids }, locallyReadAt: null }),
  ]);

  return NextResponse.json({
    threads,
    total,
    unreadCount,
    campaigns: campaignsAgg.map((c) => ({ id: c._id, name: c.name, count: c.count })),
    campaignIds: ids,
    clientName,
  });
}
