import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import OutboundPilot from "@/lib/models/outbound/pilot";

interface PilotDoc {
  pilotName?: string;
  clientName?: string;
  skillContent?: string;
  skillVersion?: string;
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
  config?: {
    sellerName?: string;
  };
}

function listBlock(title: string, items: string[] | undefined): string {
  if (!items || items.length === 0) return "";
  return `\n## ${title}\n\n${items.map((i) => `- ${i}`).join("\n")}\n`;
}

function clientSlug(s: string): string {
  return (s || "client").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  await connectDB();
  const { id } = await ctx.params;
  const doc = await OutboundPilot.findById(id).lean<PilotDoc>();
  if (!doc) return NextResponse.json({ error: "not found" }, { status: 404 });

  const sellerName = doc.config?.sellerName || doc.clientName || "the seller";
  const cb = doc.clientBrief || {};

  const sections: string[] = [];
  sections.push(`# Claude Project Instructions — ${sellerName} cold outbound`);
  sections.push("");
  sections.push(`Paste this entire document as the **project instructions** in a Claude.ai Project. Then for every lead, paste the per-lead context (the \`claude_prompt\` cell from the exported XLSX) into a new chat in this project. Claude will return the JSON sequence (subject_1, body_1, subject_2, body_2, subject_3, body_3) per the rules below.`);
  sections.push("");
  sections.push("---");
  sections.push("");
  sections.push("# PART 1 — Client Brief");
  sections.push("");

  if (cb.sellerProduct) {
    sections.push("## What the seller does\n");
    sections.push(cb.sellerProduct);
    sections.push("");
  }
  if (cb.sellerOneLineValue) {
    sections.push("## One-line value\n");
    sections.push(`> ${cb.sellerOneLineValue}`);
    sections.push("");
  }
  sections.push(listBlock("Capabilities (pick 3 per lead)", cb.sellerCapabilities));
  sections.push(listBlock("USPs", cb.sellerUsps));
  sections.push(listBlock("Target segments", cb.targetSegments));
  sections.push(listBlock("Target personas", cb.targetPersonas));
  sections.push(listBlock("Pains the seller solves (the menu)", cb.commonPainsSolved));
  sections.push(listBlock("Case-study wins (cite verbatim, segment-matched)", cb.caseStudyWins));
  sections.push(listBlock("Anti-ICP (refuse to draft for these — return error JSON)", cb.antiIcp));

  if (cb.notes) {
    sections.push("## Positioning notes\n");
    sections.push(cb.notes);
    sections.push("");
  }

  sections.push("");
  sections.push("---");
  sections.push("");
  sections.push("# PART 2 — Email style (SKILL)");
  sections.push("");
  sections.push(doc.skillContent || "(no SKILL.md set on this pilot — open the SKILL.md tab and paste your style guide.)");
  sections.push("");
  sections.push("---");
  sections.push("");
  sections.push("# PART 3 — Per-lead workflow");
  sections.push("");
  sections.push("For each lead I paste, do the following:");
  sections.push("");
  sections.push("1. Read the lead's `top_pain`, `value_angle`, `observation_angle`, `subject_topic`, and `social_proof_to_use` from the paste.");
  sections.push("2. If the lead matches anti-ICP (Part 1), respond with: `{ \"error\": \"ANTI-ICP\", \"reason\": \"<which anti-ICP rule matched>\" }`. Do not draft.");
  sections.push("3. Otherwise, write the 3-step sequence following the SKILL (Part 2). Output the JSON only — no preamble, no closing remarks, no markdown fences.");
  sections.push(`4. Subject 1 must be \`{first_name}, {subject_topic}\` (title-case). Subjects 2 and 3 must use different topics from subject 1.`);
  sections.push(`5. Body 1 must open \`I was checking out {company}'s website and noticed...\` and reference \`top_pain\` in the prospect's framing.`);
  sections.push(`6. Body 1 paragraph 2 must say "That's exactly what ${sellerName} helps with." then list the 3 social-proof brands in the order I sent.`);
  sections.push(`7. Include the reassurance line ("Often, these don't require a full redesign...") and the "without heavy dev effort" coda.`);
  sections.push(`8. CTA in body 1 paragraph 3 must contain "20 min" and the company name.`);
  sections.push(`9. No greetings, no sign-offs in any body. No em dashes. No spintax. No template variables in body.`);
  sections.push("");
  sections.push("That's the contract. Wait for me to paste a lead.");
  sections.push("");

  const body = sections.join("\n");
  const filename = `${clientSlug(sellerName)}_claude_project_instructions.md`;
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
