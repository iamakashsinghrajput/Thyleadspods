import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import OutboundAuditLog from "@/lib/models/outbound/audit-log";
import OutboundPilot from "@/lib/models/outbound/pilot";
import { buildCalibrationSnapshot } from "@/lib/outbound/calibration-snapshot";

export async function POST(req: NextRequest) {
  await connectDB();
  const body = await req.json().catch(() => ({}));
  const reviewer = String(body.reviewer || "").toLowerCase().trim();
  const pilotId = String(body.pilotId || "");
  const notes = String(body.notes || "");
  if (!reviewer) return NextResponse.json({ error: "reviewer required" }, { status: 400 });
  if (!pilotId) return NextResponse.json({ error: "pilotId required" }, { status: 400 });

  const pilot = await OutboundPilot.findById(pilotId).select("config").lean<{ config?: { sellerName?: string } }>();
  const sellerName = pilot?.config?.sellerName || "VWO";
  const snapshot = buildCalibrationSnapshot({ sellerName });

  const log = await OutboundAuditLog.create({
    kind: "i1_sign_off",
    scope: `pilot:${pilotId}`,
    skillVersion: snapshot.skillVersion,
    reviewer,
    notes,
    payload: { snapshot },
  });

  return NextResponse.json({ ok: true, id: String(log._id), snapshot });
}

export async function GET(req: NextRequest) {
  await connectDB();
  const pilotId = req.nextUrl.searchParams.get("pilotId") || "";
  if (!pilotId) return NextResponse.json({ error: "pilotId required" }, { status: 400 });
  const latest = await OutboundAuditLog.findOne({ kind: "i1_sign_off", scope: `pilot:${pilotId}` })
    .sort({ createdAt: -1 })
    .lean<{ _id: { toString(): string }; reviewer: string; notes: string; skillVersion: string; createdAt: Date }>();
  return NextResponse.json({ latest: latest ? { id: String(latest._id), reviewer: latest.reviewer, notes: latest.notes, skillVersion: latest.skillVersion, signedAt: latest.createdAt } : null });
}
