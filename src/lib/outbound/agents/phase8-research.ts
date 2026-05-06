import { llm, extractJson } from "@/lib/onboarding/llm";
import { tavilySearch, isTavilyLive, summarizeForObservation } from "../tavily";
import { coreSignalSnapshot, isCoreSignalLive, summarizeCoreSignal } from "../coresignal";
import { apifySnapshot, isApifyLive, type ApifySnapshotResult } from "../apify";
import { classifySignals, summarizeSignalsForLLM, mergeApifyIntoCoreSignal, type StructuredSignals } from "./signals";
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

export interface InsightStrategy {
  championTitles: string[];
  buyerJourneyTitles: string[];
  postKeywords: string[];
  intentSignalsToPrioritize: string[];
  jobTitleKeywordsHiring: string[];
  techStackToWatch: string[];
  rationale: string;
}

export interface ResearchInput {
  rows: { account: ScoredAccount; stakeholder: Stakeholder }[];
  existingNotes?: Map<string, LeadResearch>;
  onLead?: (note: { domain: string; research: LeadResearch }) => Promise<void>;
  tavilyMaxLeads?: number;
  useAi?: boolean;
  socialProofLibrary?: Record<string, string[]>;
  clientBrief?: ClientBrief;
  insightStrategy?: InsightStrategy;
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

const SOCIAL_PROOF_DEFAULTS: Record<string, string[]> = {
  retail: ["BigBasket", "Yuppiechef", "eBay"],
  apparel: ["Andaaz Fashion", "Attrangi", "Utsav Fashion"],
  ecommerce: ["BigBasket", "Yuppiechef", "Lenskart"],
  fintech: ["PayU", "HDFC Bank", "ICICI Bank"],
  bfsi: ["HDFC Bank", "ICICI Bank", "PayU"],
  banking: ["HDFC Bank", "ICICI Bank", "PayU"],
  insurance: ["HDFC Bank", "ICICI Bank", "PayU"],
  edtech: ["Online Manipal", "UNext", "BYJU'S"],
  saas: ["POSist", "PayScale", "ChargeBee"],
  wellness: ["Amway", "Wakefit", "boAt"],
  marketplace: ["BigBasket", "eBay", "BookMyShow"],
  jobs: ["BookMyShow", "BigBasket", "eBay"],
  recruitment: ["BookMyShow", "BigBasket", "eBay"],
  staffing: ["BookMyShow", "BigBasket", "eBay"],
  internet: ["BigBasket", "BookMyShow", "Yatra"],
  travel: ["Yatra", "Singapore Airlines", "BookMyShow"],
  hospitality: ["Yatra", "Singapore Airlines", "BookMyShow"],
  automotive: ["Hyundai", "TVS Motor", "Lenskart"],
  healthcare: ["BigBasket", "Wakefit", "HDFC Bank"],
  beauty: ["Lenskart", "Wakefit", "boAt"],
  food: ["BigBasket", "Yuppiechef", "BookMyShow"],
  media: ["BookMyShow", "Yatra", "BigBasket"],
  telecom: ["HDFC Bank", "ICICI Bank", "BigBasket"],
  realestate: ["HDFC Bank", "ICICI Bank", "BigBasket"],
  gaming: ["BookMyShow", "BigBasket", "boAt"],
  d2c: ["Lenskart", "Wakefit", "boAt"],
  default: ["BigBasket", "HDFC Bank", "Lenskart"],
};

const SOCIAL_PROOF_KEYWORDS: Record<string, string> = {
  "human resources": "jobs",
  "staffing": "staffing",
  "recruit": "recruitment",
  "job": "jobs",
  "career": "jobs",
  "hiring": "recruitment",
  "internet": "internet",
  "online": "internet",
  "marketplace": "marketplace",
  "platform": "internet",
  "saas": "saas",
  "software": "saas",
  "fintech": "fintech",
  "bank": "banking",
  "insurance": "insurance",
  "lending": "fintech",
  "payment": "fintech",
  "education": "edtech",
  "edtech": "edtech",
  "learning": "edtech",
  "wellness": "wellness",
  "fitness": "wellness",
  "supplement": "wellness",
  "ayurved": "wellness",
  "travel": "travel",
  "hospitality": "hospitality",
  "hotel": "hospitality",
  "tourism": "travel",
  "automotive": "automotive",
  "vehicle": "automotive",
  "healthcare": "healthcare",
  "medical": "healthcare",
  "pharma": "healthcare",
  "diagnostic": "healthcare",
  "beauty": "beauty",
  "cosmetic": "beauty",
  "skincare": "beauty",
  "food": "food",
  "grocery": "food",
  "restaurant": "food",
  "fmcg": "food",
  "media": "media",
  "entertainment": "media",
  "music": "media",
  "publish": "media",
  "telecom": "telecom",
  "real estate": "realestate",
  "realty": "realestate",
  "gaming": "gaming",
  "game": "gaming",
  "esport": "gaming",
  "d2c": "d2c",
  "direct to consumer": "d2c",
  "apparel": "apparel",
  "fashion": "apparel",
  "clothing": "apparel",
  "retail": "retail",
  "ecommerce": "ecommerce",
  "e-commerce": "ecommerce",
};

export function resolveProofPool(
  account: { industry?: string; secondaryIndustries?: string[]; keywords?: string[]; domain?: string; shortDescription?: string },
  library: Record<string, string[]> | undefined,
  caseStudyWins: string[] | undefined,
): string[] {
  const lib = library && Object.keys(library).length > 0 ? library : SOCIAL_PROOF_DEFAULTS;

  const industry = (account.industry || "").toLowerCase().trim();
  if (industry && lib[industry] && lib[industry].length > 0) return lib[industry];

  const blob = [
    industry,
    ...(account.secondaryIndustries || []).map((s) => s.toLowerCase()),
    ...(account.keywords || []).map((s) => s.toLowerCase()),
    (account.domain || "").toLowerCase(),
    (account.shortDescription || "").toLowerCase(),
  ].join(" ");

  for (const [needle, key] of Object.entries(SOCIAL_PROOF_KEYWORDS)) {
    if (blob.includes(needle) && lib[key] && lib[key].length > 0) return lib[key];
  }

  if (caseStudyWins && caseStudyWins.length >= 3) return caseStudyWins.slice(0, 3);
  if (caseStudyWins && caseStudyWins.length > 0 && lib.default && lib.default.length > 0) {
    return [...caseStudyWins, ...lib.default].slice(0, 3);
  }

  return lib.default && lib.default.length > 0 ? lib.default : ["BigBasket", "HDFC Bank", "Lenskart"];
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

interface CategoryHint { primary: string[]; secondary: string[]; b3: string[] }
const CATEGORY_HINTS: Record<string, CategoryHint> = {
  retail: {
    primary: [
      "your category page on {domain} shows 24+ SKUs above the mobile fold with small thumbnails",
      "your PDP image stack on {domain} leads with full-shots before close-ups, slowing the first scroll",
      "your filter sidebar on {domain} lives below the mobile grid instead of above it",
      "your add-to-cart on {domain} pops a modal that blocks the next-product browse",
      "your homepage carousel on {domain} rotates 5+ banners before the curated grid loads",
      "your search bar on {domain} sits collapsed under a magnifier icon on mobile",
    ],
    secondary: [
      "your PDP buries fabric/care detail under a tab below the fold",
      "your sort dropdown defaults to 'Popular' which makes new arrivals invisible to repeat visitors",
      "your cross-sell strip on PDP shows 8 items with one row scroll on mobile",
      "your wishlist requires login before letting a visitor add",
    ],
    b3: [
      "if your tier-2/3 cohort CVR plateaus or your CAC climbs",
      "if your repeat-buyer rate flattens after the next sale cycle",
      "if AOV stays flat while paid traffic costs keep climbing",
    ],
  },
  apparel: {
    primary: [
      "your size guide on {domain} sits two clicks deep on every PDP",
      "your fabric & care detail on {domain} is collapsed under a tab below the fold",
      "your PDP image stack on {domain} leads with editorial shots before product detail",
      "your fit-finder on {domain} is buried under a 'Need help?' link instead of in the size step",
      "your color-swatch UI on {domain} requires a tap to see each color in stock",
      "your cart on {domain} doesn't show estimated delivery date until the address step",
    ],
    secondary: [
      "your PDP image stack leads with full-look shots before fabric close-ups",
      "your size chart units are CM-only with no inches toggle for tier-2 buyers",
      "your return policy lives 3 clicks deep instead of on the PDP",
    ],
    b3: [
      "if return rates from size mismatches start eating your margin",
      "if your wedding-season AOV doesn't lift the way last year's did",
      "if your bounce on PDP stays above 60% on mobile after the next collection drop",
    ],
  },
  ecommerce: {
    primary: [
      "your cart on {domain} shows COD as default but your pincode modal blocks for ~2 seconds on mobile",
      "your checkout on {domain} asks for OTP twice — once for login, once for delivery confirmation",
      "your cart on {domain} doesn't show a clear delivery date until checkout step 2",
      "your category page on {domain} loads 24+ SKUs with no visible filter applied",
      "your homepage on {domain} doesn't surface returning-user picks above the fold",
      "your add-to-cart on {domain} fires a full-page reload on mobile instead of an inline drawer",
    ],
    secondary: [
      "your category page has dense thumbnails that depress first-tap rate on lower-end devices",
      "your search autocomplete only triggers after 3 characters on mobile",
      "your trust badges sit below the fold on the cart page",
    ],
    b3: [
      "if your cart-to-checkout drop stays high after the next campaign push",
      "if your pincode-block rate keeps growing in tier-2 cities",
      "if your COD return rate stays above 25% on first-time buyers",
    ],
  },
  fintech: {
    primary: [
      "your KYC step on {domain} asks for PAN, Aadhaar OTP, bank linkage and a selfie liveness check across four near-back-to-back screens",
      "your sign-up on {domain} requires phone OTP before showing any product detail",
      "your loan calculator on {domain} sits below the fold on the homepage",
      "your application on {domain} doesn't save partial state — a refresh wipes everything",
      "your pricing on {domain} is hidden behind 'Apply now' on every plan card",
      "your KYC restarts on {domain} if you switch from mobile to desktop mid-flow",
    ],
    secondary: [
      "your homepage serves both your retail and your business segment with the same fields",
      "your trust signals (RBI registered, ISO badges) live in the footer, not the application step",
      "your interest-rate disclosure is in fine print under the apply button",
    ],
    b3: [
      "if your KYC drop-off keeps your CAC unrealistic against the new RBI norms",
      "if your application-to-funding ratio stays below 30% next quarter",
      "if your underwriter override rate keeps growing on tier-2 applications",
    ],
  },
  edtech: {
    primary: [
      "your course pages on {domain} put the fee section at the very bottom, after curriculum, faculty, schedule and testimonials",
      "your EMI calculator on {domain} is collapsed under a tab, breaking the price discovery flow",
      "your demo signup on {domain} asks for parent + student phone before showing the curriculum",
      "your free-trial CTA on {domain} requires a 4-field form with payment-mode upfront",
      "your course catalog on {domain} hides difficulty/duration in a tooltip on each tile",
      "your live-class schedule on {domain} doesn't show timezone-localized to the visitor",
    ],
    secondary: [
      "your EMI calculator is collapsed under a tab, breaking the price discovery flow",
      "your faculty cards have headshots but no LinkedIn / track record link",
      "your free-content gate fires before the visitor sees any curriculum",
    ],
    b3: [
      "if your free-to-paid step keeps converting below your batch target",
      "if your tier-2 admission funnel stalls after the JEE/NEET cycle ends",
      "if your refund-rate within 7 days starts climbing on the new cohort",
    ],
  },
  saas: {
    primary: [
      "your demo form on {domain} serves both enterprise and SMB leads with the same fields",
      "your pricing on {domain} hides per-seat detail under a 'Talk to us' modal",
      "your signup on {domain} demands company size + use-case before showing the product UI",
      "your trial on {domain} requires a credit card upfront",
      "your homepage on {domain} pitches 4 personas in 4 hero sections with no clear path",
      "your product page on {domain} has 3 long video walkthroughs but no quick interactive tour",
    ],
    secondary: [
      "your pricing page hides per-seat detail under a 'Talk to us' modal",
      "your integrations grid on the homepage shows 30 logos but no use-case labels",
      "your case-study list filters by industry but not by company stage",
    ],
    b3: [
      "if your demo-to-SQL ratios stay flat after the new rollout",
      "if your trial-to-paid stays below 8% on the next cohort",
      "if your time-to-first-value KPI keeps slipping past 7 days",
    ],
  },
  wellness: {
    primary: [
      "your subscription PDP on {domain} buries the cancel-anytime line below the fold",
      "your quiz CTA on {domain} routes to a long form before showing any plan detail",
      "your bundle pricing on {domain} doesn't surface savings versus single-SKU side by side",
      "your repeat-order toggle on {domain} requires going through the cart step again",
      "your homepage on {domain} leads with founder photo but no clear product-fit guidance",
      "your before/after carousel on {domain} loads after the fold on mobile",
    ],
    secondary: [
      "your bundle vs single-SKU layout makes single SKU look like the cheaper default",
      "your subscription cadence picker is hidden under an accordion",
      "your trial period terms aren't on the PDP — only on the cart step",
    ],
    b3: [
      "if your second-month retention dips after the trial cohort scales",
      "if your subscriber churn climbs on the lifestyle plan after the next price update",
      "if your cancel-rate at month 3 stays above 30%",
    ],
  },
  marketplace: {
    primary: [
      "your homepage carousel on {domain} rotates 5+ banners with no clear hero offer for first-time visitors",
      "your search returns on {domain} have no filters above the mobile fold",
      "your seller filter on {domain} is buried under 'More options' on category pages",
      "your category cards on {domain} all use the same generic stock images",
      "your delivery-area picker on {domain} resets on every category change",
      "your wishlist on {domain} requires creating an account before the first save",
    ],
    secondary: [
      "your search returns with no filters above the mobile fold",
      "your trust badges (verified seller, GST) load below the fold on PDP",
      "your reviews section shows star count without recency or verified-buyer flag",
    ],
    b3: [
      "if your tier-2 first-time buyer CVR keeps lagging your tier-1",
      "if your seller-listing-to-sale ratio plateaus on the next category expansion",
      "if your search-to-add-to-cart rate stays under 8% after the next refresh",
    ],
  },
  default: {
    primary: [
      "your homepage hero on {domain} serves multiple personas with the same CTA and copy block",
      "your demo form on {domain} doesn't differentiate between buyer types",
      "your pricing on {domain} requires a click into details before showing any number",
      "your contact form on {domain} asks for company size before phone or email",
      "your blog category on {domain} doesn't show recency on each post tile",
      "your nav on {domain} hides the case-study section under 'Resources'",
    ],
    secondary: [
      "your pricing or demo page asks for the same fields regardless of buyer segment",
      "your case-study list is unfiltered by industry or stage",
      "your testimonials carry star ratings but no sender role",
    ],
    b3: [
      "if your demo or signup conversion plateaus this quarter",
      "if your blog-to-trial conversion stays under 1% after the next launch",
      "if your sales-cycle on the next quarter doesn't compress",
    ],
  },
};

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h * 31 + s.charCodeAt(i)) | 0) >>> 0;
  return h;
}

