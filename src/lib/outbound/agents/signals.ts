import type { ScoredAccount } from "../types";
import type { CoreSignalSnapshot, MemberHit } from "../coresignal";
import type { ApifySnapshotResult } from "../apify";

export function mergeApifyIntoCoreSignal(cs: CoreSignalSnapshot, apify: ApifySnapshotResult): CoreSignalSnapshot {
  const merged: CoreSignalSnapshot = {
    domain: cs.domain || apify.domain,
    fetchedAt: new Date().toISOString(),
    errors: [...cs.errors, ...apify.errors],
    company: cs.company,
    recentJobs: cs.recentJobs.length > 0 ? cs.recentJobs : apify.jobs.map((j) => ({
      title: j.title,
      posted_date: j.postedDate,
      location: j.location,
      function: j.function,
      seniority: j.seniority,
    })),
    members: cs.members.length > 0 ? cs.members : apify.members.map((m): MemberHit => ({
      id: m.linkedinUrl || m.fullName || "unknown",
      fullName: m.fullName,
      title: m.title,
      location: m.location,
      monthsInCurrentRole: m.monthsInCurrentRole,
      linkedinUrl: m.linkedinUrl,
      recentActivity: (m.recentPosts || []).map((p) => ({
        kind: "post" as const,
        text: p.text,
        postedAt: p.postedAt,
        engagement: p.engagement,
      })),
    })),
  };
  if (!merged.company && apify.company) {
    merged.company = {
      id: apify.company.linkedinUrl || apify.domain,
      website: apify.company.website || apify.domain,
      name: apify.company.name,
      industry: apify.company.industry,
      short_description: apify.company.description,
      employees_count: apify.company.employeesCount,
      founded: apify.company.founded,
      hq_country: apify.company.headquarters,
      active_job_postings_count: apify.jobs.length,
      raw: apify.company.raw,
    };
  }
  return merged;
}

export interface JobSignal {
  title: string;
  postedDate: string;
  function: string;
  seniority: string;
  matchedKeywords: string[];
  paintAlignment: 0 | 1 | 2 | 3;
}

export interface MemberSignal {
  name: string;
  title: string;
  monthsInRole: number;
  recentlyJoined: boolean;
  recentPostsMatchingKeywords: Array<{ text: string; keywords: string[]; postedAt?: string; engagement?: number }>;
  linkedinUrl?: string;
}

export interface StructuredSignals {
  account: { domain: string; name: string };

  hiring: {
    activeJobsCount: number;
    painRolesOpen: JobSignal[];
    growthRolesOpen: JobSignal[];
    strength: number;
    verdict: "active-pain-hiring" | "growth-hiring" | "general-hiring" | "no-hiring-signal" | "unknown";
  };

  team: {
    headcount: number | null;
    growth6mPct: number | null;
    growth12mPct: number | null;
    velocity: "high-growth" | "moderate-growth" | "stable" | "decline" | "unknown";
  };

  leadership: {
    championsAtCompany: MemberSignal[];
    anyChampionRecentlyHired: boolean;
    activeChampionPosts: number;
  };

  funding: {
    lastRoundType?: string;
    lastRoundAmountUsd?: number;
    lastRoundDate?: string;
    daysSinceLastRound?: number;
    recency: "<6mo" | "6-12mo" | ">12mo" | "none";
  };

  techStack: {
    detected: string[];
    competitorsPresent: string[];
    complementsPresent: string[];
  };

  webPresence: {
    description: string;
    keywords: string[];
  };

  evidence: string[];
  buyerSignalScore: number;
}

const HIGH_PAIN_KEYWORDS = ["conversion", "cro", "a/b test", "optimization", "experiment", "funnel", "checkout", "personalization", "growth"];
const GROWTH_KEYWORDS = ["growth", "head of growth", "vp growth", "performance", "lifecycle", "demand"];

function lower(s: string | undefined): string { return (s || "").toLowerCase(); }

