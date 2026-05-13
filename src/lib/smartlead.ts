import { connectDB } from "@/lib/mongodb";
import SmartleadCache from "@/lib/models/smartlead-cache";

const BASE_URL = "https://server.smartlead.ai/api/v1";

export interface SmartleadCampaign {
  id: number;
  name: string;
  status: string;
  created_at?: string;
  updated_at?: string;
  start_date?: string | null;
  end_date?: string | null;
  track_settings?: unknown;
  scheduler_cron_value?: unknown;
}

export interface SmartleadAnalytics {
  campaign_id: number;
  campaign_name?: string;
  campaign_status?: string;
  sent_count: number;
  open_count: number;
  unique_open_count?: number;
  click_count: number;
  unique_click_count?: number;
  reply_count: number;
  unique_sent_count?: number;
  bounce_count: number;
  unsubscribed_count: number;
  total_count?: number;
}

export interface SmartleadCampaignWithAnalytics extends SmartleadAnalytics {
  name: string;
  status: string;
  created_at?: string;
  start_date?: string | null;
}

function apiKey(): string {
  const key = process.env.SMARTLEAD_API_KEY || "";
  if (!key) throw new Error("SMARTLEAD_API_KEY is not configured");
  return key;
}

type CacheEntry = { value: unknown; expiresAt: number };
const responseCache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<unknown>>();

const DEFAULT_TTL_MS = 60_000;
const TTL_BY_PATH: Array<{ test: RegExp; ttl: number }> = [
  { test: /\/campaigns\/[^/]+\/leads\/[^/]+\/message-history$/, ttl: 2 * 60_000 },
  { test: /\/campaigns\/[^/]+\/sequences$/, ttl: 5 * 60_000 },
  { test: /\/campaigns\/[^/]+\/email-accounts$/, ttl: 5 * 60_000 },
  { test: /\/campaigns\/[^/]+\/schedule$/, ttl: 5 * 60_000 },
  { test: /\/campaigns\/[^/]+\/statistics/, ttl: 3 * 60_000 },
  { test: /\/campaigns\/[^/]+\/analytics$/, ttl: 60_000 },
  { test: /\/campaigns\/[^/]+\/leads/, ttl: 3 * 60_000 },
  { test: /\/campaigns\/[^/]+$/, ttl: 5 * 60_000 },
  { test: /\/campaigns$/, ttl: 2 * 60_000 },
  { test: /\/leads\/fetch-categories$/, ttl: 60 * 60_000 },
  { test: /\/leads\/[^/]+$/, ttl: 10 * 60_000 },
];

function ttlFor(path: string): number {
  for (const { test, ttl } of TTL_BY_PATH) if (test.test(path)) return ttl;
  return DEFAULT_TTL_MS;
}

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 180;
const rateTimestamps: number[] = [];
async function waitForRateBudget() {
  while (true) {
    const now = Date.now();
    while (rateTimestamps.length > 0 && rateTimestamps[0] < now - RATE_WINDOW_MS) rateTimestamps.shift();
    if (rateTimestamps.length < RATE_MAX) {
      rateTimestamps.push(now);
      return;
    }
    const wait = (rateTimestamps[0] + RATE_WINDOW_MS) - now + 50;
    await sleep(Math.max(50, wait));
  }
}

const MAX_CONCURRENCY = 6;
let inflightCount = 0;
const waiters: Array<() => void> = [];
async function acquireSlot() {
  if (inflightCount < MAX_CONCURRENCY) { inflightCount++; return; }
  await new Promise<void>((resolve) => waiters.push(resolve));
  inflightCount++;
}
function releaseSlot() {
  inflightCount--;
  const next = waiters.shift();
  if (next) next();
}

