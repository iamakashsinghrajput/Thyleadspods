import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import OutboundPilot from "@/lib/models/outbound/pilot";
import { buildCalibrationSnapshot } from "@/lib/outbound/calibration-snapshot";

export async function GET(req: NextRequest) {
  await connectDB();
  const pilotId = req.nextUrl.searchParams.get("pilotId") || "";
  let sellerName = "VWO";
  if (pilotId) {
    const doc = await OutboundPilot.findById(pilotId).select("config").lean<{ config?: { sellerName?: string } }>();
    if (doc?.config?.sellerName) sellerName = doc.config.sellerName;
  }
  const snapshot = buildCalibrationSnapshot({ sellerName });
  return NextResponse.json({ snapshot });
}
