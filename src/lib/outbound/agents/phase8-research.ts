import { llm, extractJson } from "@/lib/onboarding/llm";
import { tavilySearch, isTavilyLive, summarizeForObservation } from "../tavily";
import { coreSignalSnapshot, isCoreSignalLive, summarizeCoreSignal } from "../coresignal";
import type { LeadResearch, PhaseState, ScoredAccount, Stakeholder } from "../types";

export interface ClientBrief {
  sellerProduct: string;
  sellerOneLineValue: string;
  sellerCapabilities: string[];
  sellerUsps: string[];
  targetSegments: string[];
  targetPersonas: string[];
  commonPainsSolved: string[];
  caseStudyWins: string[];
  antiIcp: string[];
  notes: string;
}

export interface ResearchInput {
  rows: { account: ScoredAccount; stakeholder: Stakeholder }[];
  existingNotes?: Map<string, LeadResearch>;
  onLead?: (note: { domain: string; research: LeadResearch }) => Promise<void>;
  tavilyMaxLeads?: number;
  useAi?: boolean;
  socialProofLibrary?: Record<string, string[]>;
  clientBrief?: ClientBrief;
  sellerName?: string;
  shouldCancel?: () => Promise<boolean>;
  signal?: AbortSignal;
}

export interface ResearchOutput {
  notes: { domain: string; research: LeadResearch }[];
  llmTokensIn: number;
  llmTokensOut: number;
  tavilyCalls: number;
  cacheHits: number;
}

const SYSTEM = `You are a B2B research analyst building openers for cold outbound to Indian buyers.
For each input account you must produce ONE concrete observation about the prospect's product, page, funnel, or UX pattern that a sender could plausibly cite.

Rules:
- Use category-level CRO patterns when site detail isn't available. Indian D2C apparel = size guide depth or PDP image stack. Indian fintech = long KYC, document upload pain. Indian EdTech = fee placement, EMI calculator. Indian SaaS = demo form segmentation. Marketplace = category density, COD modal.
- NEVER lead with funding/news ("Saw your Series C", "Congrats on the acquisition", "Read about your raise"). These are banned.
- The "observation_angle" must reference a specific page/funnel/UX element on the prospect's own product. ≤140 chars.
- "secondary_observation" is a backup angle on a DIFFERENT problem (different page or step). ≤120 chars.
- "signal_for_body_3" is an optional one-line breakup hook (challenge they'll face soon). ≤120 chars. May be empty string.

Output ONLY valid JSON of shape:
{ "leads": [ { "domain": "...", "observation_angle": "...", "secondary_observation": "...", "signal_for_body_3": "..." } ] }`;

const CATEGORY_HINTS: Record<string, { primary: string; secondary: string; b3: string }> = {
  retail: {
    primary: "your category page on {domain} shows 24+ SKUs above the mobile fold with small thumbnails",
    secondary: "your PDP buries fabric/care detail under a tab below the fold",
    b3: "if your tier-2/3 cohort CVR plateaus or your CAC climbs",
  },
  apparel: {
    primary: "your size guide on {domain} sits two clicks deep on every PDP",
    secondary: "your PDP image stack leads with full-look shots before fabric close-ups",
    b3: "if return rates from size mismatches start eating your margin",
  },
  ecommerce: {
    primary: "your cart shows COD as default but your pincode modal blocks the cart for ~2 seconds on mobile",
    secondary: "your category page has dense thumbnails that depress first-tap rate on lower-end devices",
    b3: "if your cart-to-checkout drop stays high after the next campaign push",
  },
  fintech: {
    primary: "your KYC step asks for PAN, Aadhaar OTP, bank linkage and a selfie liveness check across four near-back-to-back screens",
    secondary: "your homepage serves both your retail and your business segment with the same fields",
    b3: "if your KYC drop-off keeps your CAC unrealistic against the new RBI norms",
  },
  edtech: {
    primary: "your course detail pages put your fee section at the very bottom, after curriculum, faculty, schedule and testimonials",
    secondary: "your EMI calculator is collapsed under a tab, breaking the price discovery flow",
    b3: "if your free-to-paid step keeps converting below your batch target",
  },
  saas: {
    primary: "your demo form serves both your enterprise and your SMB leads with the same fields",
    secondary: "your pricing page hides per-seat detail under a 'Talk to us' modal",
    b3: "if your demo-to-SQL ratios stay flat after the new rollout",
  },
  wellness: {
    primary: "your subscription PDP buries the cancel-anytime line below the fold",
    secondary: "your bundle vs single-SKU layout makes single SKU look like the cheaper default",
    b3: "if your second-month retention dips after the trial cohort scales",
  },
  marketplace: {
    primary: "your homepage carousel rotates 5+ banners with no clear hero offer for first-time visitors",
    secondary: "your search returns with no filters above the mobile fold",
    b3: "if your tier-2 first-time buyer CVR keeps lagging your tier-1",
  },
  default: {
    primary: "your homepage hero serves multiple personas with the same CTA and copy block",
    secondary: "your pricing or demo page asks for the same fields regardless of buyer segment",
    b3: "if your demo or signup conversion plateaus this quarter",
  },
};

