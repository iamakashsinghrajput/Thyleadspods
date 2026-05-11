import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import OutboundAuditLog from "@/lib/models/outbound/audit-log";
import { runOperatorReviewLoop } from "@/lib/outbound/operator-review-loop";

export async function GET(req: NextRequest) {
  await connectDB();
  const windowDays = Number(req.nextUrl.searchParams.get("windowDays") || "28");
  const pilotId = req.nextUrl.searchParams.get("pilotId") || undefined;
  const digest = await runOperatorReviewLoop({ windowDays, pilotId });
  return NextResponse.json({ digest });
}

export async function POST(req: NextRequest) {
  // Persist the digest as a loop_review audit log entry — operator records that they reviewed.
  await connectDB();
  const body = await req.json().catch(() => ({}));
  const reviewer = String(body.reviewer || "").toLowerCase().trim();
  const notes = String(body.notes || "");
  const windowDays = Number(body.windowDays || 28);
  if (!reviewer) return NextResponse.json({ error: "reviewer required" }, { status: 400 });

  const digest = await runOperatorReviewLoop({ windowDays });
  const log = await OutboundAuditLog.create({
    kind: "loop_review",
    scope: "global",
    reviewer,
    notes,
    payload: { digest },
  });
  return NextResponse.json({ ok: true, id: String(log._id), digest });
}
