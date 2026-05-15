import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Project from "@/lib/models/project";
import InboxThread from "@/lib/models/inbox-thread";
import InboxMessage from "@/lib/models/inbox-message";
import { syncThreadMessages, refreshThreadCategory } from "@/lib/inbox-sync";
import { fetchAllCampaigns } from "@/lib/smartlead";

const STALE_HISTORY_MS = 2 * 60_000;

function normalize(s: string): string {
  return (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

async function projectCampaignIds(projectId: string): Promise<number[]> {
  await connectDB();
  const project = await Project.findOne({ id: projectId })
    .select("id clientName smartleadCampaignIds")
    .lean<{ id: string; clientName?: string; smartleadCampaignIds?: string[] }>();
  if (!project) return [];

  const explicit = (project.smartleadCampaignIds || [])
    .map((s) => Number(String(s).trim()))
    .filter((n) => Number.isFinite(n));
  if (explicit.length > 0) return explicit;

  const clientName = (project.clientName || "").trim();
  if (!clientName || !process.env.SMARTLEAD_API_KEY) return [];
  try {
    const all = await fetchAllCampaigns();
    const needle = normalize(clientName);
    return all
      .filter((c) => needle && normalize(c.name || "").includes(needle))
      .map((c) => Number(c.id))
      .filter((n) => Number.isFinite(n));
  } catch {
    return [];
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ leadId: string; campaignId: string }> }) {
  const { leadId: leadIdStr, campaignId: campaignIdStr } = await params;
  const projectId = (req.nextUrl.searchParams.get("projectId") || "").trim();
  if (!projectId) {
    return NextResponse.json({ error: "projectId required" }, { status: 400 });
  }

  const leadId = Number(leadIdStr);
  const campaignId = Number(campaignIdStr);
  if (!Number.isFinite(leadId) || !Number.isFinite(campaignId)) {
    return NextResponse.json({ error: "invalid ids" }, { status: 400 });
  }

  const allowed = await projectCampaignIds(projectId);
  if (!allowed.includes(campaignId)) {
    return NextResponse.json({ error: "Forbidden — campaign not in this project" }, { status: 403 });
  }

  await connectDB();
  const threadKey = `${leadId}:${campaignId}`;
  const thread = await InboxThread.findOne({ threadKey }).lean<{ messageHistorySyncedAt?: Date | null }>();

  const stale = !thread?.messageHistorySyncedAt || Date.now() - new Date(thread.messageHistorySyncedAt).getTime() > STALE_HISTORY_MS;
  if (stale) {
    const hasAny = await InboxMessage.exists({ threadKey });
    if (!hasAny) {
      await syncThreadMessages(leadId, campaignId);
    } else {
      void syncThreadMessages(leadId, campaignId);
    }
  }

  const force = req.nextUrl.searchParams.get("force") === "1";
  await refreshThreadCategory(leadId, campaignId, { force }).catch(() => {});

  const [updatedThread, messages] = await Promise.all([
    InboxThread.findOne({ threadKey }).lean(),
    InboxMessage.find({ threadKey }).sort({ time: -1 }).lean(),
  ]);

  return NextResponse.json({ thread: updatedThread, messages });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ leadId: string; campaignId: string }> }) {
  const { leadId: leadIdStr, campaignId: campaignIdStr } = await params;
  const body = await req.json().catch(() => ({}));
  const projectId = String(body.projectId || "").trim();
  if (!projectId) {
    return NextResponse.json({ error: "projectId required" }, { status: 400 });
  }

  const leadId = Number(leadIdStr);
  const campaignId = Number(campaignIdStr);
  const threadKey = `${leadId}:${campaignId}`;

  const allowed = await projectCampaignIds(projectId);
  if (!allowed.includes(campaignId)) {
    return NextResponse.json({ error: "Forbidden — campaign not in this project" }, { status: 403 });
  }

  await connectDB();

  if (body.action === "mark-read") {
    await InboxThread.updateOne({ threadKey }, { $set: { locallyReadAt: new Date() } });
    return NextResponse.json({ ok: true });
  }
  if (body.action === "mark-unread") {
    await InboxThread.updateOne({ threadKey }, { $set: { locallyReadAt: null } });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
