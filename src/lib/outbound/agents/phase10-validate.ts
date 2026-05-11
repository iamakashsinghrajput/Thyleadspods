import type { PhaseState } from "../types";

export interface ValidateInput {
  prompts: { domain: string; personKey: string; fullName: string; prompt: string; hasEmail: boolean; subject1?: string; body1?: string; body2?: string; body3?: string; companyName?: string }[];
  sellerName?: string;
  // Final-filter lists used as a safety net at the end of the pipeline. Any lead whose
  // accountDomain matches DNC, an active customer, a seller domain, or a sister-brand
  // group is hard-rejected here even if it slipped past Phase 2 (e.g. operator added
  // to DNC mid-run, or override domain bypassed earlier filters).
  dncDomains?: string[];
  activeCustomerDomains?: string[];
  sellerDomains?: string[];
  pastMeetingTokens?: string[];
}

function normaliseDomainRoot(s: string): string {
  return (s || "")
    .toLowerCase()
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "")
    .replace(/\?.*$/, "")
    .trim();
}

function nameToToken(s: string): string {
  return (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

// V-VWO-3 cross-pollination guard. Domain or company name MUST NOT match any brand
// in the active VWO customer / case study list (the social proof library).
// Tokens here are the slugified roots that show up in domains for those brands.
const VWO_SOCIAL_PROOF_TOKENS = [
  "andaaz", "andaazfashion", "attrangi", "utsavfashion", "utsav",
  "amway",
  "ebay", "bigbasket", "yuppiechef",
  "hdfc", "hdfcbank", "hdfcergo", "hdfclife", "hdfcsec", "hdfcamc",
  "icici", "icicibank", "icicilombard", "iciciprulife", "icicidirect", "icicisecurities",
  "payu", "paypal",
  "onlinemanipal", "manipalonline", "unext", "byjus",
  "posist", "restroworks", "payscale", "chargebee",
  "virginholidays", "virgin",
  "billundairport", "billund",
];

function checkCrossPollination(domain: string, companyName: string): string[] {
  const dom = (domain || "").toLowerCase();
  const name = (companyName || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const issues: string[] = [];
  for (const token of VWO_SOCIAL_PROOF_TOKENS) {
    if (dom.includes(token) || (name && name.includes(token))) {
      issues.push(`vwo_cross_pollination_match:${token}`);
      break;
    }
  }
  return issues;
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
  dncBlockedCount: number;
  activeCustomerBlockedCount: number;
  sellerSelfBlockedCount: number;
}

const MIN_PROMPT_CHARS = 600;

// VWO-specific banned vocab in subject lines (V-VWO-5)
const VWO_BANNED_SUBJECT_TERMS = [
  /\bvwo\b/i,
  /\bwingify\b/i,
  /\bexperimentation\b/i,
  /\bA[\/\-]?B test\b/i,
  /\bcro\b/i,
  /\bconversion\b/i,
  /\boptimi[sz]ation\b/i,
];

// V-VWO-2 — only these metrics may appear; any other %-pattern in body 1/2 is suspicious
const VWO_VERIFIED_METRIC_PATTERNS = [
  /125\s*%/, /50\s*%/, /47\s*%/, /44\s*%/, /100\s*%/, /52\s*%/, /49\.85\s*%/, /49\s*%/,
];

const REASSURANCE_LINE = "Often, these don't require a full redesign. Even small, validated changes can create measurable improvements.";
const EASE_CODA = "without heavy dev effort";

function isVwoSeller(seller: string): boolean {
  const lc = (seller || "").toLowerCase();
  return lc.includes("vwo") || lc.includes("wingify");
}

function checkVwoBodyRules(body1: string, subject1: string): string[] {
  const issues: string[] = [];

  // V-VWO-5 subject vocabulary
  if (subject1) {
    for (const re of VWO_BANNED_SUBJECT_TERMS) {
      if (re.test(subject1)) {
        issues.push(`vwo_banned_subject_term:${re.source}`);
        break;
      }
    }
  }

  // V-VWO-6 reassurance line + ease coda verbatim in body 1
  if (body1) {
    if (!body1.includes(REASSURANCE_LINE)) issues.push("vwo_missing_reassurance_line");
    if (!body1.toLowerCase().includes(EASE_CODA.toLowerCase())) issues.push("vwo_missing_ease_coda");

    // V-VWO-2 — flag any %-number in body 1 NOT in the verified set
    const allPercents = body1.match(/\b\d{1,3}(?:\.\d+)?\s*%/g) || [];
    for (const pct of allPercents) {
      const matchesVerified = VWO_VERIFIED_METRIC_PATTERNS.some((re) => re.test(pct));
      if (!matchesVerified) {
        issues.push(`vwo_unverified_metric:${pct.replace(/\s+/g, "")}`);
        break;
      }
    }
  }

  return issues;
}

export function validateAgent(input: ValidateInput): { output: ValidateOutput; state: Pick<PhaseState, "log" | "metrics" | "inputCount" | "outputCount"> } {
  const reports: ValidationReport[] = [];
  let shippableCount = 0;
  let noEmailCount = 0;
  let shortPromptCount = 0;
  let vwoIssueCount = 0;
  let dncBlockedCount = 0;
  let activeCustomerBlockedCount = 0;
  let sellerSelfBlockedCount = 0;
  const vwoMode = isVwoSeller(input.sellerName || "");

  // Pre-compute the final-filter sets — normalise domains so "www.acme.com" and "acme.com"
  // collapse to the same key. Group-tokens: the bare brand root (e.g. "hdfc") so any
  // hdfc*.com sub-brand collapses to a known DNC parent.
  const dncSet = new Set((input.dncDomains || []).map(normaliseDomainRoot).filter(Boolean));
  const activeSet = new Set((input.activeCustomerDomains || []).map(normaliseDomainRoot).filter(Boolean));
  const sellerSet = new Set((input.sellerDomains || []).map(normaliseDomainRoot).filter(Boolean));
  const pastMeetingSet = new Set((input.pastMeetingTokens || []).map(nameToToken).filter(Boolean));

  for (const p of input.prompts) {
    const reasons: string[] = [];
    const domRoot = normaliseDomainRoot(p.domain);
    const rootToken = nameToToken(domRoot.split(".")[0] || "");

    // Final-filter sweep — these block shipping regardless of email/prompt status.
    if (sellerSet.has(domRoot)) { reasons.push("final_filter:seller_self_domain"); sellerSelfBlockedCount++; }
    if (dncSet.has(domRoot)) { reasons.push("final_filter:dnc_domain"); dncBlockedCount++; }
    if (activeSet.has(domRoot)) { reasons.push("final_filter:active_customer"); activeCustomerBlockedCount++; }
    if (rootToken && pastMeetingSet.has(rootToken)) { reasons.push("final_filter:past_meeting"); }

    if (!p.hasEmail) { reasons.push("no_verified_email"); noEmailCount++; }
    if ((p.prompt || "").length < MIN_PROMPT_CHARS) { reasons.push("prompt_too_short"); shortPromptCount++; }
    if (vwoMode && (p.body1 || p.subject1)) {
      const vwoIssues = checkVwoBodyRules(p.body1 || "", p.subject1 || "");
      if (vwoIssues.length > 0) {
        reasons.push(...vwoIssues);
        vwoIssueCount++;
      }
    }
    if (vwoMode) {
      const crossPollutionIssues = checkCrossPollination(p.domain, p.companyName || "");
      if (crossPollutionIssues.length > 0) {
        reasons.push(...crossPollutionIssues);
        vwoIssueCount++;
      }
    }
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

  const finalFilterTotal = dncBlockedCount + activeCustomerBlockedCount + sellerSelfBlockedCount;

  return {
    output: { reports, shippableCount, noEmailCount, shortPromptCount, dncBlockedCount, activeCustomerBlockedCount, sellerSelfBlockedCount },
    state: {
      log: [
        `${input.prompts.length} leads checked. ${shippableCount} ready to paste, ${noEmailCount} missing email, ${shortPromptCount} prompt too short${vwoMode ? `, ${vwoIssueCount} VWO rule violations (V-VWO-2/5/6)` : ""}.`,
        `Final-filter sweep: ${finalFilterTotal} hard-blocked (${dncBlockedCount} DNC, ${activeCustomerBlockedCount} active customer, ${sellerSelfBlockedCount} seller-self).`,
      ],
      metrics: { shippable: shippableCount, noEmail: noEmailCount, shortPrompt: shortPromptCount, total: input.prompts.length, vwoIssues: vwoIssueCount, dncBlocked: dncBlockedCount, activeCustomerBlocked: activeCustomerBlockedCount, sellerSelfBlocked: sellerSelfBlockedCount },
      inputCount: input.prompts.length,
      outputCount: shippableCount,
    },
  };
}
