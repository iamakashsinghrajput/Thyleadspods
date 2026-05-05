import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import OutboundPilot from "@/lib/models/outbound/pilot";
import OutboundLead from "@/lib/models/outbound/lead";
import { llm } from "@/lib/onboarding/llm";

export const maxDuration = 300;

interface PilotShape {
  pilotName?: string;
  clientName?: string;
  skillContent?: string;
  totalLlmTokensIn?: number;
  totalLlmTokensOut?: number;
  config?: { sellerName?: string };
}

const FALLBACK_SYSTEM = `You are an outbound copywriter. The user will give you a per-lead prompt and ask for a 3-step email sequence as JSON. Follow the lead prompt exactly. Output ONLY valid JSON of shape:
{ "subject_1": "...", "body_1": "...", "subject_2": "...", "body_2": "...", "subject_3": "...", "body_3": "..." }
No preamble, no markdown fences, no explanation.`;

const HAIKU_INPUT_PER_M = 1;
const HAIKU_OUTPUT_PER_M = 5;

function stripFences(s: string): string {
  let t = (s || "").trim();
  t = t.replace(/^```(?:json)?\s*/i, "");
  t = t.replace(/```\s*$/i, "");
  return t.trim();
}

function pickFirstObject(s: string): string {
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start >= 0 && end > start) return s.slice(start, end + 1);
  return s;
}

