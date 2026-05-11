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

async function smartleadFetch<T>(path: string): Promise<T> {
  const key = apiKey();
  const sep = path.includes("?") ? "&" : "?";
  const url = `${BASE_URL}${path}${sep}api_key=${encodeURIComponent(key)}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Smartlead ${res.status}: ${body.slice(0, 240) || res.statusText}`);
  }
  return res.json() as Promise<T>;
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