function paintAlignment(jobTitle: string, hiringKeywords: string[]): 0 | 1 | 2 | 3 {
  const lt = lower(jobTitle);
  if (!lt) return 0;
  let hits = 0;
  for (const k of hiringKeywords) {
    if (k && lt.includes(lower(k))) hits++;
  }
  if (hits >= 2) return 3;
  if (hits === 1) return 2;
  for (const k of HIGH_PAIN_KEYWORDS) if (lt.includes(k)) return 1;
  return 0;
}

function classifyHiring(snapshot: CoreSignalSnapshot, hiringKeywords: string[]): StructuredSignals["hiring"] {
  const jobs = snapshot.recentJobs || [];
  const painRolesOpen: JobSignal[] = [];
  const growthRolesOpen: JobSignal[] = [];
  for (const j of jobs) {
    const align = paintAlignment(j.title || "", hiringKeywords);
    const matched = hiringKeywords.filter((k) => lower(j.title || "").includes(lower(k)));
    const sig: JobSignal = {
      title: j.title || "",
      postedDate: j.posted_date || "",
      function: j.function || "",
      seniority: j.seniority || "",
      matchedKeywords: matched,
      paintAlignment: align,
    };
    if (align >= 2) painRolesOpen.push(sig);
    else if (GROWTH_KEYWORDS.some((k) => lower(sig.title).includes(k))) growthRolesOpen.push(sig);
  }
  const activeJobsCount = snapshot.company?.active_job_postings_count ?? jobs.length;
  let strength = 0;
  strength += Math.min(painRolesOpen.length * 25, 60);
  strength += Math.min(growthRolesOpen.length * 10, 25);
  strength += Math.min(Math.floor(activeJobsCount / 5), 15);
  let verdict: StructuredSignals["hiring"]["verdict"] = "unknown";
  if (painRolesOpen.length >= 1) verdict = "active-pain-hiring";
  else if (growthRolesOpen.length >= 1) verdict = "growth-hiring";
  else if (activeJobsCount > 5) verdict = "general-hiring";
  else if (activeJobsCount === 0) verdict = "no-hiring-signal";
  return { activeJobsCount, painRolesOpen, growthRolesOpen, strength, verdict };
}

function classifyTeam(snapshot: CoreSignalSnapshot, account: ScoredAccount): StructuredSignals["team"] {
  const c = snapshot.company;
  const headcount = c?.employees_count ?? account.estimatedNumEmployees ?? null;
  const growth6 = c?.headcount_growth_6m ?? account.headcount6mGrowth ?? null;
  const growth12 = c?.headcount_growth_12m ?? account.headcount12mGrowth ?? null;
  let velocity: StructuredSignals["team"]["velocity"] = "unknown";
  const g = growth6 ?? growth12 ?? null;
  if (g != null) {
    if (g >= 0.20) velocity = "high-growth";
    else if (g >= 0.05) velocity = "moderate-growth";
    else if (g >= -0.05) velocity = "stable";
    else velocity = "decline";
  }
  return { headcount, growth6mPct: growth6, growth12mPct: growth12, velocity };
}

function classifyLeadership(members: MemberHit[]): StructuredSignals["leadership"] {
  const championsAtCompany: MemberSignal[] = members.map((m) => ({
    name: m.fullName || "",
    title: m.title || "",
    monthsInRole: m.monthsInCurrentRole ?? -1,
    recentlyJoined: typeof m.monthsInCurrentRole === "number" && m.monthsInCurrentRole <= 12,
    recentPostsMatchingKeywords: (m.recentActivity || []).map((a) => ({
      text: (a.text || "").slice(0, 240),
      keywords: [],
      postedAt: a.postedAt,
      engagement: a.engagement,
    })),
    linkedinUrl: m.linkedinUrl,
  }));
  const anyChampionRecentlyHired = championsAtCompany.some((c) => c.recentlyJoined);
  const activeChampionPosts = championsAtCompany.reduce((a, c) => a + c.recentPostsMatchingKeywords.length, 0);
  return { championsAtCompany, anyChampionRecentlyHired, activeChampionPosts };
}

