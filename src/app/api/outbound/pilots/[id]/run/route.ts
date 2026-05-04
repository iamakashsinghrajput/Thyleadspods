import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import OutboundPilot from "@/lib/models/outbound/pilot";
import { runPipelineSafe } from "@/lib/outbound/orchestrator";
import type { PhaseKey } from "@/lib/outbound/types";

export const maxDuration = 800;

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  await connectDB();
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const actorRole = (body.actorRole || "").toLowerCase();
  if (actorRole !== "superadmin" && actorRole !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const stopAfter: PhaseKey | undefined = typeof body.stopAfter === "string" ? body.stopAfter as PhaseKey : undefined;
  const startFrom: PhaseKey | undefined = typeof body.startFrom === "string" ? body.startFrom as PhaseKey : undefined;

  const exists = await OutboundPilot.findById(id).lean<{ _id: unknown; pilotName?: string; phases?: Array<{ key: string; status: string }> }>();
  if (!exists) return NextResponse.json({ error: "pilot not found" }, { status: 404 });

  if (startFrom) {
    const PHASE_ORDER = ["ingest", "filter", "subset", "enrich", "score", "stakeholder", "email_match", "research", "draft", "validate", "export"];
    const startIdx = PHASE_ORDER.indexOf(startFrom);
    if (startIdx < 0) return NextResponse.json({ error: `unknown startFrom phase: ${startFrom}` }, { status: 400 });
    const phaseMap = new Map((exists.phases || []).map((p) => [p.key, p.status]));
    for (let i = 0; i < startIdx; i++) {
      const upstream = PHASE_ORDER[i];
      if (phaseMap.get(upstream) !== "complete") {
        return NextResponse.json({
          error: `cannot start from "${startFrom}" — upstream phase "${upstream}" is "${phaseMap.get(upstream) || "pending"}". Run it first.`,
        }, { status: 400 });
      }
    }
  }

  runPipelineSafe(id, { stopAfter, startFrom }).catch(async (err) => {
    await OutboundPilot.findByIdAndUpdate(id, {
      status: "failed",
      updatedAt: new Date(),
    });
    console.error("[outbound] pipeline failed", id, err);
  });

  return NextResponse.json({ ok: true, queued: true });
}
