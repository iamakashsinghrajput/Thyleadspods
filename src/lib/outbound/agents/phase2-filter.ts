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

// VWO_CLIENT_SKILL.md anti-ICP auto-exclude rules — domain-pattern based.
// Catches services agencies, government/PSU, and "domain-shaped" giveaways.
const VWO_ANTI_ICP_PATTERNS: Array<{ re: RegExp; reason: string }> = [
  // Government / PSU
  { re: /\.gov(\.|$)/i, reason: "anti_icp_government" },
  { re: /\.gov\.in$/i, reason: "anti_icp_government" },
  { re: /\.nic\.in$/i, reason: "anti_icp_government" },
  { re: /\.ac\.in$/i, reason: "anti_icp_education_institution" },
  { re: /\.edu(\.|$)/i, reason: "anti_icp_education_institution" },
  // Services agencies / consultancies (digital agencies sell CRO themselves — they're competitors, not buyers)
  { re: /(agency|consulting|consultancy|consultants)\.(com|in|co\.in)$/i, reason: "anti_icp_services_agency" },
  { re: /^(www\.)?[a-z0-9-]*(digital|growth|seo|sem|adwords|performance|martech|cro)agency/i, reason: "anti_icp_services_agency" },
];

function matchesAntiIcp(domain: string): { hit: boolean; reason: string } {
  for (const p of VWO_ANTI_ICP_PATTERNS) {
    if (p.re.test(domain)) return { hit: true, reason: p.reason };
  }
  return { hit: false, reason: "" };
}

// VWO_CLIENT_SKILL.md — holding-company / sister-brand expansion.
// When ANY company in a group is a VWO customer, exclude ALL group members.
// Tokens here are matched against the domain's root token (e.g. "hdfc" → matches "hdfc.com", "hdfclife.com", "hdfcsec.com").
const VWO_GROUP_EXCLUSION_ROOTS: Record<string, string[]> = {
  hdfc: ["hdfc", "hdfcbank", "hdfclife", "hdfcsec", "hdfcamc", "hdfcergo"],
  icici: ["icici", "icicibank", "icicipruamc", "icicidirect", "iciciprulife", "icicilombard", "icicisecurities"],
  andaaz: ["andaaz", "andaazfashion"],
  posist: ["posist", "restroworks"],
  // Holding-company conglomerates per the doc — flag for review (sister-brand expansion).
  arvind: ["arvind", "arvindfashions", "arvindlifestyle"],
  abfrl: ["abfrl", "abfrlbrands", "pantaloons", "louisphilippe", "vanheusen", "allensolly"],
  reliance: ["reliance", "reliancedigital", "reliancejewels", "reliancejio", "ajio"],
  tata: ["tata", "tatadigital", "tatacliq", "tata1mg", "bigbasket", "tatasteel"],
  honasa: ["honasa", "mamaearth", "thedermaco", "ayuga", "aqualogica"],
  goodglamm: ["goodglamm", "myglamm", "popxo", "stcalvin", "babychakra"],
  marico: ["marico", "saffola", "parachute"],
  mahindra: ["mahindra", "mahindraholidays", "mahindrafirstchoice"],
  adani: ["adani", "adanigreen", "adaniwilmar", "adaniports"],
  razorpay: ["razorpay", "razorpayx", "ezetap"],
  zoho: ["zoho", "zohocrm", "zepto"],
};

function expandGroupExclusions(seedDomains: string[]): Set<string> {
  // Build the union: any seed token in a group → exclude all roots in that group.
  const seedTokens = new Set<string>();
  for (const d of seedDomains) {
    const root = nameToToken((d || "").split(".")[0]);
    if (root) seedTokens.add(root);
  }
  const expanded = new Set<string>(seedTokens);
  for (const groupRoots of Object.values(VWO_GROUP_EXCLUSION_ROOTS)) {
    if (groupRoots.some((r) => seedTokens.has(r))) {
      for (const r of groupRoots) expanded.add(r);
    }
  }
  return expanded;
}

export function filterAgent(input: FilterInput): { output: FilterOutput; state: Pick<PhaseState, "log" | "metrics" | "inputCount" | "outputCount"> } {
  const dncSet = new Set(input.dnc);
  const activeSet = new Set(input.activeCustomers);
  const sellerSet = new Set(input.sellerDomains);
  const pastSet = new Set(input.pastMeetingTokens);

  // V-VWO holding-company expansion: from active customers + DNC, expand to all sister-brand roots.
  const expandedExclusionTokens = expandGroupExclusions([
    ...input.activeCustomers,
    ...input.dnc,
    ...input.sellerDomains,
  ]);

  const eligible: string[] = [];
  const excluded: { domain: string; reason: string }[] = [];

  let dncHits = 0, activeHits = 0, pastHits = 0, selfHits = 0, groupHits = 0, antiIcpHits = 0;

  for (const domain of input.targets) {
    if (sellerSet.has(domain)) { excluded.push({ domain, reason: "self" }); selfHits++; continue; }
    if (dncSet.has(domain)) { excluded.push({ domain, reason: "dnc" }); dncHits++; continue; }
    if (activeSet.has(domain)) { excluded.push({ domain, reason: "active_customer" }); activeHits++; continue; }
    const antiIcp = matchesAntiIcp(domain);
    if (antiIcp.hit) {
      excluded.push({ domain, reason: antiIcp.reason });
      antiIcpHits++;
      continue;
    }
    const root = nameToToken(domain.split(".")[0]);
    if (root && pastSet.has(root)) {
      excluded.push({ domain, reason: "past_meeting" });
      pastHits++;
      continue;
    }
    if (root && expandedExclusionTokens.has(root) && !sellerSet.has(domain)) {
      excluded.push({ domain, reason: "group_sister_brand" });
      groupHits++;
      continue;
    }
    eligible.push(domain);
  }

  const log = [
    `${input.targets.length} targets in. ${eligible.length} eligible, ${excluded.length} excluded.`,
    `Excluded: ${selfHits} self, ${dncHits} DNC, ${activeHits} active customer, ${pastHits} past meeting, ${groupHits} sister-brand (V-VWO group expansion), ${antiIcpHits} anti-ICP (gov/agency/edu).`,
  ];

  return {
    output: { eligible, excluded },
    state: {
      log,
      metrics: {
        eligible: eligible.length,
        excluded: excluded.length,
        dncHits, activeHits, pastHits, selfHits, groupHits, antiIcpHits,
        eligibleRatePct: input.targets.length === 0 ? 0 : Math.round((eligible.length / input.targets.length) * 100),
      },
      inputCount: input.targets.length,
      outputCount: eligible.length,
    },
  };
}
