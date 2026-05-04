import type { LeadResearch, PhaseState, ScoredAccount, Stakeholder } from "../types";

export interface PromptBuildInput {
  rows: {
    account: ScoredAccount;
    stakeholder: Stakeholder;
    research: LeadResearch;
    email: string;
    emailStatus: string;
  }[];
  sellerName: string;
}

export interface CompiledPrompt {
  domain: string;
  personKey: string;
  fullName: string;
  prompt: string;
}

export interface PromptBuildOutput {
  prompts: CompiledPrompt[];
}

function joinList(items: string[] | undefined, sep = ", "): string {
  if (!items || items.length === 0) return "(none provided)";
  return items.join(sep);
}

export function buildLeadPrompt(args: {
  sellerName: string;
  account: ScoredAccount;
  stakeholder: Stakeholder;
  research: LeadResearch;
  email: string;
  emailStatus: string;
}): string {
  const { sellerName, account, stakeholder, research } = args;

  const lines: string[] = [];
  lines.push(`Write a 3-step cold email sequence for the lead below, following the SKILL.md style I've configured in this Claude project's instructions. The Client Brief (also in project instructions) tells you what ${sellerName} sells, who they target, and what pains they solve — use it as your map.`);
  lines.push("");
  lines.push("LEAD INFO");
  lines.push(`- First name: ${stakeholder.firstName || "(unknown)"}`);
  lines.push(`- Last name: ${stakeholder.lastName || ""}`);
  lines.push(`- Full name: ${stakeholder.fullName || ""}`);
  lines.push(`- Title: ${stakeholder.title || "(unknown)"}`);
  lines.push(`- Email: ${args.email || "(no verified email)"}${args.emailStatus ? ` [${args.emailStatus}]` : ""}`);
  lines.push(`- LinkedIn: ${stakeholder.linkedinUrl || "(none)"}`);
  lines.push("");
  lines.push("ACCOUNT");
  lines.push(`- Company: ${account.name}`);
  lines.push(`- Domain: ${account.domain}`);
  lines.push(`- Industry: ${account.industry || "(unknown)"}`);
  lines.push(`- Employees: ${account.estimatedNumEmployees || "(unknown)"}`);
  lines.push(`- Country: ${account.country || "(unknown)"}`);
  lines.push(`- Founded: ${account.foundedYear || "(unknown)"}`);
  if (account.shortDescription) lines.push(`- Apollo description: ${account.shortDescription}`);
  if (account.linkedinUrl) lines.push(`- Company LinkedIn: ${account.linkedinUrl}`);
  lines.push(`- Lead score: ${account.score} (${account.segment})`);
  lines.push("");
  lines.push("PER-LEAD RESEARCH (use only what's here, do NOT invent)");
  lines.push(`- What they sell: ${research.whatTheySell || "(no detail — paraphrase from the description above)"}`);
  lines.push(`- Their customers: ${research.theirCustomers || "(unknown — infer reasonably from segment + size)"}`);
  lines.push(`- Their stage: ${research.theirStage || "unknown"}`);
  lines.push(`- Top pain (THEIR specific situation): ${research.topPain || "(use a pain from the Client Brief that fits this segment)"}`);
  lines.push(`- Value angle (why ${sellerName} helps THEM): ${research.valueAngle || "(pick a capability from the Client Brief that maps to the top pain)"}`);
  lines.push(`- Soft observation (for body 1 opener): ${research.observationAngle || "(generate one based on their site)"}`);
  if (research.secondaryObservation) lines.push(`- Secondary observation (for body 2): ${research.secondaryObservation}`);
  if (research.signalForBody3) lines.push(`- Signal for body 3 breakup: ${research.signalForBody3}`);
  lines.push(`- Subject topic for subject 1: ${research.subjectTopic || "Improving Conversions"}`);
  lines.push(`- Social proof to use in body 1 (cite all three): ${joinList(research.socialProofMatch)}`);
  lines.push("");
  lines.push("OUTPUT FORMAT");
  lines.push("Return ONLY this JSON, no preamble, no explanation:");
  lines.push("{");
  lines.push(`  "subject_1": "${stakeholder.firstName || "{first_name}"}, <subject_topic from above>",`);
  lines.push(`  "body_1": "...",`);
  lines.push(`  "subject_2": "${stakeholder.firstName || "{first_name}"}, <different topic>",`);
  lines.push(`  "body_2": "...",`);
  lines.push(`  "subject_3": "${stakeholder.firstName || "{first_name}"}, <breakup topic>",`);
  lines.push(`  "body_3": "..."`);
  lines.push("}");
  lines.push("");
  lines.push("RULES (from SKILL in project instructions)");
  lines.push("- Body 1: 90-130 words, 3 paragraphs, must open \"I was checking out " + (account.name || "{company}") + "'s website and noticed...\" then connect to top_pain.");
  lines.push("- Body 1 paragraph 2 must say \"That's exactly what " + sellerName + " helps with\" and stack the three social-proof brands listed above (in that order).");
  lines.push("- Body 1 must include the reassurance line (\"Often, these don't require a full redesign. Even small, validated changes can create measurable improvements.\") and the ease coda (\"without heavy dev effort\").");
  lines.push("- Body 1 paragraph 3: a 15-25 word CTA naming \"" + (account.name || "{company}") + "\" and \"20 min\".");
  lines.push("- Body 2: 70-110 words, 2-3 paragraphs, light reference to body 1, DIFFERENT capability + DIFFERENT angle.");
  lines.push("- Body 3: 50-90 words, 2 paragraphs, breakup tone, no new pitch.");
  lines.push("- Subjects: 4-6 words, title-case, format \"" + (stakeholder.firstName || "{First Name}") + ", <Topic>\". 3 subjects must differ in topic.");
  lines.push("- No greetings, no sign-offs in any body. No em dashes. No spintax. No template variables.");

  return lines.join("\n");
}

export function promptBuildAgent(input: PromptBuildInput): { output: PromptBuildOutput; state: Pick<PhaseState, "log" | "metrics" | "inputCount" | "outputCount"> } {
  const prompts: CompiledPrompt[] = [];
  for (const row of input.rows) {
    const prompt = buildLeadPrompt({
      sellerName: input.sellerName,
      account: row.account,
      stakeholder: row.stakeholder,
      research: row.research,
      email: row.email,
      emailStatus: row.emailStatus,
    });
    prompts.push({ domain: row.account.domain, personKey: row.stakeholder.personKey || "", fullName: row.stakeholder.fullName, prompt });
  }
  const avgChars = prompts.length === 0 ? 0 : Math.round(prompts.reduce((a, p) => a + p.prompt.length, 0) / prompts.length);
  return {
    output: { prompts },
    state: {
      log: [
        `Built ${prompts.length} per-lead Claude prompts (paste-and-go).`,
        `Average prompt length: ${avgChars} chars.`,
        `Workflow: paste each prompt into a Claude Project that has SKILL.md + Client Brief as project instructions.`,
      ],
      metrics: { prompts: prompts.length, avgPromptChars: avgChars, mode: "claude-paste" },
      inputCount: input.rows.length,
      outputCount: prompts.length,
    },
  };
}