function fallbackResearch(domain: string, industry: string): LeadResearch {
  const key = (industry || "").toLowerCase();
  const hint = CATEGORY_HINTS[key] || CATEGORY_HINTS.default;
  const seed = hashCode(domain);
  const p = hint.primary[seed % hint.primary.length];
  const s = hint.secondary[Math.floor(seed / 7) % hint.secondary.length];
  const b = hint.b3[Math.floor(seed / 13) % hint.b3.length];
  return {
    observationAngle: p.replace("{domain}", domain),
    secondaryObservation: s.replace("{domain}", domain),
    signalForBody3: b.replace("{domain}", domain),
    theirCustomers: "",
    whatTheySell: "",
    theirStage: "",
    topPain: "",
    valueAngle: "",
    socialProofMatch: [],
    subjectTopic: "",
  };
}

const RESEARCH_PLANNER_SYSTEM = `You are the orchestrating brain of an outbound research system. For each prospect account + stakeholder, you decide WHICH external lookups to fire — what Tavily queries to issue, what Apify configs to use, what observation surfaces to target.

Tools available:
- TAVILY (web search) — best for: India press, blogs, podcasts, conferences, Substack/Medium, Twitter/X. Limited LinkedIn access. Site-targeted queries (site:inc42.com, site:moneycontrol.com, site:economictimes.indiatimes.com, site:livemint.com, site:yourstory.com, site:entrackr.com, site:ken.in, site:thearcweb.com, site:saasboomi.in, site:nasscom.in, site:ethrworld.com, site:etcio.com, site:etbrandequity.com) drastically improve quality vs generic web search.
- APIFY (LinkedIn) — company scraper, jobs scraper, profile scraper for the named stakeholder.

You decide based on:
1. The seller's brief (what they sell, who they sell to, common pains, target personas)
2. The prospect's stage, industry, size, country
3. The stakeholder's title and LinkedIn URL (if present)
4. The insight strategy (champion titles, post keywords, intent signals to prioritize)

Output a JSON plan that downstream code uses verbatim. Hard rules:
- Tavily query #1 should focus on the prospect's BUSINESS / customers / product (not the seller). 7-12 words. Include site-targeted operators when useful.
- Tavily query #2 should focus on INTENT signals (hiring, funding, growth, leadership change, expansion, news, recent launches, conference talks). 7-12 words.
- post_keywords_to_filter: 3-8 lowercase phrases relevant to the seller's pain mapping. These will filter the stakeholder's recent LinkedIn posts.
- title_keywords_to_search: 4-6 LinkedIn-style title fragments to find OTHER champion-titled people at the company (used only when the named stakeholder has no LinkedIn URL).
- observation_surface_priorities: 3-5 ranked surfaces for axis-1 observations if Tavily/Apify return thin (e.g., "checkout flow", "demo form", "pricing page", "category density on mobile"). These should match the prospect's actual product type.
- prospect_specific_anchor_hint: 1 short note about something specific to this prospect that the synthesis step should try to anchor on (e.g., "they sell to tier-2 NEET aspirants — anchor to fee placement and EMI") — this is your prediction of what's likely most observable for THIS prospect.

Output ONLY valid JSON of shape:
{
  "tavily_queries": [string, string],
  "post_keywords_to_filter": [string],
  "title_keywords_to_search": [string],
  "observation_surface_priorities": [string],
  "prospect_specific_anchor_hint": string,
  "rationale": "1 short sentence — why these choices for this specific prospect"
}`;

