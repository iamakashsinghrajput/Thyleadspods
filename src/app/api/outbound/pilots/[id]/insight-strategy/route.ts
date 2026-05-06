import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import OutboundPilot from "@/lib/models/outbound/pilot";
import { llm, extractJson } from "@/lib/onboarding/llm";

export const maxDuration = 60;

interface PilotShape {
  pilotName?: string;
  clientName?: string;
  clientBrief?: {
    sellerProduct?: string;
    sellerOneLineValue?: string;
    sellerCapabilities?: string[];
    sellerUsps?: string[];
    targetSegments?: string[];
    targetPersonas?: string[];
    commonPainsSolved?: string[];
    caseStudyWins?: string[];
    antiIcp?: string[];
    notes?: string;
  };
  config?: { championTitles?: string[]; sellerName?: string };
  insightStrategy?: InsightStrategy;
}

interface InsightStrategy {
  championTitles: string[];
  buyerJourneyTitles: string[];
  postKeywords: string[];
  intentSignalsToPrioritize: string[];
  jobTitleKeywordsHiring: string[];
  techStackToWatch: string[];
  rationale: string;
  generatedAt?: Date | null;
  generatedBy?: string;
  llmTokensIn?: number;
  llmTokensOut?: number;
}

const STRATEGY_SYSTEM = `You are a senior B2B intent-research strategist. Given a seller's product, USPs, target personas, and common pains, you decide WHICH LinkedIn / CoreSignal signals are the highest-value intent indicators for outbound to this specific client.

You output a structured strategy that downstream code uses to pull targeted member profiles, hiring signals, post/comment text, and tech-stack changes from CoreSignal — and to weight them when synthesizing per-account research.

Your strategy must be:
- HYPOTHESIS-DRIVEN. Each title/keyword/signal you pick should map to a specific buying signal you can articulate (e.g., "head of growth posting about checkout drop-off" → they own the metric this seller improves).
- SELLER-SPECIFIC. Don't list generic outbound titles. If the seller is a CRO platform, "Head of Growth" and "Director of CRO" are obvious; the value-add is finding NON-obvious ones (e.g., "Senior Lifecycle Marketing Manager" who owns retention metrics).
- BIASED TO INTENT. Prefer signals that indicate active need over signals that are static (a recent CRO hire > a long-tenured one; a job posting for a Head of Conversion > company size).

Output ONLY valid JSON. No prose. Schema:
{
  "championTitles": [string],          // 6-12 titles to search for at each prospect account, ranked by buying authority. These are the people we want to find via CoreSignal member search.
  "buyerJourneyTitles": [string],      // 4-8 titles that influence the buy decision but aren't the primary champion (e.g., CTO for a martech tool — needs to approve)
  "postKeywords": [string],            // 8-15 keywords/phrases. CoreSignal will pull recent posts/comments by champion-titled people; we filter to ones containing these keywords. Pick keywords that signal the pain, NOT generic industry terms.
  "intentSignalsToPrioritize": [string], // 5-10 named signals from this list, ranked by importance for THIS seller: "champion_recently_hired", "champion_posting_about_pain", "company_hiring_for_pain_role", "headcount_growth_high", "recent_funding", "new_executive_in_buying_function", "tech_stack_change", "expansion_to_new_segment", "new_product_launch"
  "jobTitleKeywordsHiring": [string],   // 5-10 fragments of job-posting titles that signal active pain (e.g., "Conversion Optimization", "A/B Testing", "Funnel"). When these appear in CoreSignal job postings, treat as a strong intent signal.
  "techStackToWatch": [string],        // 4-10 specific technologies whose presence/absence in the prospect's stack changes the pitch (competitors, complementary tools, prerequisites)
  "rationale": "1 short paragraph (3-5 sentences) explaining WHY these specific signals matter for THIS seller, written so a human SDR could read it and immediately understand the strategy."
}`;

