import type { ScoredAccount, Stakeholder, PhaseState, LeadResearch } from "../types";
import type { ClientBrief } from "./phase8-research";
import { apifyScrapeProfile, isApifyLive, type ApifyMemberData } from "../apify";
import { llm } from "@/lib/onboarding/llm";

export interface PerLeadResearch {
  observationAngle: string;
  topPain: string;
  valueAngle: string;
  socialAngle: string;
  evidenceList: string[];
  personEvidence: string[];
  icpRole: string;
}

export interface PersonalizeInput {
  rows: { account: ScoredAccount; stakeholder: Stakeholder }[];
  accountNotes: Map<string, LeadResearch>;
  clientBrief?: ClientBrief;
  sellerName?: string;
  concurrency?: number;
  signal?: AbortSignal;
  shouldCancel?: () => Promise<boolean>;
  onLead?: (write: { domain: string; personKey: string; perLead: PerLeadResearch }) => Promise<void>;
}

export interface PersonalizeOutput {
  writes: { domain: string; personKey: string; perLead: PerLeadResearch }[];
  apifyProfileHits: number;
  apifyProfileMisses: number;
  llmCalls: number;
  llmTokensIn: number;
  llmTokensOut: number;
}

const SYSTEM = `You are a B2B research analyst building HIGHLY PERSONALIZED openers for cold outbound to Indian buyers.

You are given:
1. Account-level research (one observable thing about the company)
2. A specific person on that account, with their LinkedIn role and recent posts
3. The seller's brief (capabilities, USPs, target personas, case studies)

Your job: produce a personalization bundle TAILORED to this person's role + recent activity.

Rules:
- The "observation_angle" must reference a specific page/funnel/UX pattern on the prospect's product. ≤140 chars. ICP-shaded — frame the same observation differently for a Founder vs a Head of Growth vs a CTO.
- "top_pain" must be the pain THIS persona feels (CFOs care about CAC, Founders about velocity, VP Marketing about CR, CTOs about platform scale). ≤120 chars.
- "value_angle" is the seller's wedge translated into THIS persona's language (e.g. "lift CR 8-12% in 6 weeks" for VP Marketing, "lock in CR uplift before next funding round" for Founder). ≤140 chars.
- "social_angle" is a SPECIFIC, citable thread to this person's LinkedIn — referencing their post, their tenure ("3 months in role"), or a past employer match. ≤140 chars. NEVER generic ("Saw your profile"). If no LinkedIn data is available, leave empty string.
- "evidence_list" is 2-4 short bullet points of WHY this person is buyable now. Mix account-level + person-level signals.
- "person_evidence" is 1-3 LinkedIn-specific signals (post topics, headline keywords, tenure). Empty array if no LinkedIn data.
- "icp_role" is a clean role label: "Founder/CEO" | "VP Marketing" | "Head of Growth" | "CTO/VP Eng" | "Head of Product" | "VP Sales" | "CFO" | "Other". Pick the closest fit.

NEVER lead with funding/news. NEVER use "Saw your Series C" / "Congrats on the raise" / "Read about your acquisition".

Output ONLY valid JSON of shape:
{ "observation_angle": "...", "top_pain": "...", "value_angle": "...", "social_angle": "...", "evidence_list": ["..."], "person_evidence": ["..."], "icp_role": "..." }`;

function truncate(s: string, n: number): string {
  if (!s) return "";
  return s.length <= n ? s : s.slice(0, n - 1) + "…";
}

