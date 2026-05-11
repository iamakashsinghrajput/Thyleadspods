import type { ScoredAccount, Stakeholder, PhaseState, LeadResearch } from "../types";
import type { ClientBrief } from "./phase8-research";
import { apifyScrapeProfile, isApifyLive, type ApifyMemberData } from "../apify";
import { coreSignalSnapshot, isCoreSignalLive, fetchMemberForLead, type CoreSignalSnapshot, type MemberHit } from "../coresignal";
import { tavilySearch, isTavilyLive } from "../tavily";
import { llm } from "@/lib/onboarding/llm";

// Per-lead PRESS / PODCAST / INTERVIEW signal — the realistic version of "lead-level
// research" that doesn't depend on scraping LinkedIn. Searches public press, podcast,
// and talk venues for THIS specific person × company. When Haiku gets a real interview
// quote or talk topic, that becomes the social_angle.
//
// This is the move away from chasing "what they liked on LinkedIn" (which no platform
// can reliably deliver at scale) toward "what they said in public" (which IS deliverable).
interface PressSignal {
  title: string;
  url: string;
  content: string;
  source: string; // "interview" | "podcast" | "talk" | "article"
  score: number;
}

const INDIA_PRESS_SITES = [
  "yourstory.com",
  "inc42.com",
  "entrackr.com",
  "moneycontrol.com",
  "livemint.com",
  "economictimes.indiatimes.com",
  "etbrandequity.com",
  "etretail.com",
  "etcio.com",
  "business-standard.com",
  "bloombergquint.com",
  "thehindubusinessline.com",
  "afaqs.com",
];
const PODCAST_VENUES = [
  "saasboomi.in",
  "nasscom.in",
  "youtube.com",
  "spotify.com",
  "apple.co",
];

async function lookupLeadPressMentions(stakeholder: Stakeholder, account: ScoredAccount, signal?: AbortSignal): Promise<PressSignal[]> {
  if (!isTavilyLive()) return [];
  const fullName = (stakeholder.fullName || `${stakeholder.firstName || ""} ${stakeholder.lastName || ""}`).trim();
  if (!fullName) return [];
  const company = account.name || (account.domain || "").split(".")[0];

  // Three queries, each targeted at a different signal type. Each Tavily call ~$0.005.
  const queries: Array<{ q: string; source: PressSignal["source"] }> = [
    {
      // Press / interviews / quoted in articles — Indian B2B press
      q: `"${fullName}" "${company}" (interview OR quoted OR says OR opinion) site:${INDIA_PRESS_SITES.slice(0, 8).join(" OR site:")}`,
      source: "interview",
    },
    {
      // Podcasts / talks / keynotes
      q: `"${fullName}" (podcast OR keynote OR speaker OR fireside OR "talks at") site:${PODCAST_VENUES.join(" OR site:")}`,
      source: "podcast",
    },
    {
      // Author of articles / op-eds
      q: `"${fullName}" "${company}" (wrote OR authored OR opinion OR column) site:yourstory.com OR site:inc42.com OR site:livemint.com OR site:economictimes.indiatimes.com`,
      source: "article",
    },
  ];

  const out: PressSignal[] = [];
  const seenUrls = new Set<string>();
  for (const { q, source } of queries) {
    try {
      const r = await tavilySearch(q, { searchDepth: "advanced", maxResults: 3, signal });
      for (const hit of r.results || []) {
        if (!hit.content && !hit.title) continue;
        const url = hit.url || "";
        if (url && seenUrls.has(url)) continue;
        if (url) seenUrls.add(url);
        out.push({
          title: hit.title || "",
          url,
          content: (hit.content || "").slice(0, 600),
          source,
          score: hit.score || 0,
        });
      }
    } catch {
      // best-effort — one query failure shouldn't block the lead
    }
  }
  return out.sort((a, b) => b.score - a.score).slice(0, 5);
}

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
  coreSignalOnly?: boolean;
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
- "social_angle" is a SPECIFIC, citable thread tied to THIS person. PRIMARY SOURCE: their actual RECENT LINKEDIN POSTS / SHARES / ACTIVITY from CoreSignal multi_source — quote or paraphrase a real phrase from the most recent on-topic post. Priority order: (1) phrase from a recent (≤30d) on-topic post, (2) phrase from any recent post regardless of topic, (3) tenure ("3 months in role"), (4) past employer match ("previously led growth at Lenskart"), (5) education ("IIT Delhi alum"), (6) location overlap. ≤140 chars. NEVER generic ("Saw your profile"). NEVER fabricate a post that isn't in the inputs. Only leave empty if NONE of those signals are present.
- "evidence_list" is 2-4 short bullet points of WHY this person is buyable now. Mix account-level + person-level signals.
- "person_evidence" is 1-3 LinkedIn-specific signals (post topics, headline keywords, tenure). Empty array if no LinkedIn data.
- "icp_role" is a clean role label: "Founder/CEO" | "VP Marketing" | "Head of Growth" | "CTO/VP Eng" | "Head of Product" | "VP Sales" | "CFO" | "Other". Pick the closest fit.