function pickField(obj: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

interface SeqFields {
  subject1: string; body1: string;
  subject2: string; body2: string;
  subject3: string; body3: string;
}

function parseSequence(raw: string): { ok: true; fields: SeqFields } | { ok: false; error: string } {
  if (!raw || !raw.trim()) return { ok: false, error: "empty response" };
  const body = pickFirstObject(stripFences(raw));
  let parsed: unknown;
  try { parsed = JSON.parse(body); }
  catch (e) { return { ok: false, error: `invalid JSON: ${e instanceof Error ? e.message : "unknown"}` }; }
  if (!parsed || typeof parsed !== "object") return { ok: false, error: "not a JSON object" };
  const obj = parsed as Record<string, unknown>;
  const fields: SeqFields = {
    subject1: pickField(obj, ["subject_1", "subject1", "Subject 1"]),
    body1: pickField(obj, ["body_1", "body1", "Body 1"]),
    subject2: pickField(obj, ["subject_2", "subject2", "Subject 2"]),
    body2: pickField(obj, ["body_2", "body2", "Body 2"]),
    subject3: pickField(obj, ["subject_3", "subject3", "Subject 3"]),
    body3: pickField(obj, ["body_3", "body3", "Body 3"]),
  };
  const missing: string[] = [];
  if (!fields.subject1) missing.push("subject_1");
  if (!fields.body1) missing.push("body_1");
  if (!fields.subject2) missing.push("subject_2");
  if (!fields.body2) missing.push("body_2");
  if (!fields.subject3) missing.push("subject_3");
  if (!fields.body3) missing.push("body_3");
  if (missing.length > 0) return { ok: false, error: `missing fields: ${missing.join(", ")}` };
  return { ok: true, fields };
}

interface LeadShape {
  _id: { toString(): string };
  accountDomain: string;
  personKey: string;
  fullName?: string;
  claudePrompt?: string;
  body1?: string;
  body2?: string;
  body3?: string;
  email?: string;
  emailStatus?: string;
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  await connectDB();
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const actorRole = (body.actorRole || "").toLowerCase();
  if (actorRole !== "superadmin" && actorRole !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const pilot = await OutboundPilot.findById(id).lean<PilotShape>();
  if (!pilot) return NextResponse.json({ error: "pilot not found" }, { status: 404 });

  const limit = Math.max(1, Math.min(500, Number(body.limit) || 100));
  const concurrency = Math.max(1, Math.min(10, Number(body.concurrency) || 5));
  const overwrite = !!body.overwrite;
  const isTest = !!body.isTest;
  const onlyWithEmail = body.onlyWithEmail !== false;
  const dataPilotId = isTest ? `${id}__test` : id;
  const onlyDomains: string[] | null = Array.isArray(body.onlyDomains) ? body.onlyDomains.map((s: unknown) => String(s).toLowerCase()) : null;

  const filter: Record<string, unknown> = { pilotId: dataPilotId, claudePrompt: { $ne: "" } };
  if (!overwrite) filter.body1 = "";
  if (onlyDomains && onlyDomains.length > 0) filter.accountDomain = { $in: onlyDomains };
  if (onlyWithEmail) {
    filter.email = { $ne: "" };
    filter.emailStatus = { $in: ["verified", "likely_to_engage"] };
  }

  const leads = (await OutboundLead.find(filter)
    .sort({ rank: 1 })
    .limit(limit)
    .lean()) as unknown as LeadShape[];

  if (leads.length === 0) {
    return NextResponse.json({
      ok: true,
      processed: 0, succeeded: 0, failed: 0, remaining: 0,
      log: ["No pending leads. Either drafts already exist (use overwrite=true) or no leads have a claudePrompt yet."],
    });
  }

  const systemPrompt = (pilot.skillContent && pilot.skillContent.trim().length > 200)
    ? pilot.skillContent
    : FALLBACK_SYSTEM;

  let succeeded = 0;
  let failed = 0;
  let totalIn = 0;
  let totalOut = 0;
  const errors: { domain: string; personKey: string; reason: string }[] = [];

  async function processOne(lead: LeadShape): Promise<void> {
    const userPrompt = `${lead.claudePrompt || ""}\n\nReturn ONLY valid JSON of shape: { "subject_1": "...", "body_1": "...", "subject_2": "...", "body_2": "...", "subject_3": "...", "body_3": "..." }. No preamble, no markdown fences, no explanation.`;
    try {
      const out = await llm({
        system: systemPrompt,
        user: userPrompt,
        model: "haiku",
        maxTokens: 2000,
        cacheSystem: true,
        jsonOnly: true,
        mockOutput: JSON.stringify({
          subject_1: `${lead.fullName || "there"}, Improving Conversions`,
          body_1: "Mock body 1 — set ANTHROPIC_API_KEY to generate live emails. This is a placeholder body that demonstrates the structure: an opener referencing the company, the seller's value, three social-proof brands, and a CTA naming the company and 20 min.",
          subject_2: `${lead.fullName || "there"}, Different Angle`,
          body_2: "Mock body 2 — different capability, different angle, lighter reference to body 1.",
          subject_3: `${lead.fullName || "there"}, Last Note`,
          body_3: "Mock body 3 — breakup tone, no new pitch, polite close.",
        }),
      });

      totalIn += out.inputTokens;
      totalOut += out.outputTokens;

      if (out.error) {
        errors.push({ domain: lead.accountDomain, personKey: lead.personKey, reason: `llm error: ${out.error}` });
        failed++;
        return;
      }

      const parsed = parseSequence(out.text);
      if (!parsed.ok) {
        errors.push({ domain: lead.accountDomain, personKey: lead.personKey, reason: parsed.error });
        failed++;
        return;
      }

      const status = String(lead.emailStatus || "").toLowerCase();
      const hasUsableEmail = !!lead.email && (status === "verified" || status === "likely_to_engage");
      await OutboundLead.updateOne(
        { _id: lead._id },
        { $set: { ...parsed.fields, shippable: hasUsableEmail, validationIssues: hasUsableEmail ? [] : ["no_verified_email"], updatedAt: new Date() } },
      );
      succeeded++;
    } catch (e) {
      errors.push({ domain: lead.accountDomain, personKey: lead.personKey, reason: e instanceof Error ? e.message : "unknown" });
      failed++;
    }
  }

  const queue = [...leads];
  async function worker() {
    while (queue.length > 0) {
      const lead = queue.shift();
      if (!lead) return;
      await processOne(lead);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => worker()));

  await OutboundPilot.findByIdAndUpdate(id, {
    totalLlmTokensIn: (pilot.totalLlmTokensIn || 0) + totalIn,
    totalLlmTokensOut: (pilot.totalLlmTokensOut || 0) + totalOut,
    updatedAt: new Date(),
  });

  const remainingFilter: Record<string, unknown> = { pilotId: dataPilotId, claudePrompt: { $ne: "" } };
  if (!overwrite) remainingFilter.body1 = "";
  const remaining = await OutboundLead.countDocuments(remainingFilter);

  const inUsd = (totalIn / 1_000_000) * HAIKU_INPUT_PER_M;
  const outUsd = (totalOut / 1_000_000) * HAIKU_OUTPUT_PER_M;
  const usdCost = Math.round((inUsd + outUsd) * 1000) / 1000;

  return NextResponse.json({
    ok: true,
    processed: leads.length,
    succeeded,
    failed,
    remaining,
    inputTokens: totalIn,
    outputTokens: totalOut,
    usdCost,
    model: "haiku",
    errors: errors.slice(0, 20),
  });
}