function classifyFunding(snapshot: CoreSignalSnapshot): StructuredSignals["funding"] {
  const f = snapshot.company?.last_funding_round;
  if (!f || !f.announced_date) return { recency: "none" };
  const t = Date.parse(f.announced_date);
  if (Number.isNaN(t)) return { recency: "none", lastRoundType: f.type, lastRoundAmountUsd: f.amount_usd };
  const days = Math.round((Date.now() - t) / (1000 * 60 * 60 * 24));
  let recency: StructuredSignals["funding"]["recency"] = ">12mo";
  if (days < 180) recency = "<6mo";
  else if (days < 365) recency = "6-12mo";
  return { lastRoundType: f.type, lastRoundAmountUsd: f.amount_usd, lastRoundDate: f.announced_date, daysSinceLastRound: days, recency };
}

function classifyTech(snapshot: CoreSignalSnapshot, competitorsToWatch: string[], complementsToWatch: string[]): StructuredSignals["techStack"] {
  const techs = (snapshot.company?.technologies || []).map((t) => t.toLowerCase());
  const lc = (s: string) => s.toLowerCase();
  const competitorsPresent = competitorsToWatch.filter((c) => techs.includes(lc(c)));
  const complementsPresent = complementsToWatch.filter((c) => techs.includes(lc(c)));
  return { detected: techs, competitorsPresent, complementsPresent };
}

export function classifySignals(args: {
  account: ScoredAccount;
  snapshot: CoreSignalSnapshot;
  hiringKeywords: string[];
  competitorsToWatch: string[];
  complementsToWatch: string[];
}): StructuredSignals {
  const { account, snapshot, hiringKeywords, competitorsToWatch, complementsToWatch } = args;

  const hiring = classifyHiring(snapshot, hiringKeywords);
  const team = classifyTeam(snapshot, account);
  const leadership = classifyLeadership(snapshot.members || []);
  const funding = classifyFunding(snapshot);
  const techStack = classifyTech(snapshot, competitorsToWatch, complementsToWatch);

  const evidence: string[] = [];
  if (hiring.painRolesOpen.length > 0) evidence.push(`hiring ${hiring.painRolesOpen.length} pain-aligned role(s): ${hiring.painRolesOpen.map((j) => j.title).slice(0, 3).join(", ")}`);
  if (hiring.growthRolesOpen.length > 0) evidence.push(`${hiring.growthRolesOpen.length} growth role(s) open`);
  if (team.velocity === "high-growth") evidence.push(`${team.growth6mPct != null ? Math.round(team.growth6mPct * 100) + "% headcount growth (6m)" : "high headcount velocity"}`);
  if (leadership.anyChampionRecentlyHired) {
    const ch = leadership.championsAtCompany.find((c) => c.recentlyJoined);
    if (ch) evidence.push(`${ch.title} hired ${ch.monthsInRole}mo ago (${ch.name})`);
  }
  if (leadership.activeChampionPosts > 0) evidence.push(`${leadership.activeChampionPosts} matching post(s) by champion(s)`);
  if (funding.recency === "<6mo") evidence.push(`recent funding: ${funding.lastRoundType || "round"} ${funding.lastRoundDate || ""}`);
  if (techStack.competitorsPresent.length > 0) evidence.push(`uses competitor(s): ${techStack.competitorsPresent.slice(0, 3).join(", ")}`);
  if (techStack.complementsPresent.length > 0) evidence.push(`uses complement(s): ${techStack.complementsPresent.slice(0, 3).join(", ")}`);

  let buyerSignalScore = 0;
  buyerSignalScore += hiring.painRolesOpen.length * 15;
  buyerSignalScore += hiring.growthRolesOpen.length * 6;
  if (team.velocity === "high-growth") buyerSignalScore += 12;
  else if (team.velocity === "moderate-growth") buyerSignalScore += 5;
  if (leadership.anyChampionRecentlyHired) buyerSignalScore += 18;
  buyerSignalScore += leadership.activeChampionPosts * 8;
  if (funding.recency === "<6mo") buyerSignalScore += 10;
  buyerSignalScore += techStack.competitorsPresent.length * 6;
  buyerSignalScore = Math.min(100, buyerSignalScore);

  return {
    account: { domain: account.domain, name: account.name },
    hiring,
    team,
    leadership,
    funding,
    techStack,
    webPresence: {
      description: account.shortDescription || "",
      keywords: (account.keywords || []).slice(0, 8),
    },
    evidence,
    buyerSignalScore,
  };
}