NEVER lead with funding/news. NEVER use "Saw your Series C" / "Congrats on the raise" / "Read about your acquisition".

Output ONLY valid JSON of shape:
{ "observation_angle": "...", "top_pain": "...", "value_angle": "...", "social_angle": "...", "evidence_list": ["..."], "person_evidence": ["..."], "icp_role": "..." }`;

const PERSON_ONLY_SYSTEM = `You are a B2B research analyst producing the PERSON-LEVEL personalization for one stakeholder, given pre-computed account-level research.

The observation_angle, top_pain, value_angle, and evidence_list are ALREADY DECIDED for this account (you'll see them in the input). Do NOT regenerate them — they're fixed for everyone on this company. Your only job is the per-person fields.

YOUR ONLY JOB: produce a social_angle that would actually make THIS person want to reply to a cold email. That bar is HIGH:
- It must reference something they SAID, SHIPPED, HIRED, RAISED, or DECIDED in the last ~90 days.
- It must be SPECIFIC enough that they'd recognize "I actually said/did that" — a quote, a number, a stance, a launched product.
- It must be TOPICAL for B2B sales (growth, CR, conversion, product, funnel, hiring, funding, launch, A/B, optimization).

DATA SOURCES (use only what passes the bar above; reject everything else):
1. RECENT LINKEDIN POSTS / SHARES / ACTIVITY — actual post text with dates. The strongest source. Quote a real phrase IF it's recent + topical + specific.
2. PRESS / PODCAST / INTERVIEW MENTIONS — interview quotes, podcast appearances, articles. Strong when the snippet contains a real opinion/claim/number.

WHAT IS **NOT** A SOCIAL ANGLE — return empty rather than using these:
- ❌ Their title or headline (e.g. "Senior VP at BikeWale") — that's an identifier, not a signal
- ❌ Generic tenure ("13 months in role") — meaningless without context
- ❌ Past employer ("ex-CarWale") — career history, not a recent decision
- ❌ Education ("IIT Delhi alum") — biographical, not a recent action
- ❌ Location, skills, summary blurbs — not citable in a sales email
- ❌ Boilerplate sentences from LinkedIn profile pages indexed by Tavily
- ❌ Generic motivational posts ("excited to be here", "honored", "great team") — vanity
- ❌ Reposts without a personal take

CRITICAL: every lead has DIFFERENT public data. Produce a DIFFERENT social_angle for each lead. NEVER reuse phrases across siblings.

OUTPUT FIELDS:

- "social_angle" — a SPECIFIC, citable thread tied to THIS person, meeting the bar above. ≤140 chars. NEVER fabricate — only quote real text from the input sources. **Return empty string "" when nothing meets the bar.** Empty is the correct answer for leads with no public footprint — better to ship without a social angle than ship a fake one.
- "person_evidence" is 1-3 LinkedIn-specific signals you grounded social_angle in (post topics, headline phrases, tenure, recent role change, school/employer name). Empty array only if no LinkedIn data.
- "icp_role" is a clean role label: "Founder/CEO" | "VP Marketing" | "Head of Growth" | "CTO/VP Eng" | "Head of Product" | "VP Sales" | "CFO" | "Other". Pick the closest fit for this person.

Output ONLY valid JSON of shape:
{ "social_angle": "...", "person_evidence": ["..."], "icp_role": "..." }`;

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
  pressSignals?: PressSignal[];
}): string {
  const { account, stakeholder, accountResearch, profile, brief, sellerName, pressSignals } = args;
  const recentPosts = profile?.recentPosts && profile.recentPosts.length > 0
    ? profile.recentPosts.slice(0, 5).map((p, i) => `[${i + 1}]${p.postedAt ? ` (${p.postedAt})` : ""} ${truncate(p.text || "", 320)}`).join("\n")
    : "(no recent LinkedIn posts/shares returned by CoreSignal for this person)";
  const pressBlock = (pressSignals && pressSignals.length > 0)
    ? pressSignals.map((s, i) => `[${i + 1}] ${s.source.toUpperCase()}: ${s.title}\n    URL: ${s.url}\n    SNIPPET: ${truncate(s.content, 400)}`).join("\n\n")
    : "(no press / podcast / interview mentions found for this person)";
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
    (() => {
      const raw = (profile?.raw || {}) as { previousCompanies?: Array<{ company?: string; title?: string; from?: string; to?: string }>; educationSummary?: string; skills?: string[] };
      const prev = (raw.previousCompanies || []).slice(0, 4)
        .map((p) => `${p.title || "?"} at ${p.company || "?"}${p.from ? ` (${p.from}${p.to ? `–${p.to}` : "–present"})` : ""}`)
        .filter(Boolean);
      return prev.length > 0 ? `PREVIOUS EMPLOYERS: ${prev.join(" · ")}` : "";
    })(),
    (() => {
      const raw = (profile?.raw || {}) as { educationSummary?: string };
      return raw.educationSummary ? `EDUCATION: ${raw.educationSummary}` : "";
    })(),
    (() => {
      const raw = (profile?.raw || {}) as { skills?: string[] };
      const sk = raw.skills || [];
      return sk.length > 0 ? `SKILLS: ${sk.slice(0, 6).join(", ")}` : "";
    })(),
    `RECENT LINKEDIN POSTS / SHARES / ACTIVITY (CoreSignal multi_source):\n${recentPosts}`,
    "",
    `PRESS / PODCAST / INTERVIEW MENTIONS (Tavily — Indian B2B press, podcast venues, talks; quote a real phrase from these):\n${pressBlock}`,
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

function classifyIcpRole(stakeholder: Stakeholder): string {
  const t = (stakeholder.title || "").toLowerCase();
  if (/founder|cofounder|co-founder|ceo|chief executive|owner|managing director|md\b|president/.test(t)) return "Founder/CEO";
  if (/cmo|chief marketing|vp marketing|head of marketing|head of digital marketing/.test(t)) return "VP Marketing";
  if (/cgo|chief growth|head of growth|vp growth/.test(t)) return "Head of Growth";
  if (/cto|chief technology|vp engineering|head of engineering/.test(t)) return "CTO/VP Eng";
  if (/cpo|chief product|head of product|vp product/.test(t)) return "Head of Product";
  if (/cfo|chief financial/.test(t)) return "CFO";
  if (/vp sales|head of sales/.test(t)) return "VP Sales";
  return "Other";
}

// Pull a clean, citable phrase from a press/interview/podcast snippet.
// REJECTS Tavily snippets that are just LinkedIn-profile-page boilerplate (headline + title)
// — those aren't actual interview content, just the public profile page Tavily indexed.
const LINKEDIN_BOILERPLATE_RE = /(senior|chief|vice|head|director|manager|founder|ceo|cmo|cto)\s.{0,80}\sat\s/i;
function extractPhraseFromPress(signals: PressSignal[]): { phrase: string; source: string; url: string } | null {
  if (!signals || signals.length === 0) return null;
  for (const s of signals) {
    const content = (s.content || "").trim();
    if (!content) continue;
    // Skip LinkedIn profile pages — they show up in Tavily but their snippet is just
    // "Saurabh Sakhuja - Senior Vice President at BikeWale - View profile..." which is
    // NOT a real post or interview quote. Keep article/podcast/etbrandequity hits only.
    const url = (s.url || "").toLowerCase();
    if (url.includes("linkedin.com/in/") || url.includes("linkedin.com/posts/")) continue;
    const sentences = content.split(/[.!?\n]+/).map((x) => x.trim()).filter((x) => x.length > 25 && x.length < 240);
    // Skip sentences that look like profile boilerplate (Title at Company)
    const realQuote = sentences.find((x) => !LINKEDIN_BOILERPLATE_RE.test(x));
    const pick = realQuote || sentences[0];
    if (pick && pick.length > 20) {
      return { phrase: pick.slice(0, 130), source: s.source, url: s.url };
    }
  }
  return null;
}

// Topical keywords that make a post worth quoting in a B2B email.
// Posts that mention these are about decisions / ops / growth — the kind of thing the
// recipient would recognize and want to discuss. Posts about politics, hot takes,
// motivational content, or random reposts get rejected.
const MEANINGFUL_TOPIC_RE = /(\b(growth|conversion|cro|funnel|onboard|activation|retention|churn|cac|ltv|aov|cvr|ctr|experiment|a\/?b test|optimi[sz]|landing page|signup|checkout|d2c|saas|product[\s-]market fit|pmf|roadmap|launch|hir(e|ing)|fund(ed|ing)|series [a-d]|ipo|valuation|revenue|arr|mrr|runway|profitable|revenue growth|customer acquisition|paid acquisition|performance marketing|brand|content marketing|pricing|packaging|trial|demo|sales cycle|pipeline|cold email|outbound|abm|account-based)\b)/i;

// Specificity test: a sentence has a number, a verb of decision/action, or a quote-worthy claim.
// Generic sentences ("excited to be here", "great team", "honored") fail this check.
function isSpecific(s: string): boolean {
  if (s.length < 30 || s.length > 300) return false;
  const hasNumber = /\d{2,}|\d+\s*[%xk]|\d+\s*(months?|weeks?|days?|crore|lakh|million|billion)/i.test(s);
  const hasVerb = /\b(launched?|shipped?|hired?|raised?|cut|grew|drove|reduced|increased|tested|experimented|killed|deprecated|migrated|rebuilt|onboarded|acquired|partnered|signed|closed)\b/i.test(s);
  const isHotTake = /\b(I think|we believe|in my view|my take|the lesson|the playbook|the trick|the unlock|here's what|hot take|unpopular)\b/i.test(s);
  return hasNumber || hasVerb || isHotTake;
}

// Recency check: was this posted/published within the meaningful window?
function isRecent(postedAt: string | undefined, maxDays = 90): boolean {
  if (!postedAt) return false;
  const t = Date.parse(postedAt);
  if (Number.isNaN(t)) return false;
  return (Date.now() - t) <= maxDays * 24 * 60 * 60 * 1000;
}

// Deterministic social-angle from CoreSignal/Apify posts + press signals.
// STRICT MEANINGFULNESS BAR: only returns a non-empty value when the signal is
//   (a) recent (≤90 days),
//   (b) specific (has a number, action-verb, or hot-take), AND
//   (c) topical for B2B sales contexts (growth/CR/product/hiring/funding/etc).
// When nothing meets the bar, returns "" — DO NOT fake with "13 months in role" /
// "ex-CarWale" / headline filler. Empty is the honest answer; the operator should
// either skip this lead or do manual Sales Nav research.
function deriveDeterministicSocialAngle(profile: ApifyMemberData | null, _account: ScoredAccount, pressSignals: PressSignal[] = []): string {
  // 1. ACTUAL recent + specific + topical LinkedIn post.
  if (profile?.recentPosts && profile.recentPosts.length > 0) {
    for (const post of profile.recentPosts) {
      const text = (post.text || "").trim();
      if (text.length < 40) continue;
      // Recency check — if no postedAt, we can't verify; skip rather than guess.
      if (!isRecent(post.postedAt)) continue;
      // Find the first sentence that is BOTH topical AND specific
      const sentences = text.split(/[.!?\n]+/).map((s) => s.trim()).filter((s) => s.length > 30 && s.length < 240);
      const meaningful = sentences.find((s) => MEANINGFUL_TOPIC_RE.test(s) && isSpecific(s));
      if (meaningful) {
        const phrase = meaningful.slice(0, 130);
        return `your recent post: "${phrase}${meaningful.length > 130 ? "…" : ""}"`;
      }
    }
  }

  // 2. Press / podcast / interview / article — must contain a meaningful sentence.
  // The boilerplate-rejection in extractPhraseFromPress already filters profile pages.
  // Here we add the topic + specificity bar.
  for (const s of pressSignals) {
    const url = (s.url || "").toLowerCase();
    if (url.includes("linkedin.com/in/") || url.includes("linkedin.com/posts/")) continue;
    const content = (s.content || "").trim();
    const sentences = content.split(/[.!?\n]+/).map((x) => x.trim()).filter((x) => x.length > 30 && x.length < 240);
    const meaningful = sentences.find((sent) => !LINKEDIN_BOILERPLATE_RE.test(sent) && MEANINGFUL_TOPIC_RE.test(sent) && isSpecific(sent));
    if (meaningful) {
      const verb = s.source === "podcast" ? "from your podcast appearance" : s.source === "interview" ? "from your interview" : s.source === "article" ? "from your article" : "from your public mention";
      return `${verb}: "${meaningful.slice(0, 130)}${meaningful.length > 130 ? "…" : ""}"`;
    }
  }

  // No meaningful signal found. Honest empty — generic title/tenure/employer/education
  // are NOT "social angles". Returning empty signals to the operator that this lead
  // needs manual Sales Nav research OR should be skipped.
  return "";
}

function deriveDeterministicPersonEvidence(profile: ApifyMemberData | null, pressSignals: PressSignal[] = []): string[] {
  const out: string[] = [];
  if (profile?.recentPosts && profile.recentPosts.length > 0) {
    const post = profile.recentPosts[0];
    const text = (post.text || "").trim().slice(0, 80);
    if (text) out.push(`recent LinkedIn post: "${text}${(post.text || "").length > 80 ? "…" : ""}"${post.postedAt ? ` (${post.postedAt})` : ""}`);
  }
  for (const s of pressSignals.slice(0, 2)) {
    out.push(`${s.source}: "${(s.title || s.content).slice(0, 80)}…" (${s.url ? new URL(s.url).hostname : "?"})`);
  }
  if (profile?.monthsInCurrentRole && profile.monthsInCurrentRole > 0) {
    out.push(`${profile.monthsInCurrentRole} months in current role`);
  }
  const raw = (profile?.raw || {}) as { previousCompanies?: Array<{ company?: string; title?: string }>; educationSummary?: string };
  const prev = raw.previousCompanies?.[0];
  if (prev?.company) {
    out.push(`previously ${prev.title || ""} at ${prev.company}`.replace(/\s+/g, " ").trim());
  }
  if (raw.educationSummary) out.push(raw.educationSummary);
  return out.slice(0, 3);
}

function fallbackPerLead(account: ScoredAccount, stakeholder: Stakeholder, accountResearch: LeadResearch | null, profile: ApifyMemberData | null = null, pressSignals: PressSignal[] = []): PerLeadResearch {
  return {
    observationAngle: accountResearch?.observationAngle || "",
    topPain: accountResearch?.topPain || "",
    valueAngle: accountResearch?.valueAngle || "",
    socialAngle: deriveDeterministicSocialAngle(profile, account, pressSignals),
    evidenceList: accountResearch?.socialProofMatch || [],
    personEvidence: deriveDeterministicPersonEvidence(profile, pressSignals),
    icpRole: classifyIcpRole(stakeholder),
  };
}

function memberHitToProfile(m: MemberHit): ApifyMemberData {
  const prevSummary = (m.previousCompanies || [])
    .slice(0, 3)
    .map((p) => [p.title, p.company].filter(Boolean).join(" at "))
    .filter(Boolean)
    .join(" · ");
  const fallbackHeadline = [
    m.title,
    m.monthsInCurrentRole ? `${m.monthsInCurrentRole} months in role` : null,
    prevSummary ? `previously: ${prevSummary}` : null,
    m.educationSummary,
  ].filter(Boolean).join(" — ");

  return {
    fullName: m.fullName,
    title: m.title,
    headline: m.title || fallbackHeadline,
    location: m.location,
    linkedinUrl: m.linkedinUrl,
    monthsInCurrentRole: m.monthsInCurrentRole,
    recentPosts: (m.recentActivity || []).map((a) => ({
      text: a.text || "",
      postedAt: a.postedAt,
      engagement: a.engagement,
    })),
    raw: {
      source: "coresignal",
      previousCompanies: m.previousCompanies || [],
      educationSummary: m.educationSummary || "",
      skills: m.skills || [],
    },
  };
}

function findMemberInSnapshot(snapshot: { members?: MemberHit[] }, stakeholder: Stakeholder): MemberHit | null {
  const fn = (stakeholder.firstName || "").toLowerCase().trim();
  const ln = (stakeholder.lastName || "").toLowerCase().trim();
  const full = (stakeholder.fullName || `${fn} ${ln}`).toLowerCase().trim();
  for (const m of snapshot.members || []) {
    const mn = (m.fullName || "").toLowerCase().trim();
    if (!mn) continue;
    if (mn === full) return m;
    if (fn && ln && mn.includes(fn) && mn.includes(ln)) return m;
  }
  return null;
}

async function personalizeOne(args: {
  account: ScoredAccount;
  stakeholder: Stakeholder;
  accountResearch: LeadResearch | null;
  brief?: ClientBrief;
  sellerName: string;
  signal?: AbortSignal;
  coreSignalOnly?: boolean;
  coreSignalSnapshot?: CoreSignalSnapshot | null;
}): Promise<{ perLead: PerLeadResearch; tokensIn: number; tokensOut: number; profileHit: boolean; profileMiss: boolean; llmCalled: boolean; usedLightPath: boolean; postCount: number; tenureMonths: number; prevEmployerCount: number; pressCount: number }> {
  const { account, stakeholder, accountResearch, brief, sellerName, signal, coreSignalOnly, coreSignalSnapshot: csSnap } = args;

  let profile: ApifyMemberData | null = null;
  let profileHit = false;
  let profileMiss = false;

  // CoreSignal per-lead lookup — searches the multi_source dataset by linkedin_url first
  // (unambiguous), then by full_name + active_experience_company_id. Returns the EXACT
  // person Apollo gave us, with their real LinkedIn posts/shares/activities/education/etc.
  if (isCoreSignalLive()) {
    try {
      const companyId = csSnap?.company?.id ?? null;
      const matched = await fetchMemberForLead({
        linkedinUrl: stakeholder.linkedinUrl,
        fullName: stakeholder.fullName,
        firstName: stakeholder.firstName,
        lastName: stakeholder.lastName,
        title: stakeholder.title,
        companyId,
        companyDomain: account.domain,
      }, signal);
      if (matched) {
        profile = memberHitToProfile(matched);
        profileHit = true;
      } else if (csSnap) {
        // Fallback: if the company-wide snapshot already pulled this member, reuse them
        // (saves a credit) — works when the by-name search misses but the broad search hit.
        const fromSnapshot = findMemberInSnapshot(csSnap, stakeholder);
        if (fromSnapshot) {
          profile = memberHitToProfile(fromSnapshot);
          profileHit = true;
        }
      }
    } catch {
      // CoreSignal failure — keep going; we'll still try Apify below.
    }
  }

  // ALWAYS try Apify on top — it's the only source that reliably returns ACTUAL LinkedIn
  // posts/shares/activities by URL. CoreSignal multi_source has them sometimes (subscription
  // tier dependent); Apify scrapes the LinkedIn page directly and returns the post text.
  // Per the operator's explicit instruction ("with using any api, atmost credits, just get
  // me that detail"), we're overriding the SKILL doc's "Apify out of policy for VWO" rule.
  // Cost: ~$0.005-0.015 per profile-scrape, runs only when stakeholder.linkedinUrl exists.
  if (stakeholder.linkedinUrl && isApifyLive()) {
    try {
      const apifyProfile = await apifyScrapeProfile(stakeholder.linkedinUrl, signal);
      if (apifyProfile) {
        if (profile) {
          // Merge: keep CoreSignal's profile fields, override recentPosts when Apify has more.
          // Apify is the post-richer source, so its posts beat CoreSignal's (often-empty) ones.
          if (apifyProfile.recentPosts && apifyProfile.recentPosts.length > 0) {
            profile.recentPosts = apifyProfile.recentPosts;
          }
          // Backfill any missing fields from Apify
          if (!profile.headline) profile.headline = apifyProfile.headline;
          if (!profile.location) profile.location = apifyProfile.location;
          if (!profile.monthsInCurrentRole) profile.monthsInCurrentRole = apifyProfile.monthsInCurrentRole;
        } else {
          // CoreSignal had nothing — Apify becomes the sole source
          profile = apifyProfile;
        }
        profileHit = true;
      }
    } catch {
      // Apify failure — non-fatal
    }
  }

  if (!profile) profileMiss = true;

  // Per-lead PRESS / PODCAST / INTERVIEW lookup — Tavily, runs for every lead.
  // Cheap (~$0.005) and ALWAYS available (doesn't depend on CoreSignal subscription tier).
  // The realistic personalization signal: real interviews, talks, and articles by THIS person.
  let pressSignals: PressSignal[] = [];
  try {
    pressSignals = await lookupLeadPressMentions(stakeholder, account, signal);
  } catch {
    pressSignals = [];
  }

  const fb = fallbackPerLead(account, stakeholder, accountResearch, profile, pressSignals);

  // If the account already has observation/top-pain/value-angle from Phase 8 research,
  // skip regenerating them and only ask Haiku for the per-person fields.
  const hasAccountFields = !!(
    accountResearch &&
    (accountResearch.observationAngle?.trim() || "").length > 0 &&
    (accountResearch.topPain?.trim() || "").length > 0 &&
    (accountResearch.valueAngle?.trim() || "").length > 0
  );

  const userPayload = buildUserPayload({ account, stakeholder, accountResearch, profile, brief, sellerName, pressSignals });
  const mockOutput = hasAccountFields
    ? JSON.stringify({ social_angle: fb.socialAngle, person_evidence: fb.personEvidence, icp_role: fb.icpRole })
    : JSON.stringify({
        observation_angle: fb.observationAngle,
        top_pain: fb.topPain,
        value_angle: fb.valueAngle,
        social_angle: fb.socialAngle,
        evidence_list: fb.evidenceList,
        person_evidence: fb.personEvidence,
        icp_role: fb.icpRole,
      });

  const result = await llm({
    system: hasAccountFields ? PERSON_ONLY_SYSTEM : SYSTEM,
    user: userPayload,
    maxTokens: hasAccountFields ? 320 : 800,
    jsonOnly: true,
    cacheSystem: true,
    model: "haiku",
    mockOutput,
  });

  const postCount = profile?.recentPosts?.length || 0;
  const tenureMonths = profile?.monthsInCurrentRole || 0;
  const prevEmployerCount = ((profile?.raw || {}) as { previousCompanies?: unknown[] }).previousCompanies?.length || 0;

  let parsed: Record<string, unknown> = {};
  try { parsed = JSON.parse(result.text); } catch {
    return {
      perLead: fb,
      tokensIn: result.inputTokens || 0,
      tokensOut: result.outputTokens || 0,
      profileHit, profileMiss, llmCalled: result.isLive, usedLightPath: hasAccountFields,
      postCount, tenureMonths, prevEmployerCount, pressCount: pressSignals.length,
    };
  }

  const parsedSocialAngle = truncate(safeStr(parsed.social_angle), 200);
  const parsedPersonEvidence = safeStrArr(parsed.person_evidence);
  const perLead: PerLeadResearch = hasAccountFields
    ? {
        // Account-level fields are SHARED — copied verbatim from accountResearch (no LLM cost)
        observationAngle: accountResearch!.observationAngle,
        topPain: accountResearch!.topPain,
        valueAngle: accountResearch!.valueAngle,
        evidenceList: accountResearch!.evidenceList && accountResearch!.evidenceList.length > 0 ? accountResearch!.evidenceList : fb.evidenceList,
        // Per-person fields — Haiku output preferred; deterministic CoreSignal-derived fallback
        // (tenure / past employer / education / first post) when Haiku returns empty.
        socialAngle: parsedSocialAngle || fb.socialAngle,
        personEvidence: parsedPersonEvidence.length > 0 ? parsedPersonEvidence : fb.personEvidence,
        icpRole: safeStr(parsed.icp_role) || fb.icpRole,
      }
    : {
        observationAngle: truncate(safeStr(parsed.observation_angle), 200) || fb.observationAngle,
        topPain: truncate(safeStr(parsed.top_pain), 160) || fb.topPain,
        valueAngle: truncate(safeStr(parsed.value_angle), 200) || fb.valueAngle,
        socialAngle: parsedSocialAngle || fb.socialAngle,
        evidenceList: safeStrArr(parsed.evidence_list).length > 0 ? safeStrArr(parsed.evidence_list) : fb.evidenceList,
        personEvidence: parsedPersonEvidence.length > 0 ? parsedPersonEvidence : fb.personEvidence,
        icpRole: safeStr(parsed.icp_role) || fb.icpRole,
      };

  return {
    perLead,
    tokensIn: result.inputTokens || 0,
    tokensOut: result.outputTokens || 0,
    profileHit, profileMiss, llmCalled: result.isLive, usedLightPath: hasAccountFields,
    postCount, tenureMonths, prevEmployerCount, pressCount: pressSignals.length,
  };
}

export async function personalizeLeadsAgent(input: PersonalizeInput): Promise<{ output: PersonalizeOutput; state: Pick<PhaseState, "log" | "metrics" | "inputCount" | "outputCount" | "llmTokensIn" | "llmTokensOut"> }> {
  const log: string[] = [];
  const writes: { domain: string; personKey: string; perLead: PerLeadResearch }[] = [];
  let apifyProfileHits = 0, apifyProfileMisses = 0;
  let llmCalls = 0, tokensIn = 0, tokensOut = 0;
  let lightCalls = 0, fullCalls = 0;
  const accountLevelHits = new Set<string>();

  const concurrency = Math.max(1, Math.min(8, input.concurrency || 5));
  const csOnly = input.coreSignalOnly === true;
  if (csOnly) {
    log.push(`Per-lead personalize (CoreSignal-only mode): ${input.rows.length} leads · concurrency ${concurrency} · CoreSignal ${isCoreSignalLive() ? "live" : "off"} · Apify ${isApifyLive() ? "live (post-richer source)" : "off"} · Haiku synthesis.`);
  } else {
    log.push(`Per-lead personalize: ${input.rows.length} leads · concurrency ${concurrency} · Apify ${isApifyLive() ? "live" : "off"} · Haiku synthesis.`);
  }

  let cancelled = false;
  let cursor = 0;
  const startedAt = Date.now();

  // Pre-fetch a company-level CoreSignal snapshot for EVERY unique domain in this run
  // (not just coreSignalOnly mode). The snapshot resolves the CoreSignal company_id for the
  // domain, which the per-lead lookup then uses to filter members by company. Without this,
  // fetchMemberForLead has to resolve the company_id itself per lead — wasted credits.
  const csByDomain = new Map<string, CoreSignalSnapshot>();
  if (isCoreSignalLive()) {
    const uniqueDomains = Array.from(new Set(input.rows.map((r) => (r.account.domain || "").toLowerCase()).filter(Boolean)));
    log.push(`CoreSignal prefetch: ${uniqueDomains.length} domains to resolve company_id and pull broad member set.`);
    for (const dom of uniqueDomains) {
      if (cancelled || input.signal?.aborted) break;
      try {
        const snap = await coreSignalSnapshot(dom, input.signal, {
          championTitles: ["CEO", "Chief Executive Officer", "Director", "VP", "Vice President", "Head", "Chief", "Founder"],
          postKeywords: [],
        });
        csByDomain.set(dom, snap);
        log.push(`CoreSignal ${dom}: company_id=${snap.company?.id ?? "?"} · members=${snap.members?.length || 0}${snap.errors.length > 0 ? ` · errors=[${snap.errors.slice(0, 2).join("; ")}]` : ""}`);
      } catch (err) {
        log.push(`CoreSignal snapshot failed for ${dom}: ${err instanceof Error ? err.message : "unknown"}`);
      }
    }
    log.push(`CoreSignal prefetch done: ${csByDomain.size}/${uniqueDomains.length} domains resolved. Members across all: ${Array.from(csByDomain.values()).reduce((s, x) => s + (x.members?.length || 0), 0)}.`);
  } else {
    log.push("CoreSignal not configured (CORESIGNAL_API_KEY missing) — per-lead profile data will be unavailable.");
  }

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
          coreSignalOnly: csOnly,
          coreSignalSnapshot: csByDomain.get(dom) || null,
        });
        if (r.profileHit) apifyProfileHits++;
        if (r.profileMiss) apifyProfileMisses++;
        if (r.llmCalled) llmCalls++;
        if (r.usedLightPath) {
          lightCalls++;
          accountLevelHits.add(dom);
        } else {
          fullCalls++;
        }
        tokensIn += r.tokensIn;
        tokensOut += r.tokensOut;
        // Per-lead trace so the dev-server console shows exactly why social_angle did or didn't populate.
        const angleLen = (r.perLead.socialAngle || "").length;
        const tag = angleLen > 0 ? "OK" : "EMPTY";
        log.push(`[${tag}] ${dom} / ${row.stakeholder.fullName} (${row.stakeholder.title || "?"}) — coresignal=${r.profileHit ? "hit" : "miss"} · posts=${r.postCount} · press=${r.pressCount} · tenure=${r.tenureMonths}m · prev-employers=${r.prevEmployerCount} · socialAngle=${angleLen}c · evidence=${r.perLead.personEvidence.length}`);
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
  const savedFullCalls = lightCalls;
  log.push(`Done: ${writes.length}/${input.rows.length} leads personalized in ${elapsed}s. Apify: ${apifyProfileHits} hits / ${apifyProfileMisses} misses. LLM calls: ${llmCalls} (${fullCalls} full · ${lightCalls} light · ${accountLevelHits.size} accounts shared) · saved ~${savedFullCalls} full calls by reusing account-level fields.`);

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
