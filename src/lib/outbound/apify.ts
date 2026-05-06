const BASE = (process.env.APIFY_BASE_URL || "https://api.apify.com/v2").replace(/\/+$/, "");

const ACTOR_COMPANY = process.env.APIFY_LINKEDIN_COMPANY_ACTOR || "apify/linkedin-company-scraper";
const ACTOR_JOBS = process.env.APIFY_LINKEDIN_JOBS_ACTOR || "bebity/linkedin-jobs-scraper";
const ACTOR_PROFILE = process.env.APIFY_LINKEDIN_PROFILE_ACTOR || "dev_fusion/linkedin-profile-scraper";

export function isApifyLive(): boolean {
  return !!(process.env.APIFY_API_KEY || "").trim();
}

export interface ApifyCompanyData {
  name?: string;
  domain?: string;
  industry?: string;
  description?: string;
  employeesCount?: number;
  size?: string;
  headquarters?: string;
  founded?: number;
  specialties?: string[];
  linkedinUrl?: string;
  website?: string;
  tagline?: string;
  raw: Record<string, unknown>;
}

export interface ApifyJobData {
  title?: string;
  function?: string;
  seniority?: string;
  location?: string;
  postedDate?: string;
  applyUrl?: string;
  description?: string;
  raw: Record<string, unknown>;
}

export interface ApifyMemberData {
  fullName?: string;
  title?: string;
  headline?: string;
  location?: string;
  linkedinUrl?: string;
  monthsInCurrentRole?: number;
  recentPosts: Array<{ text: string; postedAt?: string; engagement?: number }>;
  raw: Record<string, unknown>;
}

export interface ApifySnapshotResult {
  domain: string;
  company: ApifyCompanyData | null;
  jobs: ApifyJobData[];
  members: ApifyMemberData[];
  fetchedAt: string;
  errors: string[];
  actorRunsTriggered: { company: boolean; jobs: boolean; members: boolean };
}

export interface ApifyUser {
  id: string;
  username?: string;
  email?: string;
  plan?: string;
}

interface ApifyRunResult<T> {
  ok: boolean;
  status?: number;
  data?: T;
  error?: string;
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

export async function apifyMe(signal?: AbortSignal): Promise<ApifyRunResult<ApifyUser>> {
  const key = (process.env.APIFY_API_KEY || "").trim();
  if (!key) return { ok: false, error: "APIFY_API_KEY missing" };
  try {
    const res = await fetchWithTimeout(`${BASE}/users/me`, {
      method: "GET",
      headers: { "Authorization": `Bearer ${key}` },
      signal: signal as AbortSignal | null | undefined as AbortSignal,
    }, 15000);
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      return { ok: false, status: res.status, error: txt.slice(0, 200) };
    }
    const json = (await res.json()) as { data?: ApifyUser };
    return { ok: true, status: 200, data: json.data };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "unknown" };
  }
}

export interface ApifyActorRunInput {
  actorId: string;
  input: Record<string, unknown>;
  waitForFinishSeconds?: number;
}

export interface ApifyActorRunOutput {
  ok: boolean;
  status?: number;
  runId?: string;
  defaultDatasetId?: string;
  items?: unknown[];
  error?: string;
}