export function summarizeSignalsForLLM(s: StructuredSignals): string {
  const lines: string[] = [];
  lines.push(`STRUCTURED SIGNALS for ${s.account.name} (${s.account.domain})`);
  lines.push(`buyer_signal_score: ${s.buyerSignalScore}/100`);
  lines.push(``);
  lines.push(`HIRING — verdict: ${s.hiring.verdict}, strength: ${s.hiring.strength}, active jobs: ${s.hiring.activeJobsCount}`);
  if (s.hiring.painRolesOpen.length > 0) {
    lines.push(`  Pain-aligned roles open:`);
    for (const r of s.hiring.painRolesOpen.slice(0, 5)) {
      lines.push(`    - "${r.title}" · ${r.seniority || "—"} · posted ${r.postedDate || "?"} · matched keywords: ${r.matchedKeywords.join(", ") || "—"}`);
    }
  }
  if (s.hiring.growthRolesOpen.length > 0) {
    lines.push(`  Growth roles open:`);
    for (const r of s.hiring.growthRolesOpen.slice(0, 3)) lines.push(`    - "${r.title}" · ${r.seniority || "—"}`);
  }
  lines.push(``);
  lines.push(`TEAM — velocity: ${s.team.velocity}${s.team.headcount != null ? `, headcount: ${s.team.headcount}` : ""}${s.team.growth6mPct != null ? `, 6m growth: ${(s.team.growth6mPct * 100).toFixed(1)}%` : ""}${s.team.growth12mPct != null ? `, 12m growth: ${(s.team.growth12mPct * 100).toFixed(1)}%` : ""}`);
  lines.push(``);
  lines.push(`LEADERSHIP — ${s.leadership.championsAtCompany.length} champion(s) at company, ${s.leadership.activeChampionPosts} matching post(s)`);
  for (const c of s.leadership.championsAtCompany.slice(0, 4)) {
    const tag = c.recentlyJoined ? `RECENTLY-HIRED (${c.monthsInRole}mo)` : (c.monthsInRole > 0 ? `${c.monthsInRole}mo in role` : "");
    lines.push(`  - ${c.name} · ${c.title} ${tag ? `· ${tag}` : ""}`);
    for (const p of c.recentPostsMatchingKeywords.slice(0, 2)) {
      lines.push(`    • ${p.postedAt || "?"}: "${(p.text || "").slice(0, 180)}"`);
    }
  }
  lines.push(``);
  lines.push(`FUNDING — recency: ${s.funding.recency}${s.funding.lastRoundType ? `, last: ${s.funding.lastRoundType}${s.funding.lastRoundAmountUsd ? ` $${(s.funding.lastRoundAmountUsd / 1e6).toFixed(1)}M` : ""}${s.funding.lastRoundDate ? ` on ${s.funding.lastRoundDate}` : ""}` : ""}`);
  lines.push(``);
  lines.push(`TECH STACK — ${s.techStack.detected.length} detected${s.techStack.competitorsPresent.length > 0 ? `, competitors present: ${s.techStack.competitorsPresent.join(", ")}` : ""}${s.techStack.complementsPresent.length > 0 ? `, complements: ${s.techStack.complementsPresent.join(", ")}` : ""}`);
  lines.push(``);
  if (s.evidence.length > 0) {
    lines.push(`EVIDENCE LIST (use these to anchor observation/top_pain — pick the SHARPEST one):`);
    for (const e of s.evidence) lines.push(`  - ${e}`);
  } else {
    lines.push(`EVIDENCE LIST: (no specific buying signals detected from CoreSignal — fall back to web/category observations)`);
  }
  return lines.join("\n").slice(0, 4000);
}