function buildUserPayload(args: {
  account: ScoredAccount;
  stakeholder: Stakeholder;
  accountResearch: LeadResearch | null;
  profile: ApifyMemberData | null;
  brief?: ClientBrief;
  sellerName: string;
}): string {
  const { account, stakeholder, accountResearch, profile, brief, sellerName } = args;
  const recentPosts = profile?.recentPosts && profile.recentPosts.length > 0
    ? profile.recentPosts.slice(0, 3).map((p, i) => `[${i + 1}] ${truncate(p.text || "", 240)}`).join("\n")
    : "(no recent posts found)";
  const lines = [
    `SELLER: ${sellerName}`,
    brief ? `SELLER PRODUCT: ${brief.sellerProduct || ""}` : "",
    brief ? `SELLER ONE-LINER: ${brief.sellerOneLineValue || ""}` : "",
    brief && brief.sellerCapabilities && brief.sellerCapabilities.length > 0 ? `SELLER CAPABILITIES: ${brief.sellerCapabilities.slice(0, 6).join(" | ")}` : "",
    brief && brief.commonPainsSolved && brief.commonPainsSolved.length > 0 ? `COMMON PAINS SOLVED: ${brief.commonPainsSolved.slice(0, 6).join(" | ")}` : "",
    brief && brief.targetPersonas && brief.targetPersonas.length > 0 ? `TARGET PERSONAS: ${brief.targetPersonas.slice(0, 6).join(" | ")}` : "",
    brief && brief.caseStudyWins && brief.caseStudyWins.length > 0 ? `CASE STUDY WINS: ${brief.caseStudyWins.slice(0, 4).join(" | ")}` : "",
    "",
    `ACCOUNT: ${account.name} (${account.domain}) · ${account.industry || "unknown industry"} · ~${account.estimatedNumEmployees || "?"} employees · ${account.country || "?"}`,
    `ACCOUNT OBSERVATION (research): ${accountResearch?.observationAngle || "(none yet — synthesize from category patterns)"}`,
    accountResearch?.secondaryObservation ? `SECONDARY OBSERVATION: ${accountResearch.secondaryObservation}` : "",
    accountResearch?.theirStage ? `STAGE: ${accountResearch.theirStage}` : "",
    accountResearch?.whatTheySell ? `WHAT THEY SELL: ${accountResearch.whatTheySell}` : "",
    "",
    `PERSON: ${stakeholder.fullName} — ${stakeholder.title} (seniority: ${stakeholder.seniority || "unknown"})`,
    `LINKEDIN: ${stakeholder.linkedinUrl || "(no URL)"}`,
    profile ? `LINKEDIN HEADLINE: ${profile.headline || profile.title || ""}` : "",
    profile?.location ? `LOCATION: ${profile.location}` : "",
    profile?.monthsInCurrentRole ? `MONTHS IN CURRENT ROLE: ${profile.monthsInCurrentRole}` : "",
    `RECENT LINKEDIN POSTS:\n${recentPosts}`,
  ].filter(Boolean);
  return lines.join("\n");
}

