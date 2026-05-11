import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import OutboundCampaignOutcome from "@/lib/models/outbound/campaign-outcome";

// Operator records post-campaign outcomes (from Smartlead or manual entry).
// These rows feed Loop 2 (scoring → reply rate correlation) and Loop 6 (Tier-A ROI).
export async function POST(req: NextRequest) {
  await connectDB();
  const body = await req.json().catch(() => ({}));
  const runId = String(body.runId || "");
  const reviewer = String(body.reviewer || "").toLowerCase().trim();
  if (!runId) return NextResponse.json({ error: "runId required" }, { status: 400 });
  if (!reviewer) return NextResponse.json({ error: "reviewer required" }, { status: 400 });

  const num = (v: unknown) => Number.isFinite(Number(v)) ? Math.max(0, Math.floor(Number(v))) : 0;
  const updated = await OutboundCampaignOutcome.findOneAndUpdate(
    { runId },
    {
      $set: {
        postCampaign: {
          emailsSent: num(body.emailsSent),
          replies: num(body.replies),
          meetingsBooked: num(body.meetingsBooked),
          meetingsCompleted: num(body.meetingsCompleted),
          notes: String(body.notes || ""),
          recordedAt: new Date(),
          recordedBy: reviewer,
        },
        updatedAt: new Date(),
      },
    },
    { new: true },
  );
  if (!updated) return NextResponse.json({ error: "runId not found" }, { status: 404 });
  return NextResponse.json({ ok: true, runId, postCampaign: updated.postCampaign });
}

export async function GET(req: NextRequest) {
  await connectDB();
  const runId = req.nextUrl.searchParams.get("runId") || "";
  if (!runId) return NextResponse.json({ error: "runId required" }, { status: 400 });
  const doc = await OutboundCampaignOutcome.findOne({ runId }).lean<{ postCampaign?: Record<string, unknown> }>();
  if (!doc) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ runId, postCampaign: doc.postCampaign || null });
}