const PER_LEAD_SYSTEM = `You are a senior B2B research analyst working for the seller described in the input payload's "seller" object. The seller's "product_description", "one_line_value", "capabilities", "usps", "target_segments", "target_personas", "common_pains_solved", "case_study_wins", "anti_icp", and "notes" together form the seller's CLIENT BRIEF — read it before writing anything. Your job is to map each prospect to that brief.

For every account you receive, you must:

1. UNDERSTAND who this account actually is — what they sell, who they sell to (their customers), what stage they're at (early growth, scale-up, mature, listed, etc.), what their growth motion looks like.
2. CHECK against the seller's "anti_icp" — if the prospect matches anti-ICP (wrong stage, wrong size, wrong segment, in the seller's anti-list), set top_pain to "ANTI-ICP: <reason>" and skip steps 3-5; downstream the system will flag this lead.
3. IDENTIFY the single most likely pain point they're feeling RIGHT NOW. Pick from the seller's "common_pains_solved" list when there's a match — these are the pains the seller actually solves. Then specialize that pain to THIS prospect's situation. The "insight_strategy" block (when present) tells you which signals matter most for THIS seller — specifically:
   - Members the strategy considers champion-titled (their recent posts/role-changes are HIGH signal)
   - "post_keywords_to_weight" — when these appear in a champion's recent activity, that's a buying signal you should cite in top_pain
   - "intent_signals_to_prioritize" — rank-ordered list; weight top signals more heavily
   - "hiring_keywords_signaling_pain" — when CoreSignal job postings include these fragments, that's a strong active-pain signal
   Use the CoreSignal job postings, headcount growth, funding, member activity, and tech-stack as primary intent signals; they're more reliable than web search snippets.
4. CONNECT that pain to a specific value from the seller's "capabilities" + "usps". The "value_angle" you produce should reference the most relevant capability by name and (if relevant) one USP the prospect would care about.
5. PICK three social-proof brands. Strongly prefer entries from "case_study_wins" that match the prospect's segment — quote the metric where possible. Fall back to "social_proof_roster" entries when no case-study match exists.
6. DRAFT a soft observation tied to their actual product — something a real human SDR would notice from looking at their site for 60 seconds, framed in the seller's vocabulary.

Hard rules:
- Never invent metrics, customers, or facts the Tavily research, CoreSignal data, structured_signals, or the brief don't support.
- Never lead with news/funding ("Series C", "acquisition", "new CEO") in the observation.
- The "evidence_list" in the input is the SHARPEST observable evidence pulled from CoreSignal + Apify. If it's non-empty, your "observation_angle" MUST reference one specific item from that list (a job title, a champion's recent post, a headcount delta, a competitor in their stack, etc.). Do NOT default to category-level language when concrete evidence exists.
- When "structured_signals" includes a champion-titled LEADERSHIP entry with recent posts, that is AXIS-2 (lead-level) data — ALWAYS prefer it over company-level observations. Quote a specific phrase from one of their recent posts in the observation_angle when it's directly relevant. The opener should sound like "Saw your post on <topic>…" — referencing what THIS specific person, by name, has been writing/sharing.
- When the LEADERSHIP recent_posts contain match for "post_keywords_to_weight", treat that as the STRONGEST signal possible (axis-2 fresh + topically aligned). buyer_signal_score above 60 is justified in that case alone.
- If "evidence_list" is empty, you may use a category-level observation, but pick a NON-OBVIOUS one for this prospect's specific industry+stage combo. Every account in this batch should produce a different observation_angle — if you'd write the same observation for two different prospects in the same industry, you haven't read the data closely enough.
- The "fallback_observation" in the input is a deterministic starting point computed from a domain hash. NEVER copy it verbatim. Use it as inspiration for surface (cart, KYC, PDP, course-page, etc.), but personalize it: pick a DIFFERENT element on that surface, or vary the phrasing, or add a number/page/element specific to this prospect (e.g., if fallback says "your category page shows 24+ SKUs", you might say "your category grid feels heavy on a 5-inch device" or "your filter strip lives below the grid on mobile"). Two accounts with identical industry must produce identical fallback_observation strings — your job is to make them DIFFERENT in the actual output by re-wording, sharpening, or pivoting to a different observable surface on the prospect's site.
- Account-specific anchors REQUIRED in observation_angle: include AT LEAST ONE of: (a) the prospect's actual company name or domain, (b) a specific product/page/flow on their site (cart, KYC, PDP, demo form, signup, pricing, etc.), (c) a specific number or detail referenced in the fallback or evidence, (d) the named stakeholder if their LinkedIn data is present. Generic phrasing like "your homepage" or "your site" without a specific anchor FAILS the rule.
- The "claude_research_plan" field shows the plan the orchestrating Claude (you, on a previous call) made for this prospect. Honor the "prospect_specific_anchor_hint" if it's non-empty — that was your own prediction of what's most observable here. The "observation_surface_priorities" tell you which surfaces to prefer when no concrete evidence exists.
- The pain point and value angle must be SPECIFIC TO THEM, not industry-generic. Tie pain to evidence: "they're hiring a Senior CRO Lead → conversion tooling is a current priority" beats "as a D2C brand, they likely care about conversion".
- "subject_topic" must paraphrase the prospect's specific pain in 3-5 title-case words — NOT the seller's generic pitch.
- "buyer_signal_score" in the input is a 0-100 score from the rule layer. Treat 60+ as high-confidence; 30-59 as medium; <30 as speculative. Set "confidence_level" accordingly.

Output ONLY valid JSON of shape:
{
  "their_customers": "1 short line — who this account sells to (e.g., 'mid-market Indian D2C apparel brands shopping on mobile')",
  "what_they_sell": "1 short line — their product/service",
  "their_stage": "one of: pre-pmf | early-growth | scale-up | mature | listed | unknown",
  "buying_hypothesis": "1-2 sentences — a falsifiable hypothesis about WHY they would buy now, tied to specific evidence (e.g., 'They hired a Senior CRO Manager 3 months ago and have 2 conversion-aligned roles open — they're rebuilding the funnel and need experimentation tooling fast.'). If evidence_list is empty, frame as 'category hypothesis (no specific signals)'.",
  "should_email": "yes | maybe | no",
  "should_email_reason": "1 short sentence — why",
  "confidence_level": "high | medium | low",
  "top_pain": "1-2 lines — the most likely pain point THEY are feeling right now, specific to their situation, anchored to evidence when present",
  "value_angle": "1-2 lines — how the seller's product solves their top_pain, naming the most relevant capability",
  "social_proof_match": ["Brand1","Brand2","Brand3"],
  "subject_topic": "3-5 word title-case topic for the cold email subject line, specific to their pain (e.g., 'Improving D2C Mobile Conversion', 'Reducing KYC Drop-Off')",
  "observation_angle": "1 short sentence — soft observation about their site/product that anchors body 1, MUST reference specific evidence from evidence_list when one exists (≤180 chars)",
  "secondary_observation": "1 short sentence — alternate angle for body 2 (different page/step/signal than primary, ≤140 chars)",
  "signal_for_body_3": "1 short sentence — challenge they will face if they don't act soon (≤140 chars, may be empty)"
}`;