export async function mapLimited<T, R>(items: T[], fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const idx = cursor++;
      try { results[idx] = await fn(items[idx]); }
      catch { results[idx] = undefined as unknown as R; }
    }
  }
  const workers = Array.from({ length: Math.min(MAX_CONCURRENCY, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

const REFRESH_LOCK_MS = 30_000;

async function liveFetch<T>(path: string): Promise<T> {
  const key = apiKey();
  const sep = path.includes("?") ? "&" : "?";
  const url = `${BASE_URL}${path}${sep}api_key=${encodeURIComponent(key)}`;
  let attempt = 0;
  let lastError = "";
  while (attempt < 3) {
    await waitForRateBudget();
    await acquireSlot();
    let res: Response;
    try {
      res = await fetch(url, { cache: "no-store" });
    } finally {
      releaseSlot();
    }
    if (res.ok) return (await res.json()) as T;
    const body = await res.text().catch(() => "");
    lastError = `Smartlead ${res.status}: ${body.slice(0, 240) || res.statusText}`;
    if (res.status === 429) {
      const retryAfter = Number(res.headers.get("Retry-After")) || 0;
      const backoff = retryAfter > 0 ? retryAfter * 1000 : 1500 * (attempt + 1);
      await sleep(Math.min(backoff, 15_000));
      attempt++;
      continue;
    }
    throw new Error(lastError);
  }
  throw new Error(lastError || "Smartlead request failed");
}

async function persistToCache(path: string, data: unknown) {
  try {
    await connectDB();
    await SmartleadCache.updateOne(
      { path },
      { $set: { path, data, fetchedAt: new Date(), refreshingAt: null } },
      { upsert: true },
    );
  } catch {}
}

async function tryAcquireRefreshLock(path: string): Promise<boolean> {
  try {
    await connectDB();
    const cutoff = new Date(Date.now() - REFRESH_LOCK_MS);
    const res = await SmartleadCache.updateOne(
      { path, $or: [{ refreshingAt: null }, { refreshingAt: { $lt: cutoff } }] },
      { $set: { refreshingAt: new Date() } },
      { upsert: true },
    );
    return (res.upsertedCount || 0) > 0 || (res.modifiedCount || 0) > 0;
  } catch {
    return false;
  }
}

function setMemory(path: string, data: unknown, ttl: number) {
  responseCache.set(path, { value: data, expiresAt: Date.now() + ttl });
}

async function refreshInBackground<T>(path: string, ttl: number) {
  if (inFlight.has(path)) return;
  const locked = await tryAcquireRefreshLock(path);
  if (!locked) return;
  const p = (async () => {
    try {
      const data = await liveFetch<T>(path);
      setMemory(path, data, ttl);
      await persistToCache(path, data);
    } catch {
      // leave stale data in place
    } finally {
      inFlight.delete(path);
    }
  })();
  inFlight.set(path, p);
}

async function smartleadFetch<T>(path: string, opts?: { force?: boolean }): Promise<T> {
  const ttl = ttlFor(path);
  const now = Date.now();

  // L1 hot memory
  if (!opts?.force) {
    const mem = responseCache.get(path);
    if (mem && mem.expiresAt > now) return mem.value as T;
    const pending = inFlight.get(path);
    if (pending) return pending as Promise<T>;
  }

  // L2 durable mongo
  let stored: { data: unknown; fetchedAt: Date } | null = null;
  try {
    await connectDB();
    stored = await SmartleadCache.findOne({ path }).lean<{ data: unknown; fetchedAt: Date }>();
  } catch {}

  if (!opts?.force && stored && (now - new Date(stored.fetchedAt).getTime()) < ttl) {
    setMemory(path, stored.data, ttl - (now - new Date(stored.fetchedAt).getTime()));
    return stored.data as T;
  }

  // Stale-while-revalidate: have something cached, just old — return it and refresh in background.
  if (!opts?.force && stored) {
    setMemory(path, stored.data, 30_000);
    void refreshInBackground<T>(path, ttl);
    return stored.data as T;
  }

  // Cold cache — must fetch.
  const exec = (async () => {
    try {
      const data = await liveFetch<T>(path);
      setMemory(path, data, ttl);
      await persistToCache(path, data);
      return data;
    } catch (e) {
      if (stored) return stored.data as T;
      throw e;
    }
  })();
  inFlight.set(path, exec);
  try {
    return await exec;
  } finally {
    inFlight.delete(path);
  }
}

export interface SmartleadSequenceStep {
  id?: number;
  campaign_id?: number;
  seq_number?: number;
  seq_delay_details?: { delay_in_days?: number } | null;
  subject?: string;
  email_body?: string;
  sequence_variants?: Array<{
    id?: number;
    variant_label?: string;
    subject?: string;
    email_body?: string;
  }>;
}

export interface SmartleadEmailAccount {
  id?: number;
  from_name?: string;
  from_email?: string;
  username?: string;
  smtp_host?: string;
  daily_sent_count?: number;
  is_smtp_success?: boolean;
  is_imap_success?: boolean;
  message_per_day?: number;
  warmup_details?: { status?: string; daily_sent_count?: number; total_sent_count?: number } | null;
}

export async function fetchAllCampaigns(): Promise<SmartleadCampaign[]> {
  const data = await smartleadFetch<SmartleadCampaign[] | { campaigns: SmartleadCampaign[] }>("/campaigns");
  if (Array.isArray(data)) return data;
  if (data && Array.isArray((data as { campaigns: SmartleadCampaign[] }).campaigns)) {
    return (data as { campaigns: SmartleadCampaign[] }).campaigns;
  }
  return [];
}

export async function fetchCampaign(campaignId: string): Promise<SmartleadCampaign> {
  return smartleadFetch<SmartleadCampaign>(`/campaigns/${encodeURIComponent(campaignId)}`);
}

export async function fetchCampaignAnalytics(campaignId: string): Promise<SmartleadAnalytics> {
  return smartleadFetch<SmartleadAnalytics>(`/campaigns/${encodeURIComponent(campaignId)}/analytics`);
}

export async function fetchCampaignSequences(campaignId: string): Promise<SmartleadSequenceStep[]> {
  const data = await smartleadFetch<SmartleadSequenceStep[] | { sequences: SmartleadSequenceStep[] }>(`/campaigns/${encodeURIComponent(campaignId)}/sequences`);
  if (Array.isArray(data)) return data;
  if (data && Array.isArray((data as { sequences: SmartleadSequenceStep[] }).sequences)) {
    return (data as { sequences: SmartleadSequenceStep[] }).sequences;
  }
  return [];
}

export async function fetchCampaignEmailAccounts(campaignId: string): Promise<SmartleadEmailAccount[]> {
  const data = await smartleadFetch<SmartleadEmailAccount[] | { email_accounts: SmartleadEmailAccount[] }>(`/campaigns/${encodeURIComponent(campaignId)}/email-accounts`);
  if (Array.isArray(data)) return data;
  if (data && Array.isArray((data as { email_accounts: SmartleadEmailAccount[] }).email_accounts)) {
    return (data as { email_accounts: SmartleadEmailAccount[] }).email_accounts;
  }
  return [];
}

export interface SmartleadCampaignSchedule {
  timezone?: string;
  days_of_the_week?: number[];
  start_hour?: string;
  end_hour?: string;
  min_time_btw_emails?: number;
  max_new_leads_per_day?: number;
  schedule_start_time?: string;
}

export async function fetchCampaignSchedule(campaignId: string): Promise<SmartleadCampaignSchedule | null> {
  try {
    return await smartleadFetch<SmartleadCampaignSchedule>(`/campaigns/${encodeURIComponent(campaignId)}/schedule`);
  } catch {
    return null;
  }
}

export interface SmartleadLeadRow {
  lead?: {
    id?: number;
    first_name?: string;
    last_name?: string;
    email?: string;
    company_name?: string;
    job_title?: string;
    phone_number?: string;
  };
  campaign_lead_map?: {
    id?: number;
    status?: string;
    created_at?: string;
    last_replied_at?: string | null;
    total_replied_count?: number;
    lead_category_id?: number | null;
  };
  // Some Smartlead responses inline these:
  last_replied_at?: string | null;
  total_replied_count?: number;
  lead_category_id?: number | null;
}

export interface SmartleadLeadsResponse {
  total_leads?: number;
  data?: SmartleadLeadRow[];
}

export async function fetchCampaignLeads(campaignId: string, opts: { limit?: number; offset?: number } = {}): Promise<SmartleadLeadsResponse> {
  const limit = opts.limit ?? 100;
  const offset = opts.offset ?? 0;
  const path = `/campaigns/${encodeURIComponent(campaignId)}/leads?limit=${limit}&offset=${offset}`;
  return smartleadFetch<SmartleadLeadsResponse>(path);
}

export interface SmartleadCampaignStatRow {
  stats_id?: string;
  lead_id?: number | string;
  campaign_id?: number;
  lead_email?: string;
  lead_name?: string;
  lead_first_name?: string;
  lead_last_name?: string;
  lead_company?: string;
  sequence_number?: number;
  email_subject?: string;
  email_body?: string;
  sent_time?: string | null;
  open_time?: string | null;
  click_time?: string | null;
  reply_time?: string | null;
  is_unsubscribed?: boolean;
  is_bounced?: boolean;
}

export interface SmartleadCampaignStatsResponse {
  total_stats?: string | number;
  data?: SmartleadCampaignStatRow[];
}

export async function fetchCampaignStatistics(campaignId: string, opts: { limit?: number; offset?: number } = {}): Promise<SmartleadCampaignStatsResponse> {
  const limit = opts.limit ?? 100;
  const offset = opts.offset ?? 0;
  return smartleadFetch<SmartleadCampaignStatsResponse>(`/campaigns/${encodeURIComponent(campaignId)}/statistics?limit=${limit}&offset=${offset}`);
}

export interface SmartleadMessageHistoryItem {
  message_id?: string;
  stats_id?: string;
  type?: string;
  time?: string;
  subject?: string;
  email_body?: string;
  email_seq_number?: number;
  from?: string;
  to?: string;
  open_count?: number;
  click_count?: number;
}

export async function fetchLeadMessageHistory(campaignId: string, leadId: string, opts?: { force?: boolean }): Promise<SmartleadMessageHistoryItem[]> {
  const data = await smartleadFetch<SmartleadMessageHistoryItem[] | { history?: SmartleadMessageHistoryItem[] }>(
    `/campaigns/${encodeURIComponent(campaignId)}/leads/${encodeURIComponent(leadId)}/message-history`,
    opts,
  );
  if (Array.isArray(data)) return data;
  if (data && Array.isArray((data as { history: SmartleadMessageHistoryItem[] }).history)) {
    return (data as { history: SmartleadMessageHistoryItem[] }).history;
  }
  return [];
}

export async function invalidateSmartleadCache(pathPrefix?: string): Promise<number> {
  await connectDB();
  const filter = pathPrefix ? { path: { $regex: `^${pathPrefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}` } } : {};
  const r = await SmartleadCache.deleteMany(filter);
  return r.deletedCount || 0;
}

export interface SmartleadLeadCategory {
  id?: number;
  name?: string;
  description?: string;
}

export async function updateLeadCategory(campaignId: string, leadId: string, categoryId: number): Promise<void> {
  const key = apiKey();
  const url = `${BASE_URL}/campaigns/${encodeURIComponent(campaignId)}/leads/${encodeURIComponent(leadId)}/category?api_key=${encodeURIComponent(key)}`;
  await waitForRateBudget();
  await acquireSlot();
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ category_id: categoryId }),
    });
  } finally {
    releaseSlot();
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Smartlead ${res.status}: ${body.slice(0, 240) || res.statusText}`);
  }
}

export interface SmartleadLead {
  id?: number;
  first_name?: string;
  last_name?: string;
  email?: string;
  company_name?: string;
  job_title?: string;
  phone_number?: string;
  website?: string;
  location?: string;
  linkedin_profile?: string;
}

export async function fetchLead(leadId: string): Promise<SmartleadLead | null> {
  try {
    return await smartleadFetch<SmartleadLead>(`/leads/${encodeURIComponent(leadId)}`);
  } catch {
    return null;
  }
}

export async function fetchLeadCategories(): Promise<SmartleadLeadCategory[]> {
  try {
    const data = await smartleadFetch<SmartleadLeadCategory[] | { categories?: SmartleadLeadCategory[] }>(`/leads/fetch-categories`);
    if (Array.isArray(data)) return data;
    if (data && Array.isArray((data as { categories: SmartleadLeadCategory[] }).categories)) {
      return (data as { categories: SmartleadLeadCategory[] }).categories;
    }
    return [];
  } catch {
    return [];
  }
}

export async function fetchCampaignWithAnalytics(campaignId: string): Promise<SmartleadCampaignWithAnalytics | null> {
  try {
    const [meta, stats] = await Promise.all([
      fetchCampaign(campaignId),
      fetchCampaignAnalytics(campaignId),
    ]);
    return {
      ...stats,
      campaign_id: Number(campaignId),
      name: meta.name || stats.campaign_name || `Campaign ${campaignId}`,
      status: meta.status || stats.campaign_status || "unknown",
      created_at: meta.created_at,
      start_date: meta.start_date,
    };
  } catch {
    return null;
  }
}

function n(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v === "string") {
    const parsed = Number(v);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export function aggregateAnalytics(rows: SmartleadAnalytics[]) {
  const totals = rows.reduce(
    (acc, r) => {
      acc.sent += n(r.sent_count);
      acc.opens += n(r.unique_open_count ?? r.open_count);
      acc.replies += n(r.reply_count);
      acc.clicks += n(r.unique_click_count ?? r.click_count);
      acc.bounces += n(r.bounce_count);
      acc.unsubscribes += n(r.unsubscribed_count);
      return acc;
    },
    { sent: 0, opens: 0, replies: 0, clicks: 0, bounces: 0, unsubscribes: 0 },
  );
  const safePct = (num: number, den: number) => (den > 0 ? Math.round((num / den) * 1000) / 10 : 0);
  return {
    ...totals,
    openRate: safePct(totals.opens, totals.sent),
    replyRate: safePct(totals.replies, totals.sent),
    clickRate: safePct(totals.clicks, totals.sent),
    bounceRate: safePct(totals.bounces, totals.sent),
    unsubscribeRate: safePct(totals.unsubscribes, totals.sent),
  };
}
