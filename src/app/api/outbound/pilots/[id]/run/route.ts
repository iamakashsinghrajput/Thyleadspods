import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import OutboundPilot from "@/lib/models/outbound/pilot";
import { runPipelineSafe } from "@/lib/outbound/orchestrator";
import type { PhaseKey } from "@/lib/outbound/types";

export const maxDuration = 300;

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
  const testLimitRaw = Number(body.testLimit);
  const testLimit = Number.isFinite(testLimitRaw) && testLimitRaw > 0 ? Math.min(Math.floor(testLimitRaw), 100) : undefined;
  const phase8LimitRaw = Number(body.phase8AccountLimit);
  const phase8AccountLimit = Number.isFinite(phase8LimitRaw) && phase8LimitRaw > 0 ? Math.min(Math.floor(phase8LimitRaw), 2000) : undefined;
  const forceRegenerate = body.forceRegenerate === true;
  const accountLimitRaw = Number(body.accountLimit);
  const accountLimit = Number.isFinite(accountLimitRaw) && accountLimitRaw > 0 ? Math.min(Math.floor(accountLimitRaw), 2000) : undefined;
  const personalize = body.personalize === true;
  const coreSignalOnly = body.coreSignalOnly === true;
  const accountOffsetRaw = Number(body.accountOffset);
  const accountOffset = Number.isFinite(accountOffsetRaw) && accountOffsetRaw > 0 ? Math.min(Math.floor(accountOffsetRaw), 2000) : undefined;
  const accountDomains = Array.isArray(body.accountDomains)
    ? body.accountDomains.filter((d: unknown): d is string => typeof d === "string" && d.trim().length > 0).slice(0, 50)
    : undefined;

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

  await OutboundPilot.findByIdAndUpdate(id, {
    status: "running",
    cancelRequested: false,
    cancelRequestedAt: null,
    cancelRequestedBy: "",
    updatedAt: new Date(),
  });

  runPipelineSafe(id, { stopAfter, startFrom, testLimit, phase8AccountLimit, forceRegenerate, accountLimit, personalize, coreSignalOnly, accountOffset, accountDomains }).catch(async (err) => {
    await OutboundPilot.findByIdAndUpdate(id, {
      status: "failed",
      updatedAt: new Date(),
    });
    console.error("[outbound] pipeline failed", id, err);
  });

  return NextResponse.json({ ok: true, queued: true, status: "running" });
}