async function researchOneLead(
  row: { account: ScoredAccount; stakeholder: Stakeholder },
  useTavily: boolean,
  proofPool: string[],
  brief: ClientBrief | undefined,
  sellerName: string,
  strategy: InsightStrategy | undefined,
  signal?: AbortSignal,
): Promise<{ research: LeadResearch; tokensIn: number; tokensOut: number; tavilyUsed: boolean; coreSignalUsed: boolean; apifyUsed: boolean; tavilyError?: string; coreSignalError?: string; apifyError?: string }> {
  let businessNotes = "";
  let growthNotes = "";
  let coreSignalNotes = "";
  let tavilyUsed = false;
  let coreSignalUsed = false;
  let apifyUsed = false;
  let tavilyError: string | undefined;
  let coreSignalError: string | undefined;
  let apifyError: string | undefined;
  let plannerTokensIn = 0;
  let plannerTokensOut = 0;

  const coreSignalLive = isCoreSignalLive();
  const apifyLive = isApifyLive();

  // ---- Stage 1: Claude as the brain — decide what to fetch ----
  const plannerInput = {
    seller: {
      name: sellerName || "VWO",
      product: brief?.sellerProduct || "",
      one_line_value: brief?.sellerOneLineValue || "",
      capabilities: brief?.sellerCapabilities || [],
      common_pains: brief?.commonPainsSolved || [],
      target_segments: brief?.targetSegments || [],
      target_personas: brief?.targetPersonas || [],
    },
    prospect: {
      name: row.account.name,
      domain: row.account.domain,
      industry: row.account.industry,
      country: row.account.country,
      employees: row.account.estimatedNumEmployees,
      short_description: row.account.shortDescription,
      keywords: row.account.keywords.slice(0, 8),
      score: row.account.score,
      segment: row.account.segment,
    },
    stakeholder: {
      title: row.stakeholder.title,
      full_name: row.stakeholder.fullName,
      seniority: row.stakeholder.seniority,
      linkedin_url: row.stakeholder.linkedinUrl,
    },
    insight_strategy: strategy ? {
      champion_titles: strategy.championTitles,
      post_keywords: strategy.postKeywords,
      intent_signals: strategy.intentSignalsToPrioritize,
      hiring_keywords: strategy.jobTitleKeywordsHiring,
    } : null,
  };

  type ResearchPlan = {
    tavily_queries: string[];
    post_keywords_to_filter: string[];
    title_keywords_to_search: string[];
    observation_surface_priorities: string[];
    prospect_specific_anchor_hint: string;
    rationale: string;
  };
  const defaultPlan: ResearchPlan = {
    tavily_queries: [
      `${row.account.name} ${row.account.domain} customers products business model india`,
      `${row.account.name} growth funding hiring expansion conversion india`,
    ],
    post_keywords_to_filter: strategy?.postKeywords?.slice(0, 8) || [],
    title_keywords_to_search: strategy?.championTitles?.slice(0, 6) || [],
    observation_surface_priorities: ["homepage hero", "demo form", "pricing page", "category density"],
    prospect_specific_anchor_hint: "",
    rationale: "default plan — planner unavailable",
  };
  let plan = defaultPlan;
  if (useTavily) {
    const planResult = await llm({
      system: RESEARCH_PLANNER_SYSTEM,
      user: `Plan the per-account research for this prospect.\n\n\`\`\`json\n${JSON.stringify(plannerInput, null, 2)}\n\`\`\``,
      model: "haiku",
      maxTokens: 700,
      cacheSystem: true,
      jsonOnly: true,
      mockOutput: JSON.stringify(defaultPlan),
    });
    plannerTokensIn = planResult.inputTokens;
    plannerTokensOut = planResult.outputTokens;
    plan = extractJson<ResearchPlan>(planResult.text, defaultPlan);
    if (!Array.isArray(plan.tavily_queries) || plan.tavily_queries.length < 2) plan.tavily_queries = defaultPlan.tavily_queries;
  }

  // ---- Stage 2: fire tools using Claude's plan ----
  const tavilyAndExternals = await Promise.allSettled([
    useTavily
      ? tavilySearch(plan.tavily_queries[0] || defaultPlan.tavily_queries[0], { searchDepth: "advanced", maxResults: 4, signal })
      : Promise.reject(new Error("tavily disabled")),
    useTavily
      ? tavilySearch(plan.tavily_queries[1] || defaultPlan.tavily_queries[1], { searchDepth: "advanced", maxResults: 4, signal })
      : Promise.reject(new Error("tavily disabled")),
    coreSignalLive
      ? coreSignalSnapshot(row.account.domain, signal, {
          championTitles: plan.title_keywords_to_search.length > 0 ? plan.title_keywords_to_search : (strategy?.championTitles || []),
          postKeywords: plan.post_keywords_to_filter.length > 0 ? plan.post_keywords_to_filter : (strategy?.postKeywords || []),
        })
      : Promise.reject(new Error("coresignal disabled")),
    apifyLive
      ? apifySnapshot(row.account.domain, {
          championTitles: plan.title_keywords_to_search.length > 0 ? plan.title_keywords_to_search : (strategy?.championTitles || []),
          postKeywords: plan.post_keywords_to_filter.length > 0 ? plan.post_keywords_to_filter : (strategy?.postKeywords || []),
          jobsLimit: 10,
          stakeholderLinkedinUrl: row.stakeholder?.linkedinUrl || "",
          includeMembers: !!(row.stakeholder?.linkedinUrl),
          signal,
        })
      : Promise.reject(new Error("apify disabled")),
  ]);

  const [biz, growth, csnap, asnap] = tavilyAndExternals;
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
  let structuredSignals: StructuredSignals | null = null;
  let signalSummary = "";

  let csValue = csnap.status === "fulfilled" ? csnap.value : null;
  if (csnap.status === "rejected" && coreSignalLive) {
    coreSignalError = csnap.reason instanceof Error ? csnap.reason.message : "unknown";
  }
  if (csValue) {
    coreSignalUsed = csValue.company !== null || csValue.recentJobs.length > 0 || (csValue.members || []).length > 0;
    if (!coreSignalUsed && csValue.errors.length > 0) coreSignalError = csValue.errors[0];
  }

  let apValue: ApifySnapshotResult | null = asnap.status === "fulfilled" ? asnap.value : null;
  if (asnap.status === "rejected" && apifyLive) {
    apifyError = asnap.reason instanceof Error ? asnap.reason.message : "unknown";
  }
  if (apValue) {
    apifyUsed = apValue.company !== null || apValue.jobs.length > 0 || apValue.members.length > 0;
    if (!apifyUsed && apValue.errors.length > 0) apifyError = apValue.errors[0];
  }

  let mergedSnapshot = csValue;
  if (apValue && (!csValue || !coreSignalUsed)) {
    mergedSnapshot = csValue
      ? mergeApifyIntoCoreSignal(csValue, apValue)
      : mergeApifyIntoCoreSignal({ domain: row.account.domain, company: null, recentJobs: [], members: [], fetchedAt: new Date().toISOString(), errors: [] }, apValue);
  } else if (csValue && apValue) {
    mergedSnapshot = mergeApifyIntoCoreSignal(csValue, apValue);
  }

  if (mergedSnapshot) {
    coreSignalNotes = summarizeCoreSignal(mergedSnapshot);
    structuredSignals = classifySignals({
      account: row.account,
      snapshot: mergedSnapshot,
      hiringKeywords: strategy?.jobTitleKeywordsHiring || [],
      competitorsToWatch: strategy?.techStackToWatch || [],
      complementsToWatch: [],
    });
    signalSummary = summarizeSignalsForLLM(structuredSignals);
  }

  const fallback = fallbackResearch(row.account.domain, row.account.industry);

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
    structured_signals: signalSummary || "(no structured signals — fall back to web/category)",
    buyer_signal_score: structuredSignals?.buyerSignalScore ?? null,
    evidence_list: structuredSignals?.evidence ?? [],
    fallback_observation: {
      primary: fallback.observationAngle,
      secondary: fallback.secondaryObservation,
      b3: fallback.signalForBody3,
      note: "Deterministic per-domain starting point. Other accounts in same industry will get DIFFERENT fallback strings via domain-hash, but multiple variants per industry exist. Use as inspiration only — your output must vary further by re-wording, sharpening with prospect-specific elements, or pivoting to a different observable surface.",
    },
    claude_research_plan: {
      tavily_queries_used: plan.tavily_queries,
      observation_surface_priorities: plan.observation_surface_priorities,
      prospect_specific_anchor_hint: plan.prospect_specific_anchor_hint,
      rationale: plan.rationale,
    },
    insight_strategy: strategy ? {
      champion_titles: strategy.championTitles,
      buyer_journey_titles: strategy.buyerJourneyTitles,
      post_keywords_to_weight: strategy.postKeywords,
      intent_signals_to_prioritize: strategy.intentSignalsToPrioritize,
      hiring_keywords_signaling_pain: strategy.jobTitleKeywordsHiring,
      tech_stack_to_watch: strategy.techStackToWatch,
      rationale: strategy.rationale,
    } : null,
  };

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
    buying_hypothesis?: string;
    should_email?: string;
    should_email_reason?: string;
    confidence_level?: string;
  };
  const parsed = extractJson<Parsed>(result.text, JSON.parse(fallbackJson) as Parsed);
  const validatedProof = (parsed.social_proof_match || []).filter((b) => proofPool.includes(b)).slice(0, 3);
  const normShouldEmail = (() => {
    const v = (parsed.should_email || "").toLowerCase().trim();
    if (v === "yes" || v === "maybe" || v === "no") return v as "yes" | "maybe" | "no";
    return "" as const;
  })();
  const normConfidence = (() => {
    const v = (parsed.confidence_level || "").toLowerCase().trim();
    if (v === "high" || v === "medium" || v === "low") return v as "high" | "medium" | "low";
    return "" as const;
  })();
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
    buyingHypothesis: (parsed.buying_hypothesis || "").trim(),
    shouldEmail: normShouldEmail,
    shouldEmailReason: (parsed.should_email_reason || "").trim(),
    confidenceLevel: normConfidence,
    buyerSignalScore: structuredSignals?.buyerSignalScore ?? 0,
    evidenceList: structuredSignals?.evidence ?? [],
  };

  return {
    research,
    tokensIn: result.inputTokens + plannerTokensIn,
    tokensOut: result.outputTokens + plannerTokensOut,
    tavilyUsed,
    coreSignalUsed,
    apifyUsed,
    tavilyError,
    coreSignalError,
    apifyError,
  };
}

