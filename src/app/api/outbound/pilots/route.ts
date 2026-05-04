import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import OutboundPilot from "@/lib/models/outbound/pilot";
import { ensurePhases } from "@/lib/outbound/orchestrator";

interface PilotDoc {
  _id: { toString(): string };
  clientName?: string;
  pilotName: string;
  status?: string;
  config?: Record<string, unknown>;
  inputs?: Record<string, unknown>;
  phases?: unknown[];
  totalApolloCredits?: number;
  totalLlmTokensIn?: number;
  totalLlmTokensOut?: number;
  finalCsv?: string;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

function serialize(d: PilotDoc) {
  return {
    id: String(d._id),
    clientName: d.clientName || "VWO",
    pilotName: d.pilotName,
    status: d.status || "draft",
    config: d.config || {},
    inputs: d.inputs || {},
    phases: ensurePhases(d.phases as never),
    totalApolloCredits: d.totalApolloCredits || 0,
    totalLlmTokensIn: d.totalLlmTokensIn || 0,
    totalLlmTokensOut: d.totalLlmTokensOut || 0,
    hasCsv: !!d.finalCsv,
    createdBy: d.createdBy || "",
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  };
}

export async function GET() {
  await connectDB();
  const docs = (await OutboundPilot.find({}).sort({ updatedAt: -1 }).lean()) as unknown as PilotDoc[];
  return NextResponse.json({ pilots: docs.map(serialize) });
}

export async function POST(req: NextRequest) {
  await connectDB();
  const body = await req.json();
  const actorRole = (body.actorRole || "").toLowerCase();
  if (actorRole !== "superadmin" && actorRole !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!body.pilotName) return NextResponse.json({ error: "pilotName required" }, { status: 400 });
  const doc = await OutboundPilot.create({
    clientName: body.clientName || "VWO",
    pilotName: String(body.pilotName).trim(),
    createdBy: (body.createdBy || "").toLowerCase(),
    status: "draft",
  });
  return NextResponse.json({ id: String(doc._id) });
}

export async function DELETE(req: NextRequest) {
  await connectDB();
  const actorRole = (req.nextUrl.searchParams.get("actorRole") || "").toLowerCase();
  if (actorRole !== "superadmin" && actorRole !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const id = req.nextUrl.searchParams.get("id") || "";
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const { default: OutboundAccount } = await import("@/lib/models/outbound/account");
  const { default: OutboundLead } = await import("@/lib/models/outbound/lead");
  await Promise.all([
    OutboundAccount.deleteMany({ pilotId: id }),
    OutboundLead.deleteMany({ pilotId: id }),
  ]);
  await OutboundPilot.findByIdAndDelete(id);
  return NextResponse.json({ ok: true });
}
