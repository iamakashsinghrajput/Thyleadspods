import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import OutboundPilot from "@/lib/models/outbound/pilot";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  await connectDB();
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const actorRole = (body.actorRole || "").toLowerCase();
  if (actorRole !== "superadmin" && actorRole !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const actorEmail = (body.actorEmail || "").toString().toLowerCase();

  const r = await OutboundPilot.findByIdAndUpdate(id, {
    cancelRequested: true,
    cancelRequestedAt: new Date(),
    cancelRequestedBy: actorEmail,
    updatedAt: new Date(),
  });
  if (!r) return NextResponse.json({ error: "pilot not found" }, { status: 404 });
  return NextResponse.json({ ok: true, message: "Stop requested. The orchestrator will halt at the next phase or batch boundary (typically <30s)." });
}