function fallbackResearch(domain: string, industry: string): LeadResearch {
  const key = (industry || "").toLowerCase();
  const hint = CATEGORY_HINTS[key] || CATEGORY_HINTS.default;
  return {
    observationAngle: hint.primary.replace("{domain}", domain),
    secondaryObservation: hint.secondary.replace("{domain}", domain),
    signalForBody3: hint.b3.replace("{domain}", domain),
    theirCustomers: "",
    whatTheySell: "",
    theirStage: "",
    topPain: "",
    valueAngle: "",
    socialProofMatch: [],
    subjectTopic: "",
  };
}

const PER_LEAD_SYSTEM = `You are a senior B2B research analyst working for the seller described in the input payload's "seller" object. The seller's "product_description", "one_line_value", "capabilities", "usps", "target_segments", "target_personas", "common_pains_solved", "case_study_wins", "anti_icp", and "notes" together form the seller's CLIENT BRIEF — read it before writing anything. Your job is to map each prospect to that brief.

For every account you receive, you must:

1. UNDERSTAND who this account actually is — what they sell, who they sell to (their customers), what stage they're at (early growth, scale-up, mature, listed, etc.), what their growth motion looks like.
2. CHECK against the seller's "anti_icp" — if the prospect matches anti-ICP (wrong stage, wrong size, wrong segment, in the seller's anti-list), set top_pain to "ANTI-ICP: <reason>" and skip steps 3-5; downstream the system will flag this lead.
3. IDENTIFY the single most likely pain point they're feeling RIGHT NOW. Pick from the seller's "common_pains_solved" list when there's a match — these are the pains the seller actually solves. Then specialize that pain to THIS prospect's situation (their stage + their customers + any signals in Tavily research and CoreSignal data — use CoreSignal job postings, headcount growth, funding, and tech-stack as primary intent signals; they're more reliable than web search snippets).
4. CONNECT that pain to a specific value from the seller's "capabilities" + "usps". The "value_angle" you produce should reference the most relevant capability by name and (if relevant) one USP the prospect would care about.
5. PICK three social-proof brands. Strongly prefer entries from "case_study_wins" that match the prospect's segment — quote the metric where possible. Fall back to "social_proof_roster" entries when no case-study match exists.
6. DRAFT a soft observation tied to their actual product — something a real human SDR would notice from looking at their site for 60 seconds, framed in the seller's vocabulary.

Hard rules:
- Never invent metrics, customers, or facts the Tavily research, CoreSignal data, or the brief don't support.
- Never lead with news/funding ("Series C", "acquisition", "new CEO") in the observation.
- The observation must be true of their site/product but expressed softly — category-level wording is fine if the Tavily notes are thin.
- The pain point and value angle must be SPECIFIC TO THEM, not industry-generic. If you'd write the same pain for any company in this industry, you haven't done the work.
- "subject_topic" must paraphrase the prospect's specific pain in 3-5 title-case words — NOT the seller's generic pitch.

Output ONLY valid JSON of shape:
{
  "their_customers": "1 short line — who this account sells to (e.g., 'mid-market Indian D2C apparel brands shopping on mobile')",
  "what_they_sell": "1 short line — their product/service",
  "their_stage": "one of: pre-pmf | early-growth | scale-up | mature | listed | unknown",
  "top_pain": "1-2 lines — the most likely pain point THEY are feeling right now, specific to their situation",
  "value_angle": "1-2 lines — how the seller's product solves their top_pain, naming the most relevant capability",
  "social_proof_match": ["Brand1","Brand2","Brand3"],
  "subject_topic": "3-5 word title-case topic for the cold email subject line, specific to their pain (e.g., 'Improving D2C Mobile Conversion', 'Reducing KYC Drop-Off')",
  "observation_angle": "1 short sentence — soft observation about their site/product that anchors body 1 (≤180 chars)",
  "secondary_observation": "1 short sentence — alternate angle for body 2 (different page/step than primary, ≤140 chars)",
  "signal_for_body_3": "1 short sentence — challenge they will face if they don't act soon (≤140 chars, may be empty)"
}`;

