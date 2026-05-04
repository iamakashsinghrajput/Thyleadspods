import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import OutboundPilot from "@/lib/models/outbound/pilot";
import OutboundAccount from "@/lib/models/outbound/account";
import OutboundLead from "@/lib/models/outbound/lead";
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

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  await connectDB();
  const { id } = await ctx.params;
  const doc = (await OutboundPilot.findById(id).lean()) as PilotDoc | null;
  if (!doc) return NextResponse.json({ error: "not found" }, { status: 404 });

  const accounts = await OutboundAccount.find({ pilotId: id }).sort({ score: -1 }).limit(200).lean();
  const leads = await OutboundLead.find({ pilotId: id }).sort({ rank: 1 }).lean();

  return NextResponse.json({
    pilot: serialize(doc),
    accounts: accounts.map((a) => ({
      domain: a.domain, name: a.name, industry: a.industry,
      country: a.country, employees: a.estimatedNumEmployees,
      score: a.score, segment: a.segment, rank: a.rank,
      keywords: (a.keywords || []).slice(0, 5),
    })),
    leads: leads.map((l) => ({
      accountDomain: l.accountDomain, personKey: l.personKey || "",
      companyShort: l.companyShort,
      industry: l.industry, country: l.country, score: l.score, segment: l.segment,
      rank: l.rank, fullName: l.fullName, contactTitle: l.contactTitle,
      email: l.email, emailStatus: l.emailStatus, observationAngle: l.observationAngle,
      theirCustomers: l.theirCustomers || "", whatTheySell: l.whatTheySell || "",
      theirStage: l.theirStage || "", topPain: l.topPain || "", valueAngle: l.valueAngle || "",
      socialProofMatch: l.socialProofMatch || [], subjectTopic: l.subjectTopic || "",
      claudePrompt: l.claudePrompt || "",
      subject1: l.subject1, body1: l.body1,
      subject2: l.subject2, body2: l.body2,
      subject3: l.subject3, body3: l.body3,
      validationIssues: l.validationIssues || [], shippable: l.shippable,
    })),
  });
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  await connectDB();
  const { id } = await ctx.params;
  const body = await req.json();
  const actorRole = (body.actorRole || "").toLowerCase();
  if (actorRole !== "superadmin" && actorRole !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (body.config && typeof body.config === "object") patch.config = body.config;
  if (body.inputs && typeof body.inputs === "object") patch.inputs = body.inputs;
  if (typeof body.pilotName === "string") patch.pilotName = body.pilotName.trim();
  if (typeof body.status === "string") patch.status = body.status;
  await OutboundPilot.findByIdAndUpdate(id, patch);
  return NextResponse.json({ ok: true });
}
