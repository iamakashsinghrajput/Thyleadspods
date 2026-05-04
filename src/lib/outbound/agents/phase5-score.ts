import type { EnrichedAccount, ScoredAccount, PhaseState } from "../types";

export const VWO_INDUSTRY_WEIGHTS_V2: Record<string, number> = {
  "apparel & fashion": 30,
  "retail": 28,
  "consumer goods": 28,
  "cosmetics": 28,
  "health, wellness & fitness": 28,
  "food & beverages": 24,
  "financial services": 26,
  "banking": 26,
  "insurance": 24,
  "investment management": 22,
  "e-learning": 24,
  "education management": 20,
  "higher education": 18,
  "leisure, travel & tourism": 22,
  "airlines/aviation": 20,
  "automotive": 18,
  "transportation/trucking/railroad": 16,
  "hospital & health care": 22,
  "computer games": 18,
  "entertainment": 18,
  "internet": 22,
  "consumer services": 18,
  "computer software": 16,
  "information technology & services": 14,
  "government administration": -100,
  "gambling & casinos": -100,
};

export const DEFAULT_HIGH_FIT_KEYWORDS_V2 = [
  "d2c", "direct to consumer", "e-commerce", "ecommerce", "online retail",
  "b2c", "consumer internet", "mobile commerce",
  "digital lending", "wealth management", "mutual funds", "fintech",
  "insurtech", "lending platform", "payment gateway",
  "edtech", "online education", "test prep", "upskilling",
  "health tech", "diagnostics", "telemedicine", "wellness",
  "subscription", "membership", "free trial", "lead generation",
  "conversion", "personalization", "cart", "checkout", "signup", "funnel",
];

export type Bucket = "hot" | "priority" | "active" | "nurture" | "excluded";

export interface ProjectData {
  activeClientDomains: Set<string>;
  pastMeetingTokens: Set<string>;
  dncDomains: Set<string>;
  sellerDomains: Set<string>;
  pastMeetingSubsegmentCounts: Record<string, number>;
  activeCustomerProfiles: Array<{ industry: string; employees: number }>;
}

export interface ScoringConfig {
  geographyHardFilter: string[];
  industryWeights: Record<string, number>;
  antiIcpIndustries: string[];
  highFitKeywords: string[];
  directCompetitors: string[];
  partnerAgencies: string[];
  competitorCustomerDb: Record<string, string[]>;
  provenSubsegments: Record<string, number>;
  employeeSweetSpotMin: number;
  employeeSweetSpotMax: number;
  alexaHardFilterMax: number;
}

export interface ScoreInput {
  enriched: EnrichedAccount[];
  config: ScoringConfig;
  projectData: ProjectData;
  topN: number;
  maxPerIndustry: number;
}

export interface IntentSignals {
  championJoinedRecently: number;
  championRoleOpen: number;
  recentFunding: number;
  recentLaunch: number;
  generalHiring: number;
  headcountGrowth: number;
  expansion: number;
  pressMention: number;
}

export interface ScoreBreakdown {
  hardFilterPassed: boolean;
  hardFilterReason: string;
  baseFit: number;
  baseFitDetail: { industry: number; size: number; traffic: number; keywords: number; maturity: number };
  historicalContext: number;
  historicalContextDetail: { subsegmentMultiplier: number; subsegment: string; activeCustomerAdjacency: number };
  competitorLookalike: number;
  competitorLookalikeDetail: { directHit: string; softHit: string };
  intentSignals: number;
  intentSignalsDetail: IntentSignals;
  penalty: number;
  finalScore: number;
}

export interface ScoreOutput {
  all: ScoredAccount[];
  top: ScoredAccount[];
  industryDistribution: Record<string, number>;
  bucketCounts: Record<Bucket, number>;
}

export function inferSubsegment(account: EnrichedAccount): string {
  const industry = (account.industry || "").toLowerCase();
  const keywords = (account.keywords || []).join(" ").toLowerCase();
  const desc = (account.shortDescription || "").toLowerCase();
  const corpus = `${keywords} ${desc}`;

  if (industry === "apparel & fashion") return "D2C-Apparel";
  if (industry === "cosmetics" || /skincare|makeup|beauty/.test(corpus)) return "D2C-Beauty";
  if (industry === "health, wellness & fitness" && corpus.includes("d2c")) return "D2C-Wellness";
  if (industry === "financial services") {
    if (/lending|loan|credit/.test(corpus)) return "Fintech-Lending";
    if (/wealth|investment|mutual fund|broker/.test(corpus)) return "Fintech-Wealth";
  }
  if (industry === "banking") return "BFSI-Bank";
  if (industry === "insurance") return "BFSI-Insurance";
  if (industry === "hospital & health care" && corpus.includes("diagnostic")) return "Health-Diagnostics";
  if (industry === "e-learning") {
    if (/neet|cat|gate|upsc|jee/.test(corpus)) return "EdTech-TestPrep";
    return "EdTech-Upskilling";
  }
  return "Other";
}

