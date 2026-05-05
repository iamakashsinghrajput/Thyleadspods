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

  const testPilotId = `${id}__test`;
  const [accounts, leads, testAccounts, testLeads] = await Promise.all([
    OutboundAccount.find({ pilotId: id }).sort({ score: -1 }).limit(200).lean(),
    OutboundLead.find({ pilotId: id }).sort({ rank: 1 }).lean(),
    OutboundAccount.find({ pilotId: testPilotId }).sort({ score: -1 }).limit(50).lean(),
    OutboundLead.find({ pilotId: testPilotId }).sort({ rank: 1 }).lean(),
  ]);

  const mapAccount = (a: Record<string, unknown>) => ({
    domain: a.domain as string,
    name: a.name as string,
    industry: a.industry as string,
    country: a.country as string,
    employees: (a.estimatedNumEmployees as number) || 0,
    score: (a.score as number) || 0,
    segment: (a.segment as string) || "",
    rank: (a.rank as number) || 0,
    keywords: ((a.keywords as string[]) || []).slice(0, 5),
  });
  const mapLead = (l: Record<string, unknown>) => ({
    accountDomain: l.accountDomain as string,
    personKey: (l.personKey as string) || "",
    companyShort: (l.companyShort as string) || "",
    industry: (l.industry as string) || "",
    country: (l.country as string) || "",
    score: (l.score as number) || 0,
    segment: (l.segment as string) || "",
    rank: (l.rank as number) || 0,
    fullName: (l.fullName as string) || "",
    contactTitle: (l.contactTitle as string) || "",
    email: (l.email as string) || "",
    emailStatus: (l.emailStatus as string) || "",
    observationAngle: (l.observationAngle as string) || "",
    theirCustomers: (l.theirCustomers as string) || "",
    whatTheySell: (l.whatTheySell as string) || "",
    theirStage: (l.theirStage as string) || "",
    topPain: (l.topPain as string) || "",
    valueAngle: (l.valueAngle as string) || "",
    socialProofMatch: (l.socialProofMatch as string[]) || [],
    subjectTopic: (l.subjectTopic as string) || "",
    claudePrompt: (l.claudePrompt as string) || "",
    subject1: (l.subject1 as string) || "",
    body1: (l.body1 as string) || "",
    subject2: (l.subject2 as string) || "",
    body2: (l.body2 as string) || "",
    subject3: (l.subject3 as string) || "",
    body3: (l.body3 as string) || "",
    validationIssues: (l.validationIssues as string[]) || [],
    shippable: !!l.shippable,
  });

  return NextResponse.json({
    pilot: serialize(doc),
    accounts: (accounts as unknown as Array<Record<string, unknown>>).map(mapAccount),
    leads: (leads as unknown as Array<Record<string, unknown>>).map(mapLead),
    testAccounts: (testAccounts as unknown as Array<Record<string, unknown>>).map(mapAccount),
    testLeads: (testLeads as unknown as Array<Record<string, unknown>>).map(mapLead),
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
