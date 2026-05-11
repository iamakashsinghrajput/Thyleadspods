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
  // When the operator typed these domains explicitly, soft-style hard filters
  // (geo / Alexa / offline-retail anti-ICP) are bypassed. DNC, active customer,
  // self, sister-brand, and direct-competitor still apply — those are correctness rules.
  explicitDomains?: string[];
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

export function hardFilter(account: EnrichedAccount, config: ScoringConfig, projectData: ProjectData, opts?: { isExplicit?: boolean }): { passes: boolean; reason: string } {
  const domain = (account.domain || "").toLowerCase().trim();
  if (!domain) return { passes: false, reason: "no_domain" };

  // Correctness rules — apply unconditionally (operator override does NOT bypass these).
  if (projectData.sellerDomains.has(domain)) return { passes: false, reason: "self" };
  if (projectData.dncDomains.has(domain)) return { passes: false, reason: "DNC" };
  if (projectData.activeClientDomains.has(domain)) return { passes: false, reason: "active_customer" };

  const root = nameToToken(domain.split(".")[0]);
  if (root && projectData.pastMeetingTokens.has(root)) return { passes: false, reason: "past_meeting" };

  if (config.directCompetitors.includes(domain)) return { passes: false, reason: "direct_competitor" };
  if (config.partnerAgencies.includes(domain)) return { passes: false, reason: "partner_agency" };

  // Soft-style filters — bypassed when operator explicitly typed the domain.
  // These reject on data Apollo *might* be missing (country, Alexa, retail keywords on a stub).
  if (opts?.isExplicit) {
    return { passes: true, reason: "" };
  }

  if (config.geographyHardFilter.length > 0) {
    const country = (account.country || "").trim();
    if (!config.geographyHardFilter.includes(country)) {
      return { passes: false, reason: `non-target-geo: ${country || "unknown"}` };
    }
  }

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

  // VWO_CLIENT_SKILL.md anti-ICP: pure offline retail without active digital surface.
  // Heuristic: industry keyword "retail" / "store" / "showroom", >100 emp, AND no Alexa rank (no measurable web presence)
  // AND keywords don't include digital/ecommerce/online indicators.
  const industryLower = (account.industry || "").toLowerCase();
  const looksRetail = /retail|store|showroom|departmental/i.test(industryLower);
  const kwBlob = (account.keywords || []).map((k) => k.toLowerCase()).join(" ");
  const looksDigital = /\becom|\be-?commerce|\bonline\b|\bd2c\b|\bdigital\b|\bweb\b|\bapp\b|\bsaas\b/i.test(kwBlob) || /\becom|\be-?commerce|\bonline\b|\bd2c\b/i.test(industryLower);
  const noWebPresence = (account.alexaRanking || 0) === 0 && !account.linkedinUrl && !account.shortDescription;
  if (looksRetail && emp >= 100 && noWebPresence && !looksDigital) {
    return { passes: false, reason: "anti_icp_offline_retail_no_digital_surface" };
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

// VWO_CLIENT_SKILL.md Layer 5 Timing multiplier — Indian fiscal calendar.
// Diwali blackout (0.6×) hard — buyers heads-down on festive campaigns.
// FY transition (1.3×) strongest — Indian budgets land in Mar/Apr.
function fiscalCalendarMultiplier(now: Date = new Date()): { multiplier: number; window: string } {
  const month = now.getMonth(); // 0=Jan
  const day = now.getDate();
  // Diwali blackout: late Oct → mid Nov (approximate fixed window — exact dates shift annually)
  if (month === 9 && day >= 20) return { multiplier: 0.6, window: "diwali_blackout" };
  if (month === 10 && day <= 15) return { multiplier: 0.6, window: "diwali_blackout" };
  // FY transition window: mid-Mar → mid-Apr (peak budget unlock)
  if (month === 2 && day >= 15) return { multiplier: 1.3, window: "fy_transition" };
  if (month === 3 && day <= 15) return { multiplier: 1.3, window: "fy_transition" };
  // IPL: late Mar → late May (B2C distraction, slight discount)
  if (month === 3 && day > 15) return { multiplier: 0.9, window: "ipl_active" };
  if (month === 4) return { multiplier: 0.9, window: "ipl_active" };
  // Festive prep: Aug → mid-Sep (D2C teams locked into campaign builds)
  if (month === 7) return { multiplier: 0.85, window: "festive_prep" };
  if (month === 8 && day <= 15) return { multiplier: 0.85, window: "festive_prep" };
  // Year-end pause: mid-Dec → first week Jan (Western buyers OOO; Indian still active but slower)
  if (month === 11 && day >= 20) return { multiplier: 0.85, window: "year_end_pause" };
  if (month === 0 && day <= 7) return { multiplier: 0.85, window: "year_end_pause" };
  return { multiplier: 1.0, window: "regular" };
}

// VWO_CLIENT_SKILL.md scoring overrides (vs MarTech base):
//   L2a hiring     = 15 (unchanged)
//   L2b leadership = 18 (+3)  ← bumped: new CMO 0-90d is the highest-converting signal
//   L2c funding    =  4 (-1)  ← downweighted: "saw your Series B" saturation
//   L2d growth     =  6 (+1)  ← marketing-function headcount growth specifically
//   L2e news       =  0 (unchanged)
//   L2f tech stack = 12 (+2)  ← legacy-tool displacement (GA4+Hotjar only) is strong
const VWO_INTENT_CAPS = {
  leadership: 18,    // championJoinedRecently
  hiring: 15,        // championRoleOpen + generalHiring
  funding: 4,        // recentFunding
  growth: 6,         // headcountGrowth
  techStack: 12,     // L2f — new
  news: 0,           // recentLaunch + pressMention + expansion zeroed (saturation)
};

function isVwoTechStackDisplacement(account: EnrichedAccount): boolean {
  const stack = (account.keywords || []).map((k) => k.toLowerCase()).join(" ");
  if (!stack) return false;
  // Strong VWO buying signal per doc: "uses only Hotjar + GA4" (no A/B tool)
  const hasHotjar = stack.includes("hotjar");
  const hasGa = stack.includes("google analytics") || stack.includes("ga4");
  const hasAb = stack.includes("optimizely") || stack.includes("ab tasty") || stack.includes("convert.com")
    || stack.includes("statsig") || stack.includes("posthog") || stack.includes("vwo");
  return (hasHotjar || hasGa) && !hasAb;
}

export function intentSignalScore(account: EnrichedAccount): { score: number; detail: IntentSignals & { techStackDisplacement?: number } } {
  const signals: IntentSignals & { techStackDisplacement?: number } = {
    championJoinedRecently: 0,
    championRoleOpen: 0,
    recentFunding: 0,
    recentLaunch: 0,
    generalHiring: 0,
    headcountGrowth: 0,
    expansion: 0,
    pressMention: 0,
    techStackDisplacement: 0,
  };

  const h6 = account.headcount6mGrowth || 0;
  const h12 = account.headcount12mGrowth || 0;
  if (h6 >= 0.20 || h12 >= 0.40) signals.headcountGrowth = VWO_INTENT_CAPS.growth;
  else if (h6 >= 0.15 || h12 >= 0.30) signals.headcountGrowth = Math.round(VWO_INTENT_CAPS.growth * 0.66);
  else if (h6 >= 0.10 || h12 >= 0.20) signals.headcountGrowth = Math.round(VWO_INTENT_CAPS.growth * 0.33);

  // L2f tech-stack displacement bonus (VWO-specific addition)
  if (isVwoTechStackDisplacement(account)) {
    signals.techStackDisplacement = VWO_INTENT_CAPS.techStack;
  }

  // Apply per-signal caps so no single signal overweights vs the doc's L2 distribution.
  signals.championJoinedRecently = Math.min(signals.championJoinedRecently, VWO_INTENT_CAPS.leadership);
  signals.championRoleOpen = Math.min(signals.championRoleOpen, VWO_INTENT_CAPS.hiring);
  signals.generalHiring = Math.min(signals.generalHiring, VWO_INTENT_CAPS.hiring);
  signals.recentFunding = Math.min(signals.recentFunding, VWO_INTENT_CAPS.funding);
  // Zero out news-only signals (L2e = 0)
  signals.recentLaunch = 0;
  signals.pressMention = 0;
  signals.expansion = 0;

  // VWO_CLIENT_SKILL.md Stage 2 business_impact weighting per signal type.
  // High (0.9-1.0) for signals that tie to the lead's funnel/conversion/experimentation/growth function.
  // Low (0.3-0.5) for revenue/product/engineering signals without a conversion implication.
  const BUSINESS_IMPACT = {
    championJoinedRecently: 1.0,    // new CMO/VP Marketing is the highest-converting signal for VWO
    championRoleOpen: 0.95,         // hiring CRO/Growth/Marketing roles → funnel about to be scrutinised
    generalHiring: 0.5,             // generic hiring is partial signal
    headcountGrowth: 0.9,           // marketing-function growth specifically
    techStackDisplacement: 1.0,     // GA4+Hotjar only → strong VWO displacement angle
    recentFunding: 0.6,             // funding implies budget but signal is saturated for D2C founders
    recentLaunch: 0.3,              // news-only signal, low predictive power for VWO
    pressMention: 0.3,              // same — news-only
    expansion: 0.4,                 // expansion-only without function-specific signal
  };

  const weighted =
    signals.championJoinedRecently * BUSINESS_IMPACT.championJoinedRecently +
    signals.championRoleOpen * BUSINESS_IMPACT.championRoleOpen +
    signals.generalHiring * BUSINESS_IMPACT.generalHiring +
    signals.headcountGrowth * BUSINESS_IMPACT.headcountGrowth +
    (signals.techStackDisplacement || 0) * BUSINESS_IMPACT.techStackDisplacement +
    signals.recentFunding * BUSINESS_IMPACT.recentFunding +
    signals.recentLaunch * BUSINESS_IMPACT.recentLaunch +
    signals.pressMention * BUSINESS_IMPACT.pressMention +
    signals.expansion * BUSINESS_IMPACT.expansion;

  const score = Math.min(60, weighted);
  return { score, detail: signals };
}

// VWO_CLIENT_SKILL.md bucket thresholds (after multipliers):
//   95+    Top Priority (Tier A custom research with Coresignal)
//   75-94  Priority (Tier B archetype defaults)
//   55-74  Active (Tier C defaults)
//   35-54  Nurture (hold; re-score monthly)
//   <35    Excluded (drop)
export function bucketFor(score: number): Bucket {
  if (score >= 95) return "hot";
  if (score >= 75) return "priority";
  if (score >= 55) return "active";
  if (score >= 35) return "nurture";
  return "excluded";
}

export function scoreOneV2(account: EnrichedAccount, config: ScoringConfig, projectData: ProjectData, opts?: { isExplicit?: boolean }): { score: number; segment: Bucket; breakdown: ScoreBreakdown } {
  const filterCheck = hardFilter(account, config, projectData, opts);
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

  // VWO_CLIENT_SKILL.md Layer 6 Penalty: prospect on a competitor case-study page = 0.2× multiplier.
  // We approximate the case-study check via tech-stack keywords (BuiltWith proxy via Apollo).
  const stackLower = (account.keywords || []).map((k) => k.toLowerCase()).join(" ");
  const hasDirectCompetitor = ["optimizely", "ab tasty", "convert.com", "statsig", "posthog"].some((c) => stackLower.includes(c));
  // Adjacent competitors = lighter 0.5× (different category, displacement angle still possible).
  // Per VWO_CLIENT_SKILL.md: Adobe Target, LaunchDarkly, Mida.so, Hotjar (point-tool), FullStory, Mixpanel, Amplitude.
  const hasAdjacentCompetitor = ["adobe target", "launchdarkly", "mida.so", "mida ", "hotjar", "fullstory", "mixpanel", "amplitude"].some((c) => stackLower.includes(c));
  const competitorPenaltyMultiplier = hasDirectCompetitor ? 0.2 : (hasAdjacentCompetitor ? 0.5 : 1.0);

  // VWO_CLIENT_SKILL.md "canonical Top Priority composite" — 1.20× when ALL three stack fresh:
  //   1. championJoinedRecently (proxy for "new CMO/VP Marketing 0-90 days")
  //   2. headcountGrowth (proxy for "marketing/growth function headcount up 10%+")
  //   3. techStackDisplacement (proxy for "uses only Hotjar + GA4")
  const det = s4.detail as { championJoinedRecently?: number; headcountGrowth?: number; techStackDisplacement?: number };
  const compositeStack = (det.championJoinedRecently || 0) > 0 && (det.headcountGrowth || 0) > 0 && (det.techStackDisplacement || 0) > 0;
  const compositeMultiplier = compositeStack ? 1.20 : 1.0;

  // VWO_CLIENT_SKILL.md Layer 5 Timing multiplier — Indian fiscal calendar.
  const timing = fiscalCalendarMultiplier();

  const penalty = 0;
  const finalScore = Math.max(0, Math.min(100, (base - penalty) * competitorPenaltyMultiplier * compositeMultiplier * timing.multiplier));

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
  const explicitSet = new Set((input.explicitDomains || []).map((d) => d.toLowerCase().trim()));
  const all: ScoredAccount[] = input.enriched.map((row) => {
    const isExplicit = explicitSet.has((row.domain || "").toLowerCase().trim());
    const r = scoreOneV2(row, cfg, input.projectData, { isExplicit });
    // Operator-explicit accounts with no Apollo enrichment data get a baseline floor score
    // so they make it past the topN cut. Without this, a stub (score 0) is dropped at the
    // `if (r.score === 0) break;` line below.
    const finalScore = isExplicit && r.score < 50 ? 50 : r.score;
    const finalSegment = isExplicit && r.score < 50 ? ("active" as Bucket) : r.segment;
    return {
      ...row,
      score: finalScore,
      segment: finalSegment as ScoredAccount["segment"],
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
