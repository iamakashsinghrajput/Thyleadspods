import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import OutboundPilot from "@/lib/models/outbound/pilot";
import { llm } from "@/lib/onboarding/llm";

export const maxDuration = 120;

interface PilotForGen {
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
  inputs?: {
    targets?: string[];
    dnc?: string[];
    activeCustomers?: string[];
    pastMeetings?: string[];
    sellerDomains?: string[];
  };
  config?: { sellerName?: string; geoFocus?: string };
  totalLlmTokensIn?: number;
  totalLlmTokensOut?: number;
}

const SKILL_GEN_SYSTEM = `You are a senior outbound copy strategist. Your job is to produce a complete, production-ready SKILL.md document that will be used as the system prompt for Claude when it drafts cold emails for a specific client's outbound pilot.

A great SKILL.md is opinionated, calibrated to one client, and prescribes EVERY decision the email writer needs to make: subject line shape, greeting, body 1 / body 2 / body 3 structure, voice, paragraph weights, banned patterns, social-proof rules, and 5+ worked examples that the writer can pattern-match against. It is NOT a generic style guide.

Required structure (use these exact section headers):

---
\`\`\`
---
name: <kebab-case skill name>
description: One sentence explaining when to use this skill, naming the seller and the buyer geography/segment.
---
\`\`\`

# <Client name> Cold Email — <version>

## Why this version
Two short paragraphs. State what calibration data this is built on (target personas, pain points, USPs from the client brief). State what tradeoffs it makes vs generic cold-email playbooks.

## The canonical winner email (always reference this)
A complete, fully-written 90-130 word body 1 that follows every rule below. It must use the seller's actual product name, name three plausible social-proof customers from the brief's target segments, and reflect the brief's pain points and value angle. Include the subject line at the top in a code block.

## The 10 rules
Numbered 1-10. Each rule has a short heading, a 1-2 sentence rationale, and concrete "good" and "banned" examples. Cover: subject pattern; greeting; body 1 opener (first-person "I" voice + soft observation); naming the seller's product + stacking exactly three customer brands; reassurance + ease coda; CTA shape (low commitment, names the company + 20 min); body 2 (different capability, different angle, 70-110 words); body 3 (breakup, 50-90 words, no new pitch); banned tells (em dashes, spintax, vendor-pitch openers like "Quick question" / "I came across"); template-variable usage.

## Five worked examples
Five complete, distinct body 1 emails for plausible prospects in the brief's target segments. Each example varies the industry, the soft observation, and the social-proof brands. Show variety in CTA topic, but keep the shape constant.

## Validation checklist
A checklist of 8-12 items the writer can self-check against before shipping any email.

Hard rules for the SKILL.md you produce:
- Total length: 1800-3000 words. Substantive, not padded.
- No emojis anywhere.
- No em dashes. Use hyphens or rephrase.
- Plain markdown only. No HTML, no images.
- Every example must be specific to the client brief — no generic placeholders like "{company}" except where Smartlead variables genuinely belong (firstName, company in the CTA).
- Use exactly the seller name and product name provided in the brief. Do not invent capabilities or USPs the brief did not list.
- The three social-proof customer names you cite in examples should plausibly fit the brief's target segments. If the brief lists case-study wins, prefer those. Otherwise pick well-known Indian brands in the right segment.
- Output the complete SKILL.md document. No preamble, no closing remarks, no explanation. Start with the YAML frontmatter and end with the last line of the validation checklist.`;

