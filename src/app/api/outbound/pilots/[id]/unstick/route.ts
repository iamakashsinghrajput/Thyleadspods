import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import OutboundPilot from "@/lib/models/outbound/pilot";

interface PhaseDoc {
  key?: string;
  status?: string;
  startedAt?: Date | null;
  completedAt?: Date | null;
  durationMs?: number;
  log?: string[];
  error?: string;
  inputCount?: number;
  outputCount?: number;
  metrics?: Record<string, unknown>;
  apolloCreditsUsed?: number;
  llmTokensIn?: number;
  llmTokensOut?: number;
  artifactKey?: string;
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  await connectDB();
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const actorRole = (body.actorRole || "").toLowerCase();
  if (actorRole !== "superadmin" && actorRole !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const actorEmail = (body.actorEmail || "").toString().toLowerCase();

  const doc = (await OutboundPilot.findById(id).lean()) as { phases?: PhaseDoc[]; status?: string } | null;
  if (!doc) return NextResponse.json({ error: "pilot not found" }, { status: 404 });

  const now = new Date();
  const phases = (Array.isArray(doc.phases) ? doc.phases : []).map((p) => {
    if (p.status === "running") {
      const log = Array.isArray(p.log) ? [...p.log] : [];
      log.push(`Force-unstuck by ${actorEmail || "admin"} at ${now.toISOString()}.`);
      return { ...p, status: "failed", error: "Force-unstuck (process was killed externally)", completedAt: now, log };
    }
    return p;
  });

  await OutboundPilot.findByIdAndUpdate(id, {
    phases,
    status: "paused",
    cancelRequested: false,
    cancelRequestedAt: null,
    cancelRequestedBy: "",
    updatedAt: now,
  });

  return NextResponse.json({
    ok: true,
    cleared: phases.filter((p) => p.status === "failed" && p.error?.includes("Force-unstuck")).length,
    message: "Pilot status reset to paused. You can now resume from any phase.",
  });
}
