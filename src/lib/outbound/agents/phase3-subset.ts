import type { PhaseState } from "../types";

export interface SubsetInput {
  eligible: string[];
  priorityTlds: string[];
  enrichSubsetCap: number;
}

export interface SubsetOutput {
  subset: string[];
  batches: string[][];
  priorityCount: number;
  comD2cCount: number;
  otherCount: number;
}

const NEGATIVE_PATTERNS = [
  /news/, /tv\d/, /\d+tv/, /lottery/, /sambad/,
  /lyrics/, /wallpaper/, /songs/, /music/, /astro/, /puja/,
  /matrimon/, /matka/, /satta/, /free.*alert/, /jobalert/,
  /cricket(score)?/, /cinema/, /movies?/, /film/, /mp3/, /apk/,
  /panchang/, /horoscope/, /kundli/, /jyotish/,
  /bollywood/, /tollywood/, /showbiz/, /meme/,
  /xxx/, /porn/, /^win/, /^cash/, /^earn/,
];

function tldOf(d: string): string {
  const parts = d.toLowerCase().split(".");
  if (parts.length < 2) return "";
  if (parts.length >= 3 && parts[parts.length - 2].length <= 3) {
    return parts.slice(-2).join(".");
  }
  return parts[parts.length - 1];
}

function isFiltered(d: string): boolean {
  return NEGATIVE_PATTERNS.some((re) => re.test(d.toLowerCase()));
}

function looksD2cCom(d: string): boolean {
  const root = d.split(".")[0];
  return root.length <= 18 && !/\d/.test(root);
}

function deterministicShuffle<T>(arr: T[], seed: string): T[] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    h = (h * 1103515245 + 12345) | 0;
    const j = Math.abs(h) % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function subsetAgent(input: SubsetInput): { output: SubsetOutput; state: Pick<PhaseState, "log" | "metrics" | "inputCount" | "outputCount"> } {
  const log: string[] = [];
  const priorityTldSet = new Set(input.priorityTlds.map((t) => t.toLowerCase()));

  const inSubset: string[] = [];
  const otherIndia: string[] = [];
  const comEligible: string[] = [];
  const filtered: string[] = [];

  for (const d of input.eligible) {
    if (isFiltered(d)) { filtered.push(d); continue; }
    const tld = tldOf(d);
    if (priorityTldSet.has(tld)) inSubset.push(d);
    else if (tld.endsWith(".in")) otherIndia.push(d);
    else if (tld === "com" && looksD2cCom(d)) comEligible.push(d);
  }

  const cap = input.enrichSubsetCap;
  const inCap = Math.min(inSubset.length, Math.ceil(cap * 0.66));
  const otherCap = Math.min(otherIndia.length, Math.ceil(cap * 0.13));
  const comCap = Math.min(comEligible.length, cap - inCap - otherCap);

  const comShuffled = deterministicShuffle(comEligible, "vwo-pilot");
  const subset = [
    ...inSubset.slice(0, inCap),
    ...otherIndia.slice(0, otherCap),
    ...comShuffled.slice(0, comCap),
  ].slice(0, cap);

  const batches: string[][] = [];
  for (let i = 0; i < subset.length; i += 10) batches.push(subset.slice(i, i + 10));

  log.push(`${input.eligible.length} eligible -> ${subset.length} subset (${batches.length} batches of 10).`);
  log.push(`Buckets: priority TLD ${inCap}, other .in ${otherCap}, .com D2C ${comCap}. Filtered out: ${filtered.length} (negative-pattern).`);

  return {
    output: {
      subset,
      batches,
      priorityCount: inCap,
      comD2cCount: comCap,
      otherCount: otherCap,
    },
    state: {
      log,
      metrics: {
        subset: subset.length,
        batches: batches.length,
        priorityTld: inCap,
        otherIndia: otherCap,
        comD2c: comCap,
        filteredNegativePattern: filtered.length,
      },
      inputCount: input.eligible.length,
      outputCount: subset.length,
    },
  };
}