function buildUser(p: PilotShape): string {
  const cb = p.clientBrief || {};
  const cfg = p.config || {};
  const sellerName = cfg.sellerName || p.clientName || "Client";
  const lines: string[] = [];
  lines.push(`Generate the LinkedIn / CoreSignal insight strategy for the seller below.`);
  lines.push(``);
  lines.push(`SELLER`);
  lines.push(`- Name: ${sellerName}`);
  lines.push(`- Product: ${cb.sellerProduct || "(not specified)"}`);
  lines.push(`- One-line value: ${cb.sellerOneLineValue || "(not specified)"}`);
  lines.push(``);
  lines.push(`CAPABILITIES`);
  for (const c of cb.sellerCapabilities || []) lines.push(`- ${c}`);
  if ((cb.sellerCapabilities || []).length === 0) lines.push(`(none provided)`);
  lines.push(``);
  lines.push(`USPs`);
  for (const u of cb.sellerUsps || []) lines.push(`- ${u}`);
  if ((cb.sellerUsps || []).length === 0) lines.push(`(none provided)`);
  lines.push(``);
  lines.push(`TARGET SEGMENTS`);
  for (const s of cb.targetSegments || []) lines.push(`- ${s}`);
  if ((cb.targetSegments || []).length === 0) lines.push(`(none provided)`);
  lines.push(``);
  lines.push(`TARGET PERSONAS (from brief — refine these into your championTitles output)`);
  for (const t of cb.targetPersonas || []) lines.push(`- ${t}`);
  if ((cb.targetPersonas || []).length === 0) lines.push(`(none provided — derive from product + capabilities)`);
  lines.push(``);
  lines.push(`COMMON PAINS THIS SELLER SOLVES`);
  for (const pain of cb.commonPainsSolved || []) lines.push(`- ${pain}`);
  if ((cb.commonPainsSolved || []).length === 0) lines.push(`(none provided — derive from capabilities)`);
  lines.push(``);
  lines.push(`CASE STUDY WINS (proof points)`);
  for (const c of cb.caseStudyWins || []) lines.push(`- ${c}`);
  if ((cb.caseStudyWins || []).length === 0) lines.push(`(none provided)`);
  lines.push(``);
  if ((cb.antiIcp || []).length > 0) {
    lines.push(`ANTI-ICP (avoid these)`);
    for (const a of cb.antiIcp || []) lines.push(`- ${a}`);
    lines.push(``);
  }
  if (cb.notes && cb.notes.trim()) {
    lines.push(`NOTES FROM CLIENT`);
    lines.push(cb.notes.trim());
    lines.push(``);
  }
  lines.push(`Now produce the JSON strategy following the schema in the system prompt. Output ONLY JSON. No preamble, no markdown fences.`);
  return lines.join("\n");
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  await connectDB();
  const { id } = await ctx.params;
  const doc = await OutboundPilot.findById(id).select({ insightStrategy: 1 }).lean<{ insightStrategy?: InsightStrategy }>();
  if (!doc) return NextResponse.json({ error: "pilot not found" }, { status: 404 });
  return NextResponse.json({ strategy: doc.insightStrategy || null });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  await connectDB();
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const actorRole = (body.actorRole || "").toLowerCase();
  const actorEmail = (body.actorEmail || "").toLowerCase();
  if (actorRole !== "superadmin" && actorRole !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const doc = await OutboundPilot.findById(id).lean<PilotShape>();
  if (!doc) return NextResponse.json({ error: "pilot not found" }, { status: 404 });
  const cb = doc.clientBrief || {};
  if (!cb.sellerProduct && !cb.sellerOneLineValue) {
    return NextResponse.json({ error: "Client brief is empty. Fill the Brief tab first (at minimum: product description and one-line value)." }, { status: 400 });
  }

  const user = buildUser(doc);
  const out = await llm({
    system: STRATEGY_SYSTEM,
    user,
    model: "sonnet",
    maxTokens: 1800,
    cacheSystem: true,
    jsonOnly: true,
    mockOutput: JSON.stringify({
      championTitles: ["Head of Growth", "VP Marketing", "Director of CRO"],
      buyerJourneyTitles: ["CMO", "CTO"],
      postKeywords: ["conversion", "checkout", "A/B test"],
      intentSignalsToPrioritize: ["champion_recently_hired", "company_hiring_for_pain_role"],
      jobTitleKeywordsHiring: ["Conversion", "Funnel"],
      techStackToWatch: [],
      rationale: "(mock — set ANTHROPIC_API_KEY for live strategy)",
    }),
  });

  if (out.error) return NextResponse.json({ error: `LLM error: ${out.error}` }, { status: 502 });

  const parsed = extractJson<Partial<InsightStrategy>>(out.text, {});
  if (!parsed || !Array.isArray(parsed.championTitles) || parsed.championTitles.length === 0) {
    return NextResponse.json({ error: "LLM returned an invalid strategy", preview: out.text.slice(0, 400) }, { status: 502 });
  }

  const strategy: InsightStrategy = {
    championTitles: (parsed.championTitles || []).slice(0, 12).map(String),
    buyerJourneyTitles: (parsed.buyerJourneyTitles || []).slice(0, 8).map(String),
    postKeywords: (parsed.postKeywords || []).slice(0, 15).map(String),
    intentSignalsToPrioritize: (parsed.intentSignalsToPrioritize || []).slice(0, 10).map(String),
    jobTitleKeywordsHiring: (parsed.jobTitleKeywordsHiring || []).slice(0, 10).map(String),
    techStackToWatch: (parsed.techStackToWatch || []).slice(0, 10).map(String),
    rationale: String(parsed.rationale || "").slice(0, 1200),
    generatedAt: new Date(),
    generatedBy: actorEmail,
    llmTokensIn: out.inputTokens,
    llmTokensOut: out.outputTokens,
  };

  await OutboundPilot.findByIdAndUpdate(id, { insightStrategy: strategy, updatedAt: new Date() });

  const inUsd = (out.inputTokens / 1_000_000) * 3;
  const outUsd = (out.outputTokens / 1_000_000) * 15;
  const usdCost = Math.round((inUsd + outUsd) * 1000) / 1000;

  return NextResponse.json({ ok: true, strategy, model: out.model, isLive: out.isLive, usdCost });
}
