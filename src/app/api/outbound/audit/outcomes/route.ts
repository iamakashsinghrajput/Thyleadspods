import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import OutboundCampaignOutcome from "@/lib/models/outbound/campaign-outcome";

interface OutcomeDoc {
  _id: { toString(): string };
  pilotId: string;
  runId: string;
  startedAt: Date;
  completedAt: Date | null;
  status: string;
  calibrationSnapshot?: { skillVersion?: string; sellerName?: string; fiscalCalendarWindow?: string; coreSignalCreditsBudget?: number };
  inputs?: { coreSignalOnly?: boolean; testLimit?: number; accountLimit?: number };
  filterStats?: { eligible?: number; excluded?: number; groupHits?: number; antiIcpHits?: number };
  scoreStats?: { bucketHot?: number; bucketPriority?: number; bucketActive?: number; bucketNurture?: number; bucketExcluded?: number; avgScore?: number };
  emailStats?: { verified?: number; likely?: number; creditsUsed?: number };
  validationStats?: { shippable?: number; vwoIssues?: number };
  postCampaign?: { emailsSent?: number; replies?: number; meetingsBooked?: number };
}

export async function GET(req: NextRequest) {
  await connectDB();
  const format = (req.nextUrl.searchParams.get("format") || "json").toLowerCase();
  const pilotId = req.nextUrl.searchParams.get("pilotId") || "";
  const limit = Math.min(500, Math.max(10, Number(req.nextUrl.searchParams.get("limit") || "100")));

  const filter: Record<string, unknown> = {};
  if (pilotId) filter.pilotId = pilotId;

  const docs = await OutboundCampaignOutcome.find(filter)
    .sort({ startedAt: -1 })
    .limit(limit)
    .lean<OutcomeDoc[]>();

  if (format === "csv") {
    const headers = [
      "runId", "pilotId", "startedAt", "completedAt", "status",
      "skillVersion", "fiscalWindow",
      "coreSignalOnly", "testLimit",
      "eligible", "excluded", "groupHits", "antiIcpHits",
      "bucketHot", "bucketPriority", "bucketActive", "bucketNurture",
      "avgScore",
      "emailsVerified", "emailCreditsUsed",
      "shippable", "vwoIssues",
      "emailsSent", "replies", "meetingsBooked",
    ];
    const rows = docs.map((d) => [
      d.runId,
      d.pilotId,
      d.startedAt ? new Date(d.startedAt).toISOString() : "",
      d.completedAt ? new Date(d.completedAt).toISOString() : "",
      d.status,
      d.calibrationSnapshot?.skillVersion || "",
      d.calibrationSnapshot?.fiscalCalendarWindow || "",
      d.inputs?.coreSignalOnly ? "true" : "false",
      String(d.inputs?.testLimit || 0),
      String(d.filterStats?.eligible || 0),
      String(d.filterStats?.excluded || 0),
      String(d.filterStats?.groupHits || 0),
      String(d.filterStats?.antiIcpHits || 0),
      String(d.scoreStats?.bucketHot || 0),
      String(d.scoreStats?.bucketPriority || 0),
      String(d.scoreStats?.bucketActive || 0),
      String(d.scoreStats?.bucketNurture || 0),
      String(d.scoreStats?.avgScore || 0),
      String(d.emailStats?.verified || 0),
      String(d.emailStats?.creditsUsed || 0),
      String(d.validationStats?.shippable || 0),
      String(d.validationStats?.vwoIssues || 0),
      String(d.postCampaign?.emailsSent || 0),
      String(d.postCampaign?.replies || 0),
      String(d.postCampaign?.meetingsBooked || 0),
    ].map((v) => {
      const s = String(v);
      return s.includes(",") || s.includes("\"") ? `"${s.replace(/"/g, "\"\"")}"` : s;
    }).join(","));
    const csv = [headers.join(","), ...rows].join("\n");
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="vwo_campaign_outcomes_${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  }

  return NextResponse.json({ outcomes: docs.map((d) => ({ ...d, _id: String(d._id) })) });
}
