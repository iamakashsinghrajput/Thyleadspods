import type { PhaseState } from "../types";

export interface ValidateInput {
  prompts: { domain: string; personKey: string; fullName: string; prompt: string; hasEmail: boolean }[];
}

export interface ValidationReport {
  domain: string;
  personKey: string;
  fullName: string;
  prompt: string;
  hasEmail: boolean;
  shippable: boolean;
  reason: string;
}

export interface ValidateOutput {
  reports: ValidationReport[];
  shippableCount: number;
  noEmailCount: number;
  shortPromptCount: number;
}

const MIN_PROMPT_CHARS = 600;

export function validateAgent(input: ValidateInput): { output: ValidateOutput; state: Pick<PhaseState, "log" | "metrics" | "inputCount" | "outputCount"> } {
  const reports: ValidationReport[] = [];
  let shippableCount = 0;
  let noEmailCount = 0;
  let shortPromptCount = 0;

  for (const p of input.prompts) {
    const reasons: string[] = [];
    if (!p.hasEmail) { reasons.push("no_verified_email"); noEmailCount++; }
    if ((p.prompt || "").length < MIN_PROMPT_CHARS) { reasons.push("prompt_too_short"); shortPromptCount++; }
    const shippable = reasons.length === 0;
    if (shippable) shippableCount++;
    reports.push({
      domain: p.domain,
      personKey: p.personKey,
      fullName: p.fullName,
      prompt: p.prompt,
      hasEmail: p.hasEmail,
      shippable,
      reason: reasons.join(","),
    });
  }

  return {
    output: { reports, shippableCount, noEmailCount, shortPromptCount },
    state: {
      log: [
        `${input.prompts.length} leads checked. ${shippableCount} ready to paste, ${noEmailCount} missing email, ${shortPromptCount} prompt too short.`,
      ],
      metrics: { shippable: shippableCount, noEmail: noEmailCount, shortPrompt: shortPromptCount, total: input.prompts.length },
      inputCount: input.prompts.length,
      outputCount: shippableCount,
    },
  };
}