async function researchOneLead(
  row: { account: ScoredAccount; stakeholder: Stakeholder },
  useTavily: boolean,
  proofPool: string[],
  brief: ClientBrief | undefined,
  sellerName: string,
  signal?: AbortSignal,
): Promise<{ research: LeadResearch; tokensIn: number; tokensOut: number; tavilyUsed: boolean; coreSignalUsed: boolean; tavilyError?: string; coreSignalError?: string }> {
  let businessNotes = "";
  let growthNotes = "";
  let coreSignalNotes = "";
  let tavilyUsed = false;
  let coreSignalUsed = false;
  let tavilyError: string | undefined;
  let coreSignalError: string | undefined;

  const coreSignalLive = isCoreSignalLive();
  const tavilyAndCoreSignal = await Promise.allSettled([
    useTavily
      ? tavilySearch(
          `${row.account.name} ${row.account.domain} customers products business model what they do`,
          { searchDepth: "advanced", maxResults: 4, signal },
        )
      : Promise.reject(new Error("tavily disabled")),
    useTavily
      ? tavilySearch(
          `${row.account.name} growth funding hiring expansion challenges scale conversion`,
          { searchDepth: "advanced", maxResults: 4, signal },
        )
      : Promise.reject(new Error("tavily disabled")),
    coreSignalLive
      ? coreSignalSnapshot(row.account.domain, signal)
      : Promise.reject(new Error("coresignal disabled")),
  ]);

  const [biz, growth, csnap] = tavilyAndCoreSignal;
  if (biz.status === "fulfilled") {
    businessNotes = summarizeForObservation(row.account.domain, biz.value);
    tavilyUsed = true;
  } else if (useTavily) {
    tavilyError = biz.reason instanceof Error ? biz.reason.message : "unknown";
  }
  if (growth.status === "fulfilled") {
    growthNotes = summarizeForObservation(row.account.domain, growth.value);
    tavilyUsed = true;
  } else if (useTavily && !tavilyError) {
    tavilyError = growth.reason instanceof Error ? growth.reason.message : "unknown";
  }
  if (csnap.status === "fulfilled") {
    coreSignalNotes = summarizeCoreSignal(csnap.value);
    coreSignalUsed = csnap.value.company !== null || csnap.value.recentJobs.length > 0;
    if (!coreSignalUsed && csnap.value.errors.length > 0) coreSignalError = csnap.value.errors[0];
  } else if (coreSignalLive) {
    coreSignalError = csnap.reason instanceof Error ? csnap.reason.message : "unknown";
  }

  const userPayload = {
    account: {
      domain: row.account.domain,
      company: row.account.name,
      industry: row.account.industry,
      employees: row.account.estimatedNumEmployees,
      keywords: row.account.keywords.slice(0, 8),
      short_description: row.account.shortDescription,
      country: row.account.country,
      revenue: row.account.organizationRevenuePrinted,
      founded_year: row.account.foundedYear,
    },
    contact_title: row.stakeholder.title,
    seller: {
      seller_name: sellerName || "VWO",
      product_description: brief?.sellerProduct || "",
      one_line_value: brief?.sellerOneLineValue || "",
      capabilities: (brief && brief.sellerCapabilities.length > 0)
        ? brief.sellerCapabilities
        : ["A/B Testing", "Behaviour Analytics", "Personalization", "Funnel Analytics", "Heatmaps & Session Recording", "Form Analytics"],
      usps: brief?.sellerUsps || [],
      target_segments: brief?.targetSegments || [],
      target_personas: brief?.targetPersonas || [],
      common_pains_solved: brief?.commonPainsSolved || [],
      case_study_wins: brief?.caseStudyWins || [],
      anti_icp: brief?.antiIcp || [],
      notes: brief?.notes || "",
      social_proof_roster: proofPool.slice(0, 12),
    },
    tavily_business_research: businessNotes || "(no business research available)",
    tavily_growth_research: growthNotes || "(no growth research available)",
    coresignal_signals: coreSignalNotes || "(no CoreSignal data available)",
  };

  const fallback = fallbackResearch(row.account.domain, row.account.industry);
  const fallbackJson = JSON.stringify({
    their_customers: "",
    what_they_sell: row.account.shortDescription || "",
    their_stage: "unknown",
    top_pain: "",
    value_angle: "",
    social_proof_match: proofPool.slice(0, 3),
    subject_topic: "Improving Conversions",
    observation_angle: fallback.observationAngle,
    secondary_observation: fallback.secondaryObservation,
    signal_for_body_3: fallback.signalForBody3,
  });

  const result = await llm({
    system: PER_LEAD_SYSTEM,
    cacheSystem: true,
    model: "sonnet",
    user: `Research and synthesize for this single account. Use the Tavily research to ground every claim. Pick the three social-proof brands that this account would find most compelling from the roster (must be drawn from social_proof_roster — never invent).\n\n\`\`\`json\n${JSON.stringify(userPayload, null, 2)}\n\`\`\``,
    jsonOnly: true,
    maxTokens: 900,
    mockOutput: fallbackJson,
  });

  type Parsed = {
    their_customers?: string;
    what_they_sell?: string;
    their_stage?: string;
    top_pain?: string;
    value_angle?: string;
    social_proof_match?: string[];
    subject_topic?: string;
    observation_angle?: string;
    secondary_observation?: string;
    signal_for_body_3?: string;
  };
  const parsed = extractJson<Parsed>(result.text, JSON.parse(fallbackJson) as Parsed);
  const validatedProof = (parsed.social_proof_match || []).filter((b) => proofPool.includes(b)).slice(0, 3);
  const research: LeadResearch = {
    observationAngle: (parsed.observation_angle || fallback.observationAngle).trim(),
    secondaryObservation: (parsed.secondary_observation || fallback.secondaryObservation).trim(),
    signalForBody3: (parsed.signal_for_body_3 || fallback.signalForBody3).trim(),
    theirCustomers: (parsed.their_customers || "").trim(),
    whatTheySell: (parsed.what_they_sell || row.account.shortDescription || "").trim(),
    theirStage: (parsed.their_stage || "unknown").trim(),
    topPain: (parsed.top_pain || "").trim(),
    valueAngle: (parsed.value_angle || "").trim(),
    socialProofMatch: validatedProof.length === 3 ? validatedProof : proofPool.slice(0, 3),
    subjectTopic: (parsed.subject_topic || "Improving Conversions").trim(),
  };

  return {
    research,
    tokensIn: result.inputTokens,
    tokensOut: result.outputTokens,
    tavilyUsed,
    coreSignalUsed,
    tavilyError,
    coreSignalError,
  };
}

