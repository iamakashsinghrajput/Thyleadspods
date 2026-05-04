import { nameToToken } from "./phase1-ingest";
import type { PhaseState } from "../types";

export interface FilterInput {
  targets: string[];
  dnc: string[];
  activeCustomers: string[];
  pastMeetingTokens: string[];
  sellerDomains: string[];
}

export interface FilterOutput {
  eligible: string[];
  excluded: { domain: string; reason: string }[];
}

export function filterAgent(input: FilterInput): { output: FilterOutput; state: Pick<PhaseState, "log" | "metrics" | "inputCount" | "outputCount"> } {
  const dncSet = new Set(input.dnc);
  const activeSet = new Set(input.activeCustomers);
  const sellerSet = new Set(input.sellerDomains);
  const pastSet = new Set(input.pastMeetingTokens);

  const eligible: string[] = [];
  const excluded: { domain: string; reason: string }[] = [];

  let dncHits = 0, activeHits = 0, pastHits = 0, selfHits = 0;

  for (const domain of input.targets) {
    if (sellerSet.has(domain)) { excluded.push({ domain, reason: "self" }); selfHits++; continue; }
    if (dncSet.has(domain)) { excluded.push({ domain, reason: "dnc" }); dncHits++; continue; }
    if (activeSet.has(domain)) { excluded.push({ domain, reason: "active_customer" }); activeHits++; continue; }
    const root = nameToToken(domain.split(".")[0]);
    if (root && pastSet.has(root)) {
      excluded.push({ domain, reason: "past_meeting" });
      pastHits++;
      continue;
    }
    eligible.push(domain);
  }

  const log = [
    `${input.targets.length} targets in. ${eligible.length} eligible, ${excluded.length} excluded.`,
    `Excluded: ${selfHits} self, ${dncHits} DNC, ${activeHits} active customer, ${pastHits} past meeting.`,
  ];

  return {
    output: { eligible, excluded },
    state: {
      log,
      metrics: {
        eligible: eligible.length,
        excluded: excluded.length,
        dncHits, activeHits, pastHits, selfHits,
        eligibleRatePct: input.targets.length === 0 ? 0 : Math.round((eligible.length / input.targets.length) * 100),
      },
      inputCount: input.targets.length,
      outputCount: eligible.length,
    },
  };
}
