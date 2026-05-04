import type { PhaseState } from "../types";

export interface IngestInput {
  rawTargets: string;
  rawDnc: string;
  rawActiveCustomers: string;
  rawPastMeetings: string;
  rawSellerDomains: string;
}

export interface IngestOutput {
  targets: string[];
  dnc: string[];
  activeCustomers: string[];
  pastMeetings: string[];
  sellerDomains: string[];
  pastMeetingTokens: string[];
}

export function nameToToken(n: string): string {
  return n
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/,/g, "")
    .replace(/'/g, "")
    .replace(/&/g, "and")
    .replace(/\s+/g, "")
    .replace(/-/g, "")
    .slice(0, 25);
}

export function normalizeDomain(input: string): string {
  let d = input.trim().toLowerCase();
  if (!d) return "";
  d = d.replace(/^https?:\/\//, "");
  d = d.replace(/^www\./, "");
  d = d.split("/")[0];
  d = d.split("?")[0];
  return d;
}

function splitLines(s: string): string[] {
  return s.split(/[\r\n,]+/).map((x) => x.trim()).filter(Boolean);
}

export function ingestAgent(input: IngestInput): { output: IngestOutput; state: Pick<PhaseState, "log" | "metrics" | "inputCount" | "outputCount"> } {
  const log: string[] = [];
  const targetsRaw = splitLines(input.rawTargets);
  const dncRaw = splitLines(input.rawDnc);
  const activeRaw = splitLines(input.rawActiveCustomers);
  const pastRaw = splitLines(input.rawPastMeetings);
  const sellerRaw = splitLines(input.rawSellerDomains);

  const targets = Array.from(new Set(targetsRaw.map(normalizeDomain).filter(Boolean)));
  const dnc = Array.from(new Set(dncRaw.map(normalizeDomain).filter(Boolean)));
  const activeCustomers = Array.from(new Set(activeRaw.map(normalizeDomain).filter(Boolean)));
  const pastMeetings = Array.from(new Set(pastRaw.map((s) => s.toLowerCase()).filter(Boolean)));
  const sellerDomains = Array.from(new Set(sellerRaw.map(normalizeDomain).filter(Boolean)));
  const pastMeetingTokens = Array.from(new Set(pastMeetings.map(nameToToken).filter(Boolean)));

  log.push(`Parsed ${targets.length} targets, ${dnc.length} DNC, ${activeCustomers.length} active customers, ${pastMeetings.length} past meetings, ${sellerDomains.length} seller domains.`);
  if (targets.length === 0) log.push("WARN: target list is empty.");

  return {
    output: { targets, dnc, activeCustomers, pastMeetings, sellerDomains, pastMeetingTokens },
    state: {
      log,
      metrics: {
        targets: targets.length,
        dnc: dnc.length,
        activeCustomers: activeCustomers.length,
        pastMeetings: pastMeetings.length,
        sellerDomains: sellerDomains.length,
      },
      inputCount: targetsRaw.length + dncRaw.length + activeRaw.length + pastRaw.length + sellerRaw.length,
      outputCount: targets.length,
    },
  };
}