function nameToToken(s: string): string {
  return s.toLowerCase().replace(/\./g, "").replace(/,/g, "").replace(/'/g, "")
    .replace(/&/g, "and").replace(/\s+/g, "").replace(/-/g, "").slice(0, 25);
}

export function hardFilter(account: EnrichedAccount, config: ScoringConfig, projectData: ProjectData): { passes: boolean; reason: string } {
  const domain = (account.domain || "").toLowerCase().trim();
  if (!domain) return { passes: false, reason: "no_domain" };

  if (config.geographyHardFilter.length > 0) {
    const country = (account.country || "").trim();
    if (!config.geographyHardFilter.includes(country)) {
      return { passes: false, reason: `non-target-geo: ${country || "unknown"}` };
    }
  }

  if (projectData.sellerDomains.has(domain)) return { passes: false, reason: "self" };
  if (projectData.dncDomains.has(domain)) return { passes: false, reason: "DNC" };
  if (projectData.activeClientDomains.has(domain)) return { passes: false, reason: "active_customer" };

  const root = nameToToken(domain.split(".")[0]);
  if (root && projectData.pastMeetingTokens.has(root)) return { passes: false, reason: "past_meeting" };

  if (config.directCompetitors.includes(domain)) return { passes: false, reason: "direct_competitor" };
  if (config.partnerAgencies.includes(domain)) return { passes: false, reason: "partner_agency" };

  const industry = (account.industry || "").toLowerCase();
  if (industry && config.antiIcpIndustries.includes(industry)) {
    return { passes: false, reason: `anti-ICP: ${industry}` };
  }

  const emp = account.estimatedNumEmployees || 0;
  const rev = (account.organizationRevenuePrinted || "").trim();
  const founded = account.foundedYear || 0;
  if (emp > 0 && emp < 10 && !rev && (founded === 0 || (new Date().getFullYear() - founded) < 2)) {
    return { passes: false, reason: "pre-PMF" };
  }

  const alexa = account.alexaRanking || Number.MAX_SAFE_INTEGER;
  if (alexa > config.alexaHardFilterMax) {
    return { passes: false, reason: `low_traffic_alexa_${alexa}` };
  }

  return { passes: true, reason: "" };
}

export function baseFitScore(account: EnrichedAccount, config: ScoringConfig): { score: number; detail: ScoreBreakdown["baseFitDetail"] } {
  const detail = { industry: 0, size: 0, traffic: 0, keywords: 0, maturity: 0 };

  const primary = (account.industry || "").toLowerCase().trim();
  const secondary = (account.secondaryIndustries || []).join(" ").toLowerCase();
  let pts = config.industryWeights[primary] || 0;
  if (pts === 0) {
    for (const [ind, w] of Object.entries(config.industryWeights)) {
      if (secondary.includes(ind)) { pts = Math.max(pts, Math.round(w * 0.7)); break; }
    }
  }
  detail.industry = Math.min(18, Math.max(-30, Math.round(pts * 0.6)));

  const emp = account.estimatedNumEmployees || 0;
  const swMin = config.employeeSweetSpotMin;
  const swMax = config.employeeSweetSpotMax;
  if (emp >= swMin && emp <= swMax) detail.size = 8;
  else if (emp >= 20 && emp < swMin) detail.size = 5;
  else if (emp > swMax && emp <= 5000) detail.size = 6;
  else if (emp > 5000) detail.size = 3;
  else if (emp > 0 && emp < 20) detail.size = 1;

  const alexa = account.alexaRanking || Number.MAX_SAFE_INTEGER;
  if (alexa < 50_000) detail.traffic = 6;
  else if (alexa < 150_000) detail.traffic = 5;
  else if (alexa < 500_000) detail.traffic = 3;
  else if (alexa < 1_500_000) detail.traffic = 1;

  const text = [
    (account.keywords || []).join(" "),
    account.shortDescription || "",
    (account.secondaryIndustries || []).join(" "),
  ].join(" ").toLowerCase();
  let hits = 0;
  for (const k of config.highFitKeywords) if (text.includes(k)) hits++;
  detail.keywords = Math.min(4, hits);

  const founded = account.foundedYear || 0;
  if (founded > 0) {
    const age = new Date().getFullYear() - founded;
    if (age >= 4 && age <= 12) detail.maturity = 4;
    else if (age >= 13 && age <= 20) detail.maturity = 3;
    else if (age <= 3) detail.maturity = 1;
    else if (age >= 21) detail.maturity = 2;
  }

  const score = Math.min(40, Math.max(0, detail.industry + detail.size + detail.traffic + detail.keywords + detail.maturity));
  return { score, detail };
}

export function historicalContextScore(account: EnrichedAccount, projectData: ProjectData, config: ScoringConfig): { score: number; detail: ScoreBreakdown["historicalContextDetail"] } {
  const subsegment = inferSubsegment(account);
  const multiplier = config.provenSubsegments[subsegment] || 1.0;

  let subsegmentPts = 0;
  if (multiplier >= 1.10) subsegmentPts = 6;
  else if (multiplier >= 1.05) subsegmentPts = 4;
  else if (multiplier >= 1.03) subsegmentPts = 2;

  const industry = (account.industry || "").toLowerCase();
  const emp = account.estimatedNumEmployees || 0;

  let matches = 0;
  for (const c of projectData.activeCustomerProfiles) {
    const cInd = (c.industry || "").toLowerCase();
    const cEmp = c.employees || 0;
    if (cInd === industry && cEmp > 0 && emp > 0 && emp >= 0.5 * cEmp && emp <= 2 * cEmp) {
      matches++;
      if (matches >= 5) break;
    }
  }
  let adjacencyPts = 0;
  if (matches >= 5) adjacencyPts = 6;
  else if (matches >= 3) adjacencyPts = 4;
  else if (matches >= 1) adjacencyPts = 2;

  const score = Math.min(15, subsegmentPts + adjacencyPts);
  return { score, detail: { subsegmentMultiplier: multiplier, subsegment, activeCustomerAdjacency: adjacencyPts } };
}

export function competitorLookalikeScore(account: EnrichedAccount, db: Record<string, string[]>): { score: number; detail: ScoreBreakdown["competitorLookalikeDetail"] } {
  const domain = (account.domain || "").toLowerCase();
  const name = (account.name || "").toLowerCase().trim();

  let directHit = "";
  for (const [competitor, domains] of Object.entries(db)) {
    if (Array.isArray(domains) && domains.map((d) => d.toLowerCase()).includes(domain)) {
      directHit = competitor;
      break;
    }
  }
  if (directHit) return { score: 10, detail: { directHit, softHit: "" } };

  let softHit = "";
  if (name.length > 4) {
    for (const [competitor, domains] of Object.entries(db)) {
      if (Array.isArray(domains)) {
        for (const d of domains) {
          const dRoot = d.toLowerCase().split(".")[0];
          if (dRoot.length > 4 && (dRoot.includes(name) || name.includes(dRoot))) {
            softHit = competitor;
            break;
          }
        }
      }
      if (softHit) break;
    }
  }
  if (softHit) return { score: 6, detail: { directHit: "", softHit } };
  return { score: 0, detail: { directHit: "", softHit: "" } };
}

export function intentSignalScore(account: EnrichedAccount): { score: number; detail: IntentSignals } {
  const signals: IntentSignals = {
    championJoinedRecently: 0,
    championRoleOpen: 0,
    recentFunding: 0,
    recentLaunch: 0,
    generalHiring: 0,
    headcountGrowth: 0,
    expansion: 0,
    pressMention: 0,
  };

  const h6 = account.headcount6mGrowth || 0;
  const h12 = account.headcount12mGrowth || 0;
  if (h6 >= 0.20 || h12 >= 0.40) signals.headcountGrowth = 4;
  else if (h6 >= 0.15 || h12 >= 0.30) signals.headcountGrowth = 3;
  else if (h6 >= 0.10 || h12 >= 0.20) signals.headcountGrowth = 2;

  const score = Math.min(35,
    signals.championJoinedRecently +
    signals.championRoleOpen +
    signals.recentFunding +
    signals.recentLaunch +
    signals.generalHiring +
    signals.headcountGrowth +
    signals.expansion +
    signals.pressMention,
  );
  return { score, detail: signals };
}

export function bucketFor(score: number): Bucket {
  if (score >= 80) return "hot";
  if (score >= 65) return "priority";
  if (score >= 50) return "active";
  if (score >= 35) return "nurture";
  return "excluded";
}

export function scoreOneV2(account: EnrichedAccount, config: ScoringConfig, projectData: ProjectData): { score: number; segment: Bucket; breakdown: ScoreBreakdown } {
  const filterCheck = hardFilter(account, config, projectData);
  if (!filterCheck.passes) {
    return {
      score: 0,
      segment: "excluded",
      breakdown: {
        hardFilterPassed: false,
        hardFilterReason: filterCheck.reason,
        baseFit: 0,
        baseFitDetail: { industry: 0, size: 0, traffic: 0, keywords: 0, maturity: 0 },
        historicalContext: 0,
        historicalContextDetail: { subsegmentMultiplier: 1, subsegment: "Other", activeCustomerAdjacency: 0 },
        competitorLookalike: 0,
        competitorLookalikeDetail: { directHit: "", softHit: "" },
        intentSignals: 0,
        intentSignalsDetail: { championJoinedRecently: 0, championRoleOpen: 0, recentFunding: 0, recentLaunch: 0, generalHiring: 0, headcountGrowth: 0, expansion: 0, pressMention: 0 },
        penalty: 0,
        finalScore: 0,
      },
    };
  }

  const s1 = baseFitScore(account, config);
  const s2 = historicalContextScore(account, projectData, config);
  const s3 = competitorLookalikeScore(account, config.competitorCustomerDb);
  const s4 = intentSignalScore(account);

  const base = s1.score + s2.score + s3.score + s4.score;
  const penalty = 0;
  const finalScore = Math.max(0, Math.min(100, base - penalty));

  return {
    score: Math.round(finalScore * 10) / 10,
    segment: bucketFor(finalScore),
    breakdown: {
      hardFilterPassed: true,
      hardFilterReason: "",
      baseFit: s1.score,
      baseFitDetail: s1.detail,
      historicalContext: s2.score,
      historicalContextDetail: s2.detail,
      competitorLookalike: s3.score,
      competitorLookalikeDetail: s3.detail,
      intentSignals: s4.score,
      intentSignalsDetail: s4.detail,
      penalty,
      finalScore,
    },
  };
}

export function scoreAgent(input: ScoreInput): { output: ScoreOutput; state: Pick<PhaseState, "log" | "metrics" | "inputCount" | "outputCount"> } {
  const cfg = input.config;
  const all: ScoredAccount[] = input.enriched.map((row) => {
    const r = scoreOneV2(row, cfg, input.projectData);
    return {
      ...row,
      score: r.score,
      segment: r.segment as ScoredAccount["segment"],
      scoreBreakdown: r.breakdown as unknown as Record<string, number>,
    };
  });

  all.sort((a, b) => b.score - a.score);

  const top: ScoredAccount[] = [];
  const indCount = new Map<string, number>();
  for (const r of all) {
    if (r.score === 0) break;
    if (top.length >= input.topN) break;
    const ind = (r.industry || "other").toLowerCase();
    const c = indCount.get(ind) || 0;
    if (c >= input.maxPerIndustry) continue;
    top.push(r);
    indCount.set(ind, c + 1);
  }

  const industryDistribution: Record<string, number> = {};
  for (const r of top) {
    const ind = (r.industry || "other").toLowerCase();
    industryDistribution[ind] = (industryDistribution[ind] || 0) + 1;
  }

  const bucketCounts: Record<Bucket, number> = { hot: 0, priority: 0, active: 0, nurture: 0, excluded: 0 };
  for (const r of all) bucketCounts[r.segment as Bucket]++;

  const log = [
    `Scoring v2: ${all.length} accounts. Hard-filtered: ${bucketCounts.excluded}. Survived: ${all.length - bucketCounts.excluded}.`,
    `Buckets — Hot ${bucketCounts.hot} · Priority ${bucketCounts.priority} · Active ${bucketCounts.active} · Nurture ${bucketCounts.nurture} · Excluded ${bucketCounts.excluded}.`,
    `Top ${top.length} picked (industry-diversity cap ${input.maxPerIndustry}/industry). Top score: ${top[0]?.score ?? 0}. Median: ${top[Math.floor(top.length / 2)]?.score ?? 0}.`,
    `Industry distribution in top: ${Object.entries(industryDistribution).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => `${k}=${v}`).join(", ") || "—"}.`,
  ];

  return {
    output: { all, top, industryDistribution, bucketCounts },
    state: {
      log,
      metrics: {
        scored: all.length,
        top: top.length,
        topScoreMax: top[0]?.score ?? 0,
        topScoreMedian: top[Math.floor(top.length / 2)]?.score ?? 0,
        hot: bucketCounts.hot,
        priority: bucketCounts.priority,
        active: bucketCounts.active,
        nurture: bucketCounts.nurture,
        excluded: bucketCounts.excluded,
      },
      inputCount: input.enriched.length,
      outputCount: top.length,
    },
  };
}

export const DEFAULT_INDUSTRY_WEIGHTS = VWO_INDUSTRY_WEIGHTS_V2;
export const DEFAULT_HIGH_FIT_KEYWORDS = DEFAULT_HIGH_FIT_KEYWORDS_V2;
