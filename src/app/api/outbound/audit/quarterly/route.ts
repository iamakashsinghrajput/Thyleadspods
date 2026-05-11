import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import OutboundAuditLog from "@/lib/models/outbound/audit-log";

const AUDIT_ITEMS = [
  "competitor_list",
  "exclusion_universe",
  "social_proof_library",
  "observation_library",
  "scoring_weights",
  "anti_icp_patterns",
  "axis_3b_status",
];

const QUARTER_DAYS = 90;

export async function GET() {
  await connectDB();
  const allLogs = await OutboundAuditLog.find({ kind: "i3_quarterly" })
    .sort({ createdAt: -1 })
    .limit(200)
    .lean<Array<{ _id: { toString(): string }; scope: string; reviewer: string; notes: string; createdAt: Date }>>();

  const latestByItem = new Map<string, { reviewer: string; notes: string; reviewedAt: Date }>();
  for (const log of allLogs) {
    const itemKey = log.scope.replace(/^item:/, "");
    if (!latestByItem.has(itemKey)) {
      latestByItem.set(itemKey, { reviewer: log.reviewer, notes: log.notes, reviewedAt: log.createdAt });
    }
  }

  const now = Date.now();
  const status = AUDIT_ITEMS.map((item) => {
    const last = latestByItem.get(item);
    if (!last) return { item, lastReviewedAt: null, reviewer: "", daysSince: null, dueIn: -QUARTER_DAYS, overdue: true };
    const daysSince = Math.floor((now - new Date(last.reviewedAt).getTime()) / (1000 * 60 * 60 * 24));
    return {
      item,
      lastReviewedAt: last.reviewedAt,
      reviewer: last.reviewer,
      notes: last.notes,
      daysSince,
      dueIn: QUARTER_DAYS - daysSince,
      overdue: daysSince > QUARTER_DAYS,
    };
  });

  const overdue = status.filter((s) => s.overdue).map((s) => s.item);
  return NextResponse.json({ status, overdue, quarterDays: QUARTER_DAYS });
}

export async function POST(req: NextRequest) {
  await connectDB();
  const body = await req.json().catch(() => ({}));
  const reviewer = String(body.reviewer || "").toLowerCase().trim();
  const item = String(body.item || "");
  const notes = String(body.notes || "");
  if (!reviewer) return NextResponse.json({ error: "reviewer required" }, { status: 400 });
  if (!AUDIT_ITEMS.includes(item)) return NextResponse.json({ error: `item must be one of: ${AUDIT_ITEMS.join(", ")}` }, { status: 400 });

  const log = await OutboundAuditLog.create({
    kind: "i3_quarterly",
    scope: `item:${item}`,
    reviewer,
    notes,
    payload: {},
  });
  return NextResponse.json({ ok: true, id: String(log._id) });
}
