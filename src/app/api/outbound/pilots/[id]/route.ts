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
  hasCsv?: boolean;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface PhaseLite { key?: string; status?: string; startedAt?: Date | string | null; completedAt?: Date | string | null; durationMs?: number; inputCount?: number; outputCount?: number; error?: string; apolloCreditsUsed?: number; llmTokensIn?: number; llmTokensOut?: number }

function serialize(d: PilotDoc) {
  const phases = (Array.isArray(d.phases) ? d.phases : []) as PhaseLite[];
  const slim = phases.map((p) => ({
    key: p.key || "",
    status: p.status || "pending",
    startedAt: p.startedAt || null,
    completedAt: p.completedAt || null,
    durationMs: p.durationMs || 0,
    inputCount: p.inputCount || 0,
    outputCount: p.outputCount || 0,
    metrics: {},
    log: [],
    error: p.error || "",
    apolloCreditsUsed: p.apolloCreditsUsed || 0,
    llmTokensIn: p.llmTokensIn || 0,
    llmTokensOut: p.llmTokensOut || 0,
  }));
  return {
    id: String(d._id),
    clientName: d.clientName || "VWO",
    pilotName: d.pilotName,
    status: d.status || "draft",
    config: d.config || {},
    inputs: d.inputs || {},
    phases: ensurePhases(slim as never),
    totalApolloCredits: d.totalApolloCredits || 0,
    totalLlmTokensIn: d.totalLlmTokensIn || 0,
    totalLlmTokensOut: d.totalLlmTokensOut || 0,
    hasCsv: !!d.hasCsv,
    createdBy: d.createdBy || "",
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  };
}

const LEAD_LIST_PROJECTION = {
  accountDomain: 1, personKey: 1,
  companyShort: 1, industry: 1, country: 1,
  score: 1, segment: 1, rank: 1,
  fullName: 1, contactTitle: 1,
  email: 1, emailStatus: 1,
  observationAngle: 1, theirCustomers: 1, whatTheySell: 1, theirStage: 1,
  topPain: 1, valueAngle: 1, socialProofMatch: 1, subjectTopic: 1,
  subject1: 1, subject2: 1, subject3: 1,
  validationIssues: 1, shippable: 1,
  buyingHypothesis: 1, shouldEmail: 1, shouldEmailReason: 1, confidenceLevel: 1,
  buyerSignalScore: 1, evidenceList: 1,
  socialAngle: 1, personEvidence: 1, icpRole: 1, contactLinkedinUrl: 1,
  claudePromptLen: { $strLenCP: { $ifNull: ["$claudePrompt", ""] } },
  body1Len: { $strLenCP: { $ifNull: ["$body1", ""] } },
  body2Len: { $strLenCP: { $ifNull: ["$body2", ""] } },
  body3Len: { $strLenCP: { $ifNull: ["$body3", ""] } },
} as const;

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  await connectDB();
  const { id } = await ctx.params;
  const testPilotId = `${id}__test`;

  const [pilotAgg, accounts, leads, testAccounts, testLeads] = await Promise.all([
    OutboundPilot.aggregate([
      { $match: { _id: new (await import("mongoose")).default.Types.ObjectId(id) } },
      { $project: {
        clientName: 1, pilotName: 1, status: 1,
        config: 1, inputs: 1,
        totalApolloCredits: 1, totalLlmTokensIn: 1, totalLlmTokensOut: 1,
        createdBy: 1, createdAt: 1, updatedAt: 1,
        hasCsv: { $gt: [{ $strLenCP: { $ifNull: ["$finalCsv", ""] } }, 0] },
        phases: 1,
      } },
      { $limit: 1 },
    ]),
    OutboundAccount.find({ pilotId: id }).sort({ score: -1 }).limit(200).select({ domain: 1, name: 1, industry: 1, country: 1, estimatedNumEmployees: 1, score: 1, segment: 1, rank: 1, keywords: 1 }).lean(),
    OutboundLead.aggregate([
      { $match: { pilotId: id } },
      { $sort: { rank: 1 } },
      { $project: LEAD_LIST_PROJECTION },
    ]),
    OutboundAccount.find({ pilotId: testPilotId }).sort({ score: -1 }).limit(50).select({ domain: 1, name: 1, industry: 1, country: 1, estimatedNumEmployees: 1, score: 1, segment: 1, rank: 1, keywords: 1 }).lean(),
    OutboundLead.aggregate([
      { $match: { pilotId: testPilotId } },
      { $sort: { rank: 1 } },
      { $project: LEAD_LIST_PROJECTION },
    ]),
  ]);

  const doc = (pilotAgg[0] || null) as PilotDoc | null;
  if (!doc) return NextResponse.json({ error: "not found" }, { status: 404 });

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
  const mapLead = (l: Record<string, unknown>) => {
    const promptLen = (l.claudePromptLen as number) || 0;
    const b1 = (l.body1Len as number) || 0;
    const b2 = (l.body2Len as number) || 0;
    const b3 = (l.body3Len as number) || 0;
    return {
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
      claudePrompt: "",
      subject1: (l.subject1 as string) || "",
      body1: "",
      subject2: (l.subject2 as string) || "",
      body2: "",
      subject3: (l.subject3 as string) || "",
      body3: "",
      validationIssues: (l.validationIssues as string[]) || [],
      shippable: !!l.shippable,
      hasPrompt: promptLen > 0,
      hasFullSequence: b1 > 0 && b2 > 0 && b3 > 0,
      buyingHypothesis: (l.buyingHypothesis as string) || "",
      shouldEmail: (l.shouldEmail as string) || "",
      shouldEmailReason: (l.shouldEmailReason as string) || "",
      confidenceLevel: (l.confidenceLevel as string) || "",
      buyerSignalScore: (l.buyerSignalScore as number) || 0,
      evidenceList: (l.evidenceList as string[]) || [],
      socialAngle: (l.socialAngle as string) || "",
      personEvidence: (l.personEvidence as string[]) || [],
      icpRole: (l.icpRole as string) || "",
      contactLinkedinUrl: (l.contactLinkedinUrl as string) || "",
    };
  };

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