function safeStr(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function safeStrArr(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string" && x.trim().length > 0).slice(0, 6);
}

function fallbackPerLead(account: ScoredAccount, stakeholder: Stakeholder, accountResearch: LeadResearch | null): PerLeadResearch {
  const t = (stakeholder.title || "").toLowerCase();
  let icpRole: string;
  if (/founder|cofounder|co-founder|ceo|chief executive|owner|managing director|md\b|president/.test(t)) icpRole = "Founder/CEO";
  else if (/cmo|chief marketing|vp marketing|head of marketing|head of digital marketing/.test(t)) icpRole = "VP Marketing";
  else if (/cgo|chief growth|head of growth|vp growth/.test(t)) icpRole = "Head of Growth";
  else if (/cto|chief technology|vp engineering|head of engineering/.test(t)) icpRole = "CTO/VP Eng";
  else if (/cpo|chief product|head of product|vp product/.test(t)) icpRole = "Head of Product";
  else if (/cfo|chief financial/.test(t)) icpRole = "CFO";
  else if (/vp sales|head of sales/.test(t)) icpRole = "VP Sales";
  else icpRole = "Other";

  return {
    observationAngle: accountResearch?.observationAngle || "",
    topPain: accountResearch?.topPain || "",
    valueAngle: accountResearch?.valueAngle || "",
    socialAngle: "",
    evidenceList: accountResearch?.socialProofMatch || [],
    personEvidence: [],
    icpRole,
  };
}

async function personalizeOne(args: {
  account: ScoredAccount;
  stakeholder: Stakeholder;
  accountResearch: LeadResearch | null;
  brief?: ClientBrief;
  sellerName: string;
  signal?: AbortSignal;
}): Promise<{ perLead: PerLeadResearch; tokensIn: number; tokensOut: number; profileHit: boolean; profileMiss: boolean; llmCalled: boolean }> {
  const { account, stakeholder, accountResearch, brief, sellerName, signal } = args;

  let profile: ApifyMemberData | null = null;
  let profileHit = false;
  let profileMiss = false;
  if (stakeholder.linkedinUrl && isApifyLive()) {
    try {
      profile = await apifyScrapeProfile(stakeholder.linkedinUrl, signal);
      if (profile) profileHit = true; else profileMiss = true;
    } catch {
      profileMiss = true;
    }
  } else {
    profileMiss = true;
  }

  const userPayload = buildUserPayload({ account, stakeholder, accountResearch, profile, brief, sellerName });
  const fb = fallbackPerLead(account, stakeholder, accountResearch);
  const mockOutput = JSON.stringify({
    observation_angle: fb.observationAngle,
    top_pain: fb.topPain,
    value_angle: fb.valueAngle,
    social_angle: fb.socialAngle,
    evidence_list: fb.evidenceList,
    person_evidence: fb.personEvidence,
    icp_role: fb.icpRole,
  });

  const result = await llm({
    system: SYSTEM,
    user: userPayload,
    maxTokens: 800,
    jsonOnly: true,
    cacheSystem: true,
    model: "haiku",
    mockOutput,
  });

  let parsed: Record<string, unknown> = {};
  try { parsed = JSON.parse(result.text); } catch {
    return {
      perLead: fb,
      tokensIn: result.inputTokens || 0,
      tokensOut: result.outputTokens || 0,
      profileHit, profileMiss, llmCalled: result.isLive,
    };
  }

  const perLead: PerLeadResearch = {
    observationAngle: truncate(safeStr(parsed.observation_angle), 200) || fb.observationAngle,
    topPain: truncate(safeStr(parsed.top_pain), 160) || fb.topPain,
    valueAngle: truncate(safeStr(parsed.value_angle), 200) || fb.valueAngle,
    socialAngle: truncate(safeStr(parsed.social_angle), 200),
    evidenceList: safeStrArr(parsed.evidence_list).length > 0 ? safeStrArr(parsed.evidence_list) : fb.evidenceList,
    personEvidence: safeStrArr(parsed.person_evidence),
    icpRole: safeStr(parsed.icp_role) || fb.icpRole,
  };

  return {
    perLead,
    tokensIn: result.inputTokens || 0,
    tokensOut: result.outputTokens || 0,
    profileHit, profileMiss, llmCalled: result.isLive,
  };
}

export async function personalizeLeadsAgent(input: PersonalizeInput): Promise<{ output: PersonalizeOutput; state: Pick<PhaseState, "log" | "metrics" | "inputCount" | "outputCount" | "llmTokensIn" | "llmTokensOut"> }> {
  const log: string[] = [];
  const writes: { domain: string; personKey: string; perLead: PerLeadResearch }[] = [];
  let apifyProfileHits = 0, apifyProfileMisses = 0;
  let llmCalls = 0, tokensIn = 0, tokensOut = 0;

  const concurrency = Math.max(1, Math.min(8, input.concurrency || 5));
  log.push(`Per-lead personalize: ${input.rows.length} leads · concurrency ${concurrency} · Apify ${isApifyLive() ? "live" : "off"} · Haiku synthesis.`);

  let cancelled = false;
  let cursor = 0;
  const startedAt = Date.now();

  async function worker() {
    while (true) {
      if (cancelled) return;
      if (input.signal?.aborted) { cancelled = true; return; }
      if (input.shouldCancel && await input.shouldCancel()) { cancelled = true; return; }
      const idx = cursor++;
      if (idx >= input.rows.length) return;

      const row = input.rows[idx];
      const dom = (row.account.domain || "").toLowerCase();
      const accountResearch = input.accountNotes.get(dom) || null;

      try {
        const r = await personalizeOne({
          account: row.account,
          stakeholder: row.stakeholder,
          accountResearch,
          brief: input.clientBrief,
          sellerName: input.sellerName || "VWO",
          signal: input.signal,
        });
        if (r.profileHit) apifyProfileHits++;
        if (r.profileMiss) apifyProfileMisses++;
        if (r.llmCalled) llmCalls++;
        tokensIn += r.tokensIn;
        tokensOut += r.tokensOut;
        const personKey = row.stakeholder.personKey || "";
        if (!personKey) {
          log.push(`Skip persist (no personKey): ${dom} / ${row.stakeholder.fullName}`);
          continue;
        }
        writes.push({ domain: dom, personKey, perLead: r.perLead });
        if (input.onLead) {
          try { await input.onLead({ domain: dom, personKey, perLead: r.perLead }); } catch (err) {
            log.push(`Persist callback failed for ${dom}/${personKey}: ${err instanceof Error ? err.message : "unknown"}`);
          }
        }
      } catch (err) {
        log.push(`Personalize failed for ${dom}/${row.stakeholder.fullName}: ${err instanceof Error ? err.message : "unknown"}`);
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));

  const elapsed = Math.round((Date.now() - startedAt) / 1000);
  log.push(`Done: ${writes.length}/${input.rows.length} leads personalized in ${elapsed}s. Apify: ${apifyProfileHits} hits / ${apifyProfileMisses} misses. LLM calls: ${llmCalls}.`);

  return {
    output: { writes, apifyProfileHits, apifyProfileMisses, llmCalls, llmTokensIn: tokensIn, llmTokensOut: tokensOut },
    state: {
      log,
      metrics: { leads: input.rows.length, written: writes.length, apifyProfileHits, apifyProfileMisses, llmCalls, elapsedSec: elapsed },
      inputCount: input.rows.length,
      outputCount: writes.length,
      llmTokensIn: tokensIn,
      llmTokensOut: tokensOut,
    },
  };
}