export async function researchAgent(input: ResearchInput): Promise<{ output: ResearchOutput; state: Pick<PhaseState, "log" | "metrics" | "inputCount" | "outputCount" | "llmTokensIn" | "llmTokensOut"> }> {
  const log: string[] = [];
  const notes: { domain: string; research: LeadResearch }[] = [];
  const useAi = input.useAi === true;
  const tavilyAvailable = useAi && isTavilyLive();
  const coreSignalAvailable = useAi && isCoreSignalLive();
  const apifyAvailable = useAi && isApifyLive();
  const tavilyBudget = input.tavilyMaxLeads ?? 30;
  const cache = input.existingNotes || new Map<string, LeadResearch>();

  if (!useAi) {
    log.push("Deterministic mode: zero LLM/Tavily/CoreSignal cost. Per-industry observation table only.");
  } else {
    log.push(tavilyAvailable ? `Tavily live. Budget: up to ${tavilyBudget} per-lead searches (Tier A+B).` : "Tavily mock: TAVILY_API_KEY not set, using category-level fallbacks.");
    log.push(coreSignalAvailable ? `CoreSignal live: structured signals (jobs, headcount, funding, tech) + LinkedIn member intelligence on top of Tavily.` : "CoreSignal off: CORESIGNAL_API_KEY not set.");
    log.push(apifyAvailable ? `Apify live: LinkedIn company + jobs scrapers as primary intelligence (auto-merged with CoreSignal output when both run).` : "Apify off: APIFY_API_KEY not set.");
    log.push(`Claude orchestrator: planning Tavily queries + Apify configs per account via Haiku before tools fire (the brain). Then Sonnet synthesis on the fetched data.`);
    if (input.insightStrategy && input.insightStrategy.championTitles.length > 0) {
      const s = input.insightStrategy;
      log.push(`Insight strategy active: ${s.championTitles.length} champion titles, ${s.postKeywords.length} post keywords, ${s.intentSignalsToPrioritize.length} prioritized intent signals.`);
    } else {
      log.push("Insight strategy: not generated yet — using generic CoreSignal queries. Generate one for sharper LinkedIn member targeting.");
    }
  }

  let tokensIn = 0, tokensOut = 0, tavilyCalls = 0, cacheHits = 0, tavilyErrors = 0;
  let coreSignalCalls = 0, coreSignalErrors = 0;
  let apifyCalls = 0, apifyErrors = 0;

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
    const proofPool = resolveProofPool(
      {
        industry: row.account.industry,
        secondaryIndustries: row.account.secondaryIndustries,
        keywords: row.account.keywords,
        domain: row.account.domain,
        shortDescription: row.account.shortDescription,
      },
      input.socialProofLibrary,
      input.clientBrief?.caseStudyWins,
    );
    const r = await researchOneLead(row, useTavily, proofPool, input.clientBrief, input.sellerName || "VWO", input.insightStrategy, input.signal);
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
    if (r.apifyUsed) apifyCalls++;
    if (r.apifyError) {
      apifyErrors++;
      if (apifyErrors <= 3) log.push(`Apify failed for ${domain}: ${r.apifyError}`);
    }

    const note = { domain, research: r.research };
    notes.push(note);
    if (input.onLead) {
      try { await input.onLead(note); } catch (err) {
        log.push(`Persist callback failed for ${domain}: ${err instanceof Error ? err.message : "unknown"}`);
      }
    }
  }

  log.push(`Generated ${notes.length} observation sets. Cache hits: ${cacheHits}. Tavily calls: ${tavilyCalls}${tavilyErrors > 0 ? ` (${tavilyErrors} errors)` : ""}. CoreSignal hits: ${coreSignalCalls}${coreSignalErrors > 0 ? ` (${coreSignalErrors} errors)` : ""}. Apify hits: ${apifyCalls}${apifyErrors > 0 ? ` (${apifyErrors} errors)` : ""}. LLM tokens in/out: ${tokensIn}/${tokensOut}.`);

  return {
    output: { notes, llmTokensIn: tokensIn, llmTokensOut: tokensOut, tavilyCalls, cacheHits },
    state: {
      log,
      metrics: { observations: notes.length, tokensIn, tokensOut, tavilyCalls, tavilyErrors, coreSignalCalls, coreSignalErrors, apifyCalls, apifyErrors, cacheHits, tavilyAvailable: tavilyAvailable ? 1 : 0, coreSignalAvailable: coreSignalAvailable ? 1 : 0, apifyAvailable: apifyAvailable ? 1 : 0 },
      inputCount: input.rows.length,
      outputCount: notes.length,
      llmTokensIn: tokensIn,
      llmTokensOut: tokensOut,
    },
  };
}