export async function researchAgent(input: ResearchInput): Promise<{ output: ResearchOutput; state: Pick<PhaseState, "log" | "metrics" | "inputCount" | "outputCount" | "llmTokensIn" | "llmTokensOut"> }> {
  const log: string[] = [];
  const notes: { domain: string; research: LeadResearch }[] = [];
  const useAi = input.useAi === true;
  const tavilyAvailable = useAi && isTavilyLive();
  const coreSignalAvailable = useAi && isCoreSignalLive();
  const tavilyBudget = input.tavilyMaxLeads ?? 30;
  const cache = input.existingNotes || new Map<string, LeadResearch>();

  if (!useAi) {
    log.push("Deterministic mode: zero LLM/Tavily/CoreSignal cost. Per-industry observation table only.");
  } else {
    log.push(tavilyAvailable ? `Tavily live. Budget: up to ${tavilyBudget} per-lead searches (Tier A+B).` : "Tavily mock: TAVILY_API_KEY not set, using category-level fallbacks.");
    log.push(coreSignalAvailable ? `CoreSignal live: structured signals (jobs, headcount, funding, tech) on top of Tavily.` : "CoreSignal off: CORESIGNAL_API_KEY not set.");
  }

  let tokensIn = 0, tokensOut = 0, tavilyCalls = 0, cacheHits = 0, tavilyErrors = 0;
  let coreSignalCalls = 0, coreSignalErrors = 0;

  if (!useAi) {
    for (const row of input.rows) {
      const domain = row.account.domain;
      const cached = cache.get(domain);
      if (cached && cached.observationAngle) {
        notes.push({ domain, research: cached });
        cacheHits++;
      } else {
        const research = fallbackResearch(domain, row.account.industry);
        notes.push({ domain, research });
      }
      if (input.onLead) {
        try { await input.onLead(notes[notes.length - 1]); } catch {}
      }
    }
    log.push(`Generated ${notes.length} observations (deterministic, ${cacheHits} cached).`);
    return {
      output: { notes, llmTokensIn: 0, llmTokensOut: 0, tavilyCalls: 0, cacheHits },
      state: {
        log,
        metrics: { observations: notes.length, cacheHits, mode: "deterministic" },
        inputCount: input.rows.length,
        outputCount: notes.length,
        llmTokensIn: 0,
        llmTokensOut: 0,
      },
    };
  }

  for (let i = 0; i < input.rows.length; i++) {
    if (input.signal?.aborted) { log.push(`Aborted at ${i}/${input.rows.length}.`); break; }
    if (input.shouldCancel && await input.shouldCancel()) { log.push("Cancelled by user during research."); break; }
    const row = input.rows[i];
    const domain = row.account.domain;

    const cached = cache.get(domain);
    if (cached && cached.observationAngle) {
      notes.push({ domain, research: cached });
      cacheHits++;
      if (input.onLead) {
        try { await input.onLead({ domain, research: cached }); } catch {}
      }
      continue;
    }

    const useTavily = tavilyAvailable && i < tavilyBudget;
    const segmentKey = (row.account.industry || "").toLowerCase();
    const proofPool = (input.socialProofLibrary && (input.socialProofLibrary[segmentKey] || input.socialProofLibrary["default"])) || ["ICICI Bank", "Wakefit", "TVS Motor"];
    const r = await researchOneLead(row, useTavily, proofPool, input.clientBrief, input.sellerName || "VWO", input.signal);
    tokensIn += r.tokensIn;
    tokensOut += r.tokensOut;
    if (r.tavilyUsed) tavilyCalls++;
    if (r.tavilyError) {
      tavilyErrors++;
      if (tavilyErrors <= 3) log.push(`Tavily failed for ${domain}: ${r.tavilyError}`);
    }
    if (r.coreSignalUsed) coreSignalCalls++;
    if (r.coreSignalError) {
      coreSignalErrors++;
      if (coreSignalErrors <= 3) log.push(`CoreSignal failed for ${domain}: ${r.coreSignalError}`);
    }

    const note = { domain, research: r.research };
    notes.push(note);
    if (input.onLead) {
      try { await input.onLead(note); } catch (err) {
        log.push(`Persist callback failed for ${domain}: ${err instanceof Error ? err.message : "unknown"}`);
      }
    }
  }

  log.push(`Generated ${notes.length} observation sets. Cache hits: ${cacheHits}. Tavily calls: ${tavilyCalls}${tavilyErrors > 0 ? ` (${tavilyErrors} errors)` : ""}. CoreSignal hits: ${coreSignalCalls}${coreSignalErrors > 0 ? ` (${coreSignalErrors} errors)` : ""}. LLM tokens in/out: ${tokensIn}/${tokensOut}.`);

  return {
    output: { notes, llmTokensIn: tokensIn, llmTokensOut: tokensOut, tavilyCalls, cacheHits },
    state: {
      log,
      metrics: { observations: notes.length, tokensIn, tokensOut, tavilyCalls, tavilyErrors, coreSignalCalls, coreSignalErrors, cacheHits, tavilyAvailable: tavilyAvailable ? 1 : 0, coreSignalAvailable: coreSignalAvailable ? 1 : 0 },
      inputCount: input.rows.length,
      outputCount: notes.length,
      llmTokensIn: tokensIn,
      llmTokensOut: tokensOut,
    },
  };
}