export async function runApifyActor(args: ApifyActorRunInput, signal?: AbortSignal): Promise<ApifyActorRunOutput> {
  const key = (process.env.APIFY_API_KEY || "").trim();
  if (!key) return { ok: false, error: "APIFY_API_KEY missing" };

  const wait = Math.max(5, Math.min(120, args.waitForFinishSeconds || 60));
  try {
    const res = await fetchWithTimeout(`${BASE}/acts/${encodeURIComponent(args.actorId)}/run-sync-get-dataset-items?token=${encodeURIComponent(key)}&timeout=${wait}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(args.input),
      signal: signal as AbortSignal | null | undefined as AbortSignal,
    }, (wait + 5) * 1000);
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      return { ok: false, status: res.status, error: txt.slice(0, 200) };
    }
    const items = (await res.json()) as unknown[];
    return { ok: true, status: 200, items };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "unknown" };
  }
}

function pickStr(o: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const k of keys) {
    const v = o[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return undefined;
}
function pickNum(o: Record<string, unknown>, ...keys: string[]): number | undefined {
  for (const k of keys) {
    const v = o[k];
    if (typeof v === "number") return v;
    if (typeof v === "string" && v.trim()) {
      const n = Number(v);
      if (Number.isFinite(n)) return n;
    }
  }
  return undefined;
}
function pickArr(o: Record<string, unknown>, ...keys: string[]): unknown[] | undefined {
  for (const k of keys) {
    const v = o[k];
    if (Array.isArray(v)) return v;
  }
  return undefined;
}

function mapCompany(raw: Record<string, unknown>, domain: string): ApifyCompanyData {
  return {
    name: pickStr(raw, "name", "companyName", "company_name", "title"),
    domain,
    industry: pickStr(raw, "industry", "industryName"),
    description: pickStr(raw, "description", "about", "tagline"),
    employeesCount: pickNum(raw, "employeesCount", "employees", "headcount", "company_size_num", "linkedinFollowersCount", "followersCount"),
    size: pickStr(raw, "size", "companySize", "employeesRange"),
    headquarters: pickStr(raw, "headquarters", "hq", "location", "headquartersAddress"),
    founded: pickNum(raw, "founded", "foundedYear", "founded_year"),
    specialties: (pickArr(raw, "specialties", "specialities") as string[] | undefined)?.map(String),
    linkedinUrl: pickStr(raw, "linkedinUrl", "url", "linkedin_url"),
    website: pickStr(raw, "website", "websiteUrl"),
    tagline: pickStr(raw, "tagline", "headline"),
    raw,
  };
}

function mapJob(raw: Record<string, unknown>): ApifyJobData {
  return {
    title: pickStr(raw, "title", "jobTitle", "name"),
    function: pickStr(raw, "function", "department", "category", "jobFunction"),
    seniority: pickStr(raw, "seniority", "seniorityLevel", "level", "experienceLevel"),
    location: pickStr(raw, "location", "jobLocation", "city"),
    postedDate: pickStr(raw, "postedDate", "publishedAt", "postedAt", "datePosted", "createdAt"),
    applyUrl: pickStr(raw, "applyUrl", "url", "applicationUrl", "jobUrl"),
    description: pickStr(raw, "description", "descriptionText", "summary"),
    raw,
  };
}

function mapMember(raw: Record<string, unknown>): ApifyMemberData {
  const exp = (pickArr(raw, "experience", "experiences") || []) as Array<Record<string, unknown>>;
  const current = exp.find((e) => e.is_current === true || e.isCurrent === true || pickStr(e, "endDate") === "" || pickStr(e, "end_date") === "" ) || exp[0];
  let monthsInRole: number | undefined;
  const startedAt = current ? pickStr(current, "startDate", "start_date", "date_from", "dateFrom") : undefined;
  if (startedAt) {
    const t = Date.parse(startedAt);
    if (!Number.isNaN(t)) monthsInRole = Math.round((Date.now() - t) / (1000 * 60 * 60 * 24 * 30));
  }
  const posts = (pickArr(raw, "posts", "shares", "activities", "recentPosts") || []) as Array<Record<string, unknown>>;
  return {
    fullName: pickStr(raw, "fullName", "full_name", "name"),
    title: pickStr(raw, "title", "headline") || (current ? pickStr(current, "title", "position") : undefined),
    headline: pickStr(raw, "headline"),
    location: pickStr(raw, "location", "geoLocation", "country"),
    linkedinUrl: pickStr(raw, "linkedinUrl", "url", "profileUrl"),
    monthsInCurrentRole: monthsInRole,
    recentPosts: posts.slice(0, 8).map((p) => ({
      text: (pickStr(p, "text", "content", "description") || "").slice(0, 400),
      postedAt: pickStr(p, "postedAt", "publishedAt", "date"),
      engagement: pickNum(p, "engagement", "reactions", "likes", "totalReactions"),
    })).filter((p) => p.text.length > 0),
    raw,
  };
}

async function runActor(actorId: string, input: Record<string, unknown>, waitSeconds: number, signal?: AbortSignal): Promise<{ items: Record<string, unknown>[]; error?: string }> {
  const r = await runApifyActor({ actorId, input, waitForFinishSeconds: waitSeconds }, signal);
  if (!r.ok) return { items: [], error: r.error };
  return { items: (r.items || []) as Record<string, unknown>[] };
}

export async function apifyScrapeProfile(linkedinUrl: string, signal?: AbortSignal): Promise<ApifyMemberData | null> {
  if (!isApifyLive()) return null;
  if (!linkedinUrl || !linkedinUrl.toLowerCase().includes("linkedin.com")) return null;
  const r = await runActor(ACTOR_PROFILE, {
    profileUrls: [linkedinUrl],
    urls: [linkedinUrl],
    startUrls: [{ url: linkedinUrl }],
    profile_urls: [linkedinUrl],
    maxItems: 1,
  }, 90, signal);
  if (r.error || r.items.length === 0) return null;
  const mapped = mapMember(r.items[0]);
  if (!mapped.linkedinUrl) mapped.linkedinUrl = linkedinUrl;
  return mapped;
}

export interface ApifySnapshotOptions {
  championTitles?: string[];
  postKeywords?: string[];
  jobsLimit?: number;
  includeMembers?: boolean;
  stakeholderLinkedinUrl?: string;
  signal?: AbortSignal;
}

export async function apifySnapshot(domain: string, opts: ApifySnapshotOptions = {}): Promise<ApifySnapshotResult> {
  const errors: string[] = [];
  const result: ApifySnapshotResult = {
    domain,
    company: null,
    jobs: [],
    members: [],
    fetchedAt: new Date().toISOString(),
    errors,
    actorRunsTriggered: { company: false, jobs: false, members: false },
  };
  if (!isApifyLive()) {
    errors.push("APIFY_API_KEY missing");
    return result;
  }

  const linkedinSlug = domain.replace(/\.(com|in|co\.in|io|net|org|ai|co)$/i, "").replace(/[^a-z0-9-]/gi, "-");
  const linkedinCompanyUrl = `https://www.linkedin.com/company/${linkedinSlug}`;

  const tasks = await Promise.allSettled([
    (async () => {
      result.actorRunsTriggered.company = true;
      const r = await runActor(ACTOR_COMPANY, {
        urls: [linkedinCompanyUrl],
        startUrls: [{ url: linkedinCompanyUrl }],
        searchTerms: [domain],
        searchTerm: domain,
        maxItems: 1,
      }, 60, opts.signal);
      if (r.error) { errors.push(`apify company: ${r.error}`); return null; }
      const first = r.items[0];
      return first ? mapCompany(first, domain) : null;
    })(),
    (async () => {
      result.actorRunsTriggered.jobs = true;
      const limit = Math.max(1, Math.min(25, opts.jobsLimit ?? 10));
      const r = await runActor(ACTOR_JOBS, {
        companyUrls: [linkedinCompanyUrl],
        urls: [linkedinCompanyUrl + "/jobs/"],
        searchKeyword: (opts.postKeywords || []).slice(0, 3).join(" OR "),
        location: "India",
        rows: limit,
        maxItems: limit,
      }, 60, opts.signal);
      if (r.error) { errors.push(`apify jobs: ${r.error}`); return [] as ApifyJobData[]; }
      return r.items.slice(0, limit).map(mapJob);
    })(),
    (async () => {
      const stakeholderUrl = opts.stakeholderLinkedinUrl?.trim();
      if (stakeholderUrl) {
        result.actorRunsTriggered.members = true;
        const profile = await apifyScrapeProfile(stakeholderUrl, opts.signal);
        if (profile) return [profile];
        errors.push(`apify stakeholder profile: empty or failed for ${stakeholderUrl}`);
        return [] as ApifyMemberData[];
      }
      if (opts.includeMembers === false) return [] as ApifyMemberData[];
      result.actorRunsTriggered.members = true;
      const titles = (opts.championTitles || []).slice(0, 4).join(" OR ");
      if (!titles) return [] as ApifyMemberData[];
      const r = await runActor(ACTOR_PROFILE, {
        searchUrl: `https://www.linkedin.com/search/results/people/?currentCompany=%5B%22${encodeURIComponent(linkedinSlug)}%22%5D&keywords=${encodeURIComponent(titles)}`,
        keywords: titles,
        company: domain,
        maxItems: 5,
      }, 80, opts.signal);
      if (r.error) { errors.push(`apify members: ${r.error}`); return [] as ApifyMemberData[]; }
      return r.items.slice(0, 5).map(mapMember);
    })(),
  ]);

  if (tasks[0].status === "fulfilled") result.company = tasks[0].value;
  if (tasks[1].status === "fulfilled") result.jobs = tasks[1].value || [];
  if (tasks[2].status === "fulfilled") result.members = tasks[2].value || [];

  return result;
}