function buildUserPrompt(p: PilotForGen): string {
  const cb = p.clientBrief || {};
  const cfg = p.config || {};
  const inp = p.inputs || {};
  const sellerName = cfg.sellerName || p.clientName || "Client";
  const geo = cfg.geoFocus || "India";

  const lines: string[] = [];
  lines.push(`Generate the SKILL.md for the outbound pilot below.`);
  lines.push(``);
  lines.push(`SELLER`);
  lines.push(`- Seller name: ${sellerName}`);
  lines.push(`- Geography focus: ${geo}`);
  lines.push(`- Product / one-line value: ${cb.sellerOneLineValue || "(not specified — derive from product description)"}`);
  lines.push(`- Product description: ${cb.sellerProduct || "(not specified)"}`);
  lines.push(``);
  lines.push(`CAPABILITIES (pick from these when stacking value angles)`);
  for (const c of cb.sellerCapabilities || []) lines.push(`- ${c}`);
  if ((cb.sellerCapabilities || []).length === 0) lines.push(`(none provided — use the product description above)`);
  lines.push(``);
  lines.push(`USPs (use these as differentiators in body 2)`);
  for (const u of cb.sellerUsps || []) lines.push(`- ${u}`);
  if ((cb.sellerUsps || []).length === 0) lines.push(`(none provided)`);
  lines.push(``);
  lines.push(`TARGET SEGMENTS`);
  for (const s of cb.targetSegments || []) lines.push(`- ${s}`);
  if ((cb.targetSegments || []).length === 0) lines.push(`(none — use generic mid-market Indian B2B)`);
  lines.push(``);
  lines.push(`TARGET PERSONAS (decision-maker titles — anchor body 1 to their pain)`);
  for (const t of cb.targetPersonas || []) lines.push(`- ${t}`);
  if ((cb.targetPersonas || []).length === 0) lines.push(`(none — assume Founder / CEO / Head of Growth / Head of Marketing)`);
  lines.push(``);
  lines.push(`COMMON PAINS THIS SELLER SOLVES (use one as the body 1 anchor, another for body 2)`);
  for (const pain of cb.commonPainsSolved || []) lines.push(`- ${pain}`);
  if ((cb.commonPainsSolved || []).length === 0) lines.push(`(none provided — derive from product description and segments)`);
  lines.push(``);
  lines.push(`CASE-STUDY WINS (preferred sources for the three social-proof brands in body 1)`);
  for (const c of cb.caseStudyWins || []) lines.push(`- ${c}`);
  if ((cb.caseStudyWins || []).length === 0) lines.push(`(none provided — pick well-known Indian brands matching the target segments)`);
  lines.push(``);
  lines.push(`ANTI-ICP (segments to avoid — banned in subject hooks and examples)`);
  for (const a of cb.antiIcp || []) lines.push(`- ${a}`);
  if ((cb.antiIcp || []).length === 0) lines.push(`(none specified)`);
  lines.push(``);
  if (cb.notes && cb.notes.trim()) {
    lines.push(`ADDITIONAL NOTES FROM CLIENT`);
    lines.push(cb.notes.trim());
    lines.push(``);
  }
  lines.push(`PIPELINE CONTEXT`);
  lines.push(`- Targets ingested: ${(inp.targets || []).length}`);
  lines.push(`- Active customers (excluded): ${(inp.activeCustomers || []).length}`);
  lines.push(`- DNC list: ${(inp.dnc || []).length}`);
  lines.push(`- Past meetings (excluded): ${(inp.pastMeetings || []).length}`);
  lines.push(``);
  lines.push(`Now produce the complete SKILL.md following the structure and rules in the system prompt. Output ONLY the document content. No preamble.`);
  return lines.join("\n");
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

  const doc = await OutboundPilot.findById(id).lean<PilotForGen>();
  if (!doc) return NextResponse.json({ error: "pilot not found" }, { status: 404 });

  const cb = doc.clientBrief || {};
  if (!cb.sellerProduct && !cb.sellerOneLineValue) {
    return NextResponse.json({ error: "Client brief is empty. Fill the Brief tab first (at minimum: product description and one-line value)." }, { status: 400 });
  }

  const userPrompt = buildUserPrompt(doc);
  const out = await llm({
    system: SKILL_GEN_SYSTEM,
    user: userPrompt,
    model: "sonnet",
    maxTokens: 8000,
    cacheSystem: true,
    mockOutput: "# SKILL.md\n\n(mock — set ANTHROPIC_API_KEY to generate)",
  });

  if (out.error) {
    return NextResponse.json({ error: `LLM error: ${out.error}` }, { status: 502 });
  }
  const text = (out.text || "").trim();
  if (!text || text.length < 800) {
    return NextResponse.json({ error: `Generated content too short (${text.length} chars). Try again or fill in more of the Client Brief.`, preview: text }, { status: 502 });
  }

  const inUsd = (out.inputTokens / 1_000_000) * 3;
  const outUsd = (out.outputTokens / 1_000_000) * 15;
  const usdCost = Math.round((inUsd + outUsd) * 1000) / 1000;

  await OutboundPilot.findByIdAndUpdate(id, {
    skillContent: text,
    skillVersion: "v9-ai",
    skillUpdatedBy: actorEmail || "ai",
    skillUpdatedAt: new Date(),
    totalLlmTokensIn: (doc.totalLlmTokensIn || 0) + out.inputTokens,
    totalLlmTokensOut: (doc.totalLlmTokensOut || 0) + out.outputTokens,
    updatedAt: new Date(),
  });

  return NextResponse.json({
    ok: true,
    skillContent: text,
    skillVersion: "v9-ai",
    chars: text.length,
    lines: text.split(/\r?\n/).length,
    inputTokens: out.inputTokens,
    outputTokens: out.outputTokens,
    model: out.model,
    isLive: out.isLive,
    usdCost,
  });
}
